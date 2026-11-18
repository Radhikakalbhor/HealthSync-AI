# ==============================================================================
# Comprehensive Failure Scenario Simulation Suite for run_local_db_tests.ps1
# Tests all operational and failure scenarios required by the specification:
# - Scenario 1: Initial DB does not exist (dropdb notice handled safely).
# - Scenario 2: Initial DB already exists (cleaned up first).
# - Scenario 3: Auth failure halts execution.
# - Scenario 4: Harness failure halts execution.
# - Scenario 5: Migration 001 failure halts execution.
# - Scenario 6: Intermediate migration failure (004) halts execution.
# - Scenario 7: Migration 007 failure halts execution.
# - Scenario 8: Clean teardown succeeds after successful test run.
# - Scenario 9: Teardown fails after successful migrations -> OVERALL TEST FAILS (exit code 1).
# - Scenario 10: Protected/System DB name rejected by safety guard.
# - Scenario 11: Non-zero exit code halts execution immediately.
# - Scenario 12: Harmless NOTICE/WARNING on stderr does not abort script in PS 5.1.
# - Scenario 13: Migration fails with code 5 AND teardown fails -> Primary code 5 PRESERVED.
# - Scenario 14: Command-line -Password parameter is rejected to prevent credential leaks.
# ==============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = (Resolve-Path "run_local_db_tests.ps1").Path

# Helper to compile mock binary that can simulate specific return codes and outputs
$source = @"
using System;
using System.IO;

public class MockTool {
    public static int Main(string[] args) {
        string mode = Environment.GetEnvironmentVariable("MOCK_FAIL_MODE") ?? "SUCCESS";

        // Check if query asking for count or exists
        for (int i = 0; i < args.Length; i++) {
            if (args[i] == "-c") {
                if (i + 1 < args.Length && args[i+1].Contains("EXISTS")) {
                    Console.WriteLine("f");
                    return 0;
                }
                if (i + 1 < args.Length && args[i+1].Contains("count(*)")) {
                    Console.WriteLine("1");
                    return 0;
                }
            }
        }

        // Scenario 12: Notice on stderr with exit code 0
        if (mode == "NOTICE_STDERR") {
            Console.Error.WriteLine("NOTICE: database \"healthsync_local_test\" does not exist, skipping");
            Console.Error.WriteLine("WARNING: some harmless warning");
            return 0;
        }

        // Scenario 3: Auth fail
        if (mode == "AUTH_FAIL") {
            Console.Error.WriteLine("FATAL: password authentication failed for user \"postgres\"");
            return 2;
        }

        // Scenario 4: Harness fail
        if (mode == "HARNESS_FAIL") {
            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "-f" && i + 1 < args.Length && args[i+1].Contains("supabase_test_harness.sql")) {
                    Console.Error.WriteLine("ERROR: syntax error in harness");
                    return 1;
                }
            }
            return 0;
        }

        // Scenario 5: Migration 001 fail
        if (mode == "MIG001_FAIL") {
            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "-f" && i + 1 < args.Length && args[i+1].Contains("001_initial_schema.sql")) {
                    Console.Error.WriteLine("ERROR: relation \"auth.users\" does not exist");
                    return 1;
                }
            }
            return 0;
        }

        // Scenario 6: Intermediate migration fail (e.g. 004 local compat)
        if (mode == "INTERMEDIATE_FAIL") {
            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "-f" && i + 1 < args.Length && args[i+1].Contains("004_ai_assistant_rag_local_compat.sql")) {
                    Console.Error.WriteLine("ERROR: table creation failed on document_chunks");
                    return 1;
                }
            }
            return 0;
        }

        // Scenario 7: Migration 007 fail
        if (mode == "MIG007_FAIL") {
            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "-f" && i + 1 < args.Length && args[i+1].Contains("007_unified_extraction_result.sql")) {
                    Console.Error.WriteLine("ERROR: collision check failed");
                    return 1;
                }
            }
            return 0;
        }

        // Scenario 9: Cleanup fail (dropdb during teardown without --if-exists)
        if (mode == "CLEANUP_FAIL") {
            if (AppDomain.CurrentDomain.FriendlyName.ToLower().Contains("dropdb") && !Array.Exists(args, a => a == "--if-exists")) {
                Console.Error.WriteLine("ERROR: cannot drop database because it is being accessed by other users");
                return 1;
            }
            return 0;
        }

        // Scenario 11: Non-zero exit code
        if (mode == "GENERIC_FAIL") {
            Console.Error.WriteLine("ERROR: generic database failure");
            return 3;
        }

        // Scenario 13: Migration 001 fails with exit code 5 AND teardown dropdb fails with exit code 1
        if (mode == "MIG_AND_CLEANUP_FAIL") {
            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "-f" && i + 1 < args.Length && args[i+1].Contains("001_initial_schema.sql")) {
                    Console.Error.WriteLine("ERROR: schema migration 001 failed catastrophically");
                    return 5;
                }
            }
            if (AppDomain.CurrentDomain.FriendlyName.ToLower().Contains("dropdb") && !Array.Exists(args, a => a == "--if-exists")) {
                Console.Error.WriteLine("ERROR: teardown dropdb failed");
                return 1;
            }
            return 0;
        }

        return 0;
    }
}
"@

