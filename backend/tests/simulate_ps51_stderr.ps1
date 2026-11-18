# ==============================================================================
# Simulation Test: PowerShell 5.1 Native Command Stderr and Exit Code Behavior
# ==============================================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-SafePgCommand {
    param (
        [string]$Description,
        [scriptblock]$CommandBlock
    )
    Write-Host "  -> $Description" -ForegroundColor Gray

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $CommandBlock
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Write-Error "COMMAND FAILED (exit code $code): $Description. Stopping immediately."
        exit $code
    }
}

function Invoke-SafePgQuery {
    param (
        [string]$Description,
        [scriptblock]$QueryBlock
    )
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $result = & $QueryBlock
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Write-Error "QUERY FAILED (exit code $code): $Description. Stopping immediately."
        exit $code
    }
    return $result
}

Write-Host "--- TEST 1: Simulated PostgreSQL NOTICE on stderr (exit code 0) ---" -ForegroundColor Cyan
$test1Passed = $false
try {
    Invoke-SafePgCommand "Simulate: dropdb NOTICE database does not exist" {
        & powershell.exe -NoProfile -Command "[Console]::Error.WriteLine('NOTICE: database ""healthsync_local_test"" does not exist, skipping'); exit 0"
    }
    $test1Passed = $true
    Write-Host "TEST 1 PASSED: Harmless NOTICE on stderr did not halt execution." -ForegroundColor Green
} catch {
    Write-Error "TEST 1 FAILED: Erroneously halted on harmless stderr NOTICE: $_"
}

Write-Host "`n--- TEST 2: Simulated PostgreSQL Query returning value with NOTICE (exit code 0) ---" -ForegroundColor Cyan
$test2Passed = $false
try {
    $rawVal = Invoke-SafePgQuery "Simulate: psql query with notice" {
        & powershell.exe -NoProfile -Command "[Console]::Error.WriteLine('NOTICE: relation already exists'); Write-Output '42'; exit 0"
    }
    $val = [int]($rawVal.ToString().Trim())
    if ($val -eq 42) {
        $test2Passed = $true
        Write-Host "TEST 2 PASSED: Query captured stdout ($val) cleanly despite stderr notice." -ForegroundColor Green
    } else {
        Write-Error "TEST 2 FAILED: Value mismatch: $val"
    }
} catch {
    Write-Error "TEST 2 FAILED: Query failed with exception: $_"
}

Write-Host "`n--- TEST 3: Genuine command failure (exit code 2) ---" -ForegroundColor Cyan
$test3Passed = $false
try {
    Invoke-SafePgCommand "Simulate: psql authentication or connection failure" {
        & powershell.exe -NoProfile -Command "[Console]::Error.WriteLine('FATAL: password authentication failed for user ""postgres""'); exit 2"
    }
    Write-Error "TEST 3 FAILED: Command with exit code 2 failed to halt!"
} catch {
    $test3Passed = $true
    Write-Host "TEST 3 PASSED: Non-zero exit code 2 halted immediately with exception: $($_.Exception.Message)" -ForegroundColor Green
}

if ($test1Passed -and $test2Passed -and $test3Passed) {
    Write-Host "`n===============================================" -ForegroundColor Cyan
    Write-Host " ALL 3 POWERSHELL 5.1 STDERR SIMULATION TESTS PASSED!" -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Cyan
} else {
    Write-Error "SOME TESTS FAILED."
    exit 1
}