$mockDir = Join-Path $PSScriptRoot "sim_mocks"
New-Item -ItemType Directory -Path $mockDir -Force | Out-Null
$mockCs = Join-Path $mockDir "MockTool.cs"
$mockExe = Join-Path $mockDir "mock.exe"
Set-Content -Path $mockCs -Value $source
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /target:exe /out:"$mockExe" "$mockCs"
Copy-Item $mockExe (Join-Path $mockDir "psql.exe") -Force
Copy-Item $mockExe (Join-Path $mockDir "createdb.exe") -Force
Copy-Item $mockExe (Join-Path $mockDir "dropdb.exe") -Force

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Running Complete 14-Scenario Failure Simulation Suite" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$passedScenarios = 0

function Run-Scenario {
    param(
        [string]$Name,
        [string]$FailMode,
        [bool]$ExpectSuccess,
        [string]$ExpectedOutputPattern,
        [int]$ExpectedExitCode = -1
    )
    Write-Host "`n[Scenario] $Name" -ForegroundColor Yellow
    $env:MOCK_FAIL_MODE = $FailMode

    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = "powershell.exe"
    $pinfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -PgBinPath `"$mockDir`""
    $pinfo.UseShellExecute = $false
    $pinfo.RedirectStandardOutput = $true
    $pinfo.RedirectStandardError = $true
    $p = [System.Diagnostics.Process]::Start($pinfo)
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    $exitCode = $p.ExitCode
    $outStr = "$stdout`n$stderr"

    if ($ExpectSuccess) {
        if ($exitCode -eq 0 -and $outStr -match $ExpectedOutputPattern) {
            Write-Host "  -> PASSED (Exit code: $exitCode, Match: '$ExpectedOutputPattern')" -ForegroundColor Green
            $script:passedScenarios++
        } else {
            Write-Error "  -> FAILED: Expected success but got exit code $exitCode. Output:`n$outStr"
        }
    } else {
        $codeMatches = ($ExpectedExitCode -eq -1) -or ($exitCode -eq $ExpectedExitCode)
        $noSuccessBanner = ($outStr -notmatch "ALL LOCAL DATABASE MIGRATION & ROLLBACK TESTS PASSED")

        if ($exitCode -ne 0 -and $codeMatches -and $outStr -match $ExpectedOutputPattern -and $noSuccessBanner) {
            Write-Host "  -> PASSED (Caught expected failure with code $exitCode, Match: '$ExpectedOutputPattern', Banner withheld)" -ForegroundColor Green
            $script:passedScenarios++
        } else {
            Write-Error "  -> FAILED: Expected failure (code: $ExpectedExitCode, pattern: '$ExpectedOutputPattern') but got exit code $exitCode. BannerWithheld: $noSuccessBanner. Output:`n$outStr"
        }
    }
}

try {
    # 1. Database does not exist initially (dropdb --if-exists gets notice, createdb succeeds)
    Run-Scenario "1. Database does not exist initially" "NOTICE_STDERR" $true "ALL LOCAL DATABASE MIGRATION & ROLLBACK TESTS PASSED"

    # 2. Database already exists and must be cleaned up first
    Run-Scenario "2. Database already exists initially" "SUCCESS" $true "Clean pre-existing test database"

    # 3. PostgreSQL authentication fails
    Run-Scenario "3. Authentication failure" "AUTH_FAIL" $false "COMMAND FAILED" 2

    # 4. Compatibility harness fails
    Run-Scenario "4. Compatibility harness fails" "HARNESS_FAIL" $false "COMMAND FAILED" 1

    # 5. Migration 001 fails
    Run-Scenario "5. Migration 001 fails" "MIG001_FAIL" $false "COMMAND FAILED" 1

    # 6. Intermediate migration fails (004 local compat)
    Run-Scenario "6. Intermediate migration fails (004)" "INTERMEDIATE_FAIL" $false "COMMAND FAILED" 1

    # 7. Migration 007 fails
    Run-Scenario "7. Migration 007 fails" "MIG007_FAIL" $false "COMMAND FAILED" 1

    # 8. Database cleanup succeeds (verified in Scenario 1 & 2 teardown output)
    Run-Scenario "8. Database cleanup succeeds" "SUCCESS" $true "Cleaning up: Dropping disposable test database"

    # 9. Database cleanup fails after successful migrations -> OVERALL SCRIPT FAILS (Exit code 1, NO success banner)
    Run-Scenario "9. Database cleanup fails after success (Overall Fails)" "CLEANUP_FAIL" $false "CLEANUP FAILURE" 1

    # 10. Database protection guard (rejects protected/system DB name)
    Write-Host "`n[Scenario] 10. Database protection guard (rejects protected/system DB name)" -ForegroundColor Yellow
    $pinfo10 = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo10.FileName = "powershell.exe"
    $pinfo10.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -PgBinPath `"$mockDir`" -TestDbName 'postgres'"
    $pinfo10.UseShellExecute = $false
    $pinfo10.RedirectStandardOutput = $true
    $pinfo10.RedirectStandardError = $true
    $p10 = [System.Diagnostics.Process]::Start($pinfo10)
    $stdout10 = $p10.StandardOutput.ReadToEnd()
    $stderr10 = $p10.StandardError.ReadToEnd()
    $p10.WaitForExit()
    $guardOutStr = "$stdout10`n$stderr10"
    if ($p10.ExitCode -ne 0 -and $guardOutStr -match "CRITICAL SAFETY VIOLATION") {
        Write-Host "  -> PASSED (Protected DB rejected with exit code $($p10.ExitCode))" -ForegroundColor Green
        $passedScenarios++
    } else {
        Write-Error "  -> FAILED to reject protected DB!"
    }

    # 11. Generic non-zero exit code halting
    Run-Scenario "11. Generic non-zero exit code halts execution" "GENERIC_FAIL" $false "COMMAND FAILED" 3

    # 12. PowerShell 5.1 receives native stderr containing NOTICE or WARNING
    Run-Scenario "12. Harmless NOTICE/WARNING does not abort script" "NOTICE_STDERR" $true "ALL LOCAL DATABASE MIGRATION & ROLLBACK TESTS PASSED"

    # 13. Migration fails with exit code 5 AND cleanup also fails with exit code 1 (Primary code 5 preserved)
    Run-Scenario "13. Migration failure preserved when cleanup also fails" "MIG_AND_CLEANUP_FAIL" $false "ADDITIONAL TEARDOWN ERROR" 5

    # 14. Command-line -Password argument is rejected by parameter binding
    Write-Host "`n[Scenario] 14. Plaintext -Password argument rejection" -ForegroundColor Yellow
    $pinfo14 = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo14.FileName = "powershell.exe"
    $pinfo14.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -PgBinPath `"$mockDir`" -Password 'leaked_secret'"
    $pinfo14.UseShellExecute = $false
    $pinfo14.RedirectStandardOutput = $true
    $pinfo14.RedirectStandardError = $true
    $p14 = [System.Diagnostics.Process]::Start($pinfo14)
    $stdout14 = $p14.StandardOutput.ReadToEnd()
    $stderr14 = $p14.StandardError.ReadToEnd()
    $p14.WaitForExit()
    $passOutStr = "$stdout14`n$stderr14"
    if ($p14.ExitCode -ne 0 -and ($passOutStr -match "NamedParameterNotFound" -or $passOutStr -match "Password")) {
        Write-Host "  -> PASSED (-Password rejected by parameter binding with exit code $($p14.ExitCode))" -ForegroundColor Green
        $passedScenarios++
    } else {
        Write-Error "  -> FAILED: -Password was unexpectedly accepted or did not fail as expected! Output:`n$passOutStr"
    }

    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " SCENARIO SIMULATION SUMMARY: $passedScenarios / 14 PASSED!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan

} finally {
    Remove-Item -Path $mockDir -Recurse -Force -ErrorAction SilentlyContinue
}
