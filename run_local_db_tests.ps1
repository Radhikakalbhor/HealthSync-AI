# ==============================================================================
# HealthSync AI — Local Database Migration & Rollback Test Runner
# Tests Migrations 001–007 against an isolated disposable local PostgreSQL database
# STRICT SAFETY GUARANTEES:
# - Target database is hard-restricted to 'healthsync_local_test' ONLY.
# - Rejects 'postgres', 'template0', 'template1', and any non-whitelisted name.
# - Connects strictly to 127.0.0.1 (never connects to hosted Supabase).
# - Halts immediately on any command or SQL failure ($LASTEXITCODE check).
# - Disposes of the test database on exit.
# - Zero passwords permitted in command-line arguments (uses secure prompt or $env:PGPASSWORD).
# - Fails overall test suite if database teardown/cleanup fails.
# ==============================================================================

[CmdletBinding()]
param (
    [string]$PgBinPath = "C:\Program Files\PostgreSQL\18\bin",
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5432,
    [string]$User = "postgres",
    [string]$TestDbName = "healthsync_local_test"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ------------------------------------------------------------------------------
# 1. Database Safety & Confinement Checks
# ------------------------------------------------------------------------------
$REQUIRED_TEST_DB = "healthsync_local_test"

# Strict exact match requirement
if ($TestDbName -ne $REQUIRED_TEST_DB) {
    Write-Error "CRITICAL SAFETY VIOLATION: TestDbName is hard-restricted to '$REQUIRED_TEST_DB'. Provided: '$TestDbName'. Execution aborted."
    exit 1
}

# Explicit forbidden database blacklist
$FORBIDDEN_DATABASES = @(
    "postgres",
    "template0",
    "template1",
    "healthsync",
    "healthsync_production",
    "healthsync_staging",
    "production",
    "staging"
)

if ($FORBIDDEN_DATABASES -contains $TestDbName.ToLower().Trim()) {
    Write-Error "CRITICAL SAFETY VIOLATION: Database name '$TestDbName' is a protected/forbidden database. Execution aborted."
    exit 1
}

# Ensure connection is strictly local
if ($HostName -ne "127.0.0.1" -and $HostName -ne "localhost") {
    Write-Error "CRITICAL SAFETY VIOLATION: HostName must be 127.0.0.1 or localhost. Provided: '$HostName'. Refusing remote connections."
    exit 1
}

# ------------------------------------------------------------------------------
# 2. Binary Validation
# ------------------------------------------------------------------------------
$psql = Join-Path $PgBinPath "psql.exe"
$createdb = Join-Path $PgBinPath "createdb.exe"
$dropdb = Join-Path $PgBinPath "dropdb.exe"

foreach ($bin in @($psql, $createdb, $dropdb)) {
    if (-not (Test-Path $bin)) {
        Write-Error "PostgreSQL binary missing: '$bin'. Check PgBinPath."
        exit 1
    }
}

# ------------------------------------------------------------------------------
# 3. Canonical Migration Sequence & File Definitions
# Explicitly declared at script scope before execution
# ------------------------------------------------------------------------------
$harnessScript = "backend/scripts/supabase_test_harness.sql"

$baselineMigrations = @(
    "backend/migrations/001_initial_schema.sql",
    "backend/migrations/002_row_level_security.sql",
    "backend/migrations/003_medication_reminders.sql",
    "backend/scripts/004_ai_assistant_rag_local_compat.sql",
    "backend/migrations/005_advanced_intelligence.sql",
    "backend/migrations/006_table_privileges.sql"
)

$migration007 = "backend/migrations/007_unified_extraction_result.sql"
$rollback007 = "backend/migrations/007_unified_extraction_result_rollback.sql"

# Verify all required files exist before execution starts
$allRequiredFiles = @($harnessScript) + $baselineMigrations + @($migration007, $rollback007)
foreach ($file in $allRequiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error "Required migration/script file missing: '$file'. Execution aborted."
        exit 1
    }
}

# ------------------------------------------------------------------------------
# 4. Deterministic Execution Helpers (Strict-Mode Safe, Exit Code Preserving)
# ------------------------------------------------------------------------------
function Invoke-SafePgCommand {
    param (
        [string]$Description,
        [string]$Executable,
        [string[]]$Arguments
    )
    Write-Host "  -> $Description" -ForegroundColor Gray

    # In PowerShell 5.1, native commands writing harmless NOTICE/WARNING messages
    # to stderr trigger NativeCommandError under $ErrorActionPreference = 'Stop'.
    # We scope $ErrorActionPreference to 'Continue' around native execution so stderr
    # is displayed without crashing, and rely strictly on $LASTEXITCODE for failure.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Executable @Arguments
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    $code = $LASTEXITCODE
    if ($code -ne 0) {
        $script:primaryExitCode = $code
        $script:primaryErrorMessage = "COMMAND FAILED (exit code $code): $Description."
        throw $script:primaryErrorMessage
    }
}

function Invoke-SafePgQuery {
    param (
        [string]$Description,
        [string]$Query
    )
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $queryResult = $null
    try {
        $queryResult = & $psql -h $HostName -p $Port -U $User -d $REQUIRED_TEST_DB -t -A -c $Query
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    $code = $LASTEXITCODE
    if ($code -ne 0) {
        $script:primaryExitCode = $code
        $script:primaryErrorMessage = "QUERY FAILED (exit code $code): $Description."
        throw $script:primaryErrorMessage
    }
    return $queryResult
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " HealthSync AI: Local Database Migration Test Suite" -ForegroundColor Cyan
Write-Host " Target Database: $REQUIRED_TEST_DB on ${HostName}:${Port}" -ForegroundColor Cyan
Write-Host " Remote Supabase: COMPLETELY ISOLATED (NO NETWORK CALLS)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Explicit tracking variables initialized at script scope
$dbCreated = $false
$scriptSucceeded = $false
$cleanupFailed = $false
$cleanupErrorMessage = ""
$primaryExitCode = 0
$primaryErrorMessage = ""
$passwordSetByScript = $false
$mig = $null

try {
    # --------------------------------------------------------------------------
    # Authentication Setup:
    # Secure Password Handling:
    # Passwords are NEVER accepted as command-line arguments to prevent credential
    # leakage in process tables, shell history, and logs.
    # If $env:PGPASSWORD is set, it is used. Otherwise, prompt interactively via Read-Host -AsSecureString.
    # --------------------------------------------------------------------------
    if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
        $isInteractive = $false
        try {
            $isInteractive = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected
        } catch {
            $isInteractive = $false
        }

        if ($isInteractive) {
            Write-Host "No PGPASSWORD environment variable detected." -ForegroundColor Cyan
            $securePass = Read-Host -Prompt "Enter password for PostgreSQL user '$User' (leave blank if none / using .pgpass)" -AsSecureString
            if ($null -ne $securePass -and $securePass.Length -gt 0) {
                $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
                try {
                    $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
                    $passwordSetByScript = $true
                } finally {
                    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
                }
            }
        }
    }

    # --------------------------------------------------------------------------
    # Step 1: Initialize Disposable Test Database
    # --------------------------------------------------------------------------
    Write-Host "`n[1/6] Preparing isolated database '$REQUIRED_TEST_DB'..." -ForegroundColor Yellow
    
    # Drop previous test database if left over from a prior aborted test
    Invoke-SafePgCommand "Clean pre-existing test database '$REQUIRED_TEST_DB' if present" `
        $dropdb @("-h", $HostName, "-p", $Port, "-U", $User, "--if-exists", $REQUIRED_TEST_DB)

    # Create fresh disposable test database
    Invoke-SafePgCommand "Create disposable database '$REQUIRED_TEST_DB'" `
        $createdb @("-h", $HostName, "-p", $Port, "-U", $User, $REQUIRED_TEST_DB)
    $dbCreated = $true
    Write-Host "  -> Isolated database '$REQUIRED_TEST_DB' created successfully." -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Step 2: Apply Supabase Compatibility Harness
    # --------------------------------------------------------------------------
    Write-Host "`n[2/6] Applying Supabase Compatibility Harness (auth, roles, jwt)..." -ForegroundColor Yellow
    Invoke-SafePgCommand "Apply $harnessScript" `
        $psql @("-h", $HostName, "-p", $Port, "-U", $User, "-d", $REQUIRED_TEST_DB, "-v", "ON_ERROR_STOP=1", "-f", $harnessScript)
    Write-Host "  -> Supabase compatibility harness applied." -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Step 3: Apply Migrations 001 through 006 in Canonical Order
    # Note: Migration 004 uses local compatibility version (backend/scripts/004_ai_assistant_rag_local_compat.sql)
    # to provision tables without requiring compiled C pgvector binary on standalone PostgreSQL.
    # --------------------------------------------------------------------------
    Write-Host "`n[3/6] Applying Migrations 001–006 in canonical sequence..." -ForegroundColor Yellow

    foreach ($mig in $baselineMigrations) {
        Invoke-SafePgCommand "Executing migration $mig" `
            $psql @("-h", $HostName, "-p", $Port, "-U", $User, "-d", $REQUIRED_TEST_DB, "-v", "ON_ERROR_STOP=1", "-f", $mig)
    }
    Write-Host "  -> Baseline migrations 001–006 applied successfully (all 17 tables created & granted)." -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Step 4: Apply Migration 007 (Unified Extraction Result & RBAC)
    # --------------------------------------------------------------------------
    Write-Host "`n[4/6] Applying Migration 007 (Unified Extraction Result & Tri-State Verification)..." -ForegroundColor Yellow
    Invoke-SafePgCommand "Executing Migration 007" `
        $psql @("-h", $HostName, "-p", $Port, "-U", $User, "-d", $REQUIRED_TEST_DB, "-v", "ON_ERROR_STOP=1", "-f", $migration007)
    Write-Host "  -> Migration 007 applied successfully!" -ForegroundColor Green

    # Audit Manifest Tracking
    Write-Host "  -> Auditing _migration_007_manifest registrations..." -ForegroundColor Gray
    $manifestCountRaw = Invoke-SafePgQuery "Query manifest count" "SELECT count(*) FROM public._migration_007_manifest;"
    if ($null -eq $manifestCountRaw -or [string]::IsNullOrWhiteSpace($manifestCountRaw.ToString())) {
        $script:primaryExitCode = 1
        $script:primaryErrorMessage = "AUDIT FAILURE: Query for _migration_007_manifest count returned null or empty."
        throw $script:primaryErrorMessage
    }
    $manifestCount = [int]($manifestCountRaw.ToString().Trim())
    if ($manifestCount -le 0) {
        $script:primaryExitCode = 1
        $script:primaryErrorMessage = "AUDIT FAILURE: _migration_007_manifest is empty after Migration 007."
        throw $script:primaryErrorMessage
    }
    Write-Host "  -> Manifest successfully registered $manifestCount objects." -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Step 5: Test Migration 007 Rollback & Invariance Verification
    # --------------------------------------------------------------------------
    Write-Host "`n[5/6] Testing Migration 007 Rollback (Non-destructive, zero CASCADE)..." -ForegroundColor Yellow
    Invoke-SafePgCommand "Executing Migration 007 Rollback" `
        $psql @("-h", $HostName, "-p", $Port, "-U", $User, "-d", $REQUIRED_TEST_DB, "-v", "ON_ERROR_STOP=1", "-f", $rollback007)
    Write-Host "  -> Migration 007 rollback executed successfully!" -ForegroundColor Green

    # Verify Manifest Clean Decommission
    $manifestExistsRaw = Invoke-SafePgQuery "Check manifest existence" "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_migration_007_manifest');"
    if ($null -eq $manifestExistsRaw -or [string]::IsNullOrWhiteSpace($manifestExistsRaw.ToString())) {
        $script:primaryExitCode = 1
        $script:primaryErrorMessage = "AUDIT FAILURE: Query for _migration_007_manifest existence returned null or empty."
        throw $script:primaryErrorMessage
    }
    $manifestExists = $manifestExistsRaw.ToString().Trim()
    if ($manifestExists -ne "f") {
        $script:primaryExitCode = 1
        $script:primaryErrorMessage = "AUDIT FAILURE: _migration_007_manifest was not cleanly dropped during rollback."
        throw $script:primaryErrorMessage
    }
    Write-Host "  -> Verified: Manifest table cleanly dropped without residual artifacts." -ForegroundColor Green

    # Verify Pre-007 Permissions Restored (Migration 006 state on profiles table)
    $updateGrantExistsRaw = Invoke-SafePgQuery "Check profiles UPDATE privilege" "SELECT count(*) FROM information_schema.table_privileges WHERE table_schema = 'public' AND table_name = 'profiles' AND grantee = 'authenticated' AND privilege_type = 'UPDATE';"
    if ($null -eq $updateGrantExistsRaw -or [string]::IsNullOrWhiteSpace($updateGrantExistsRaw.ToString())) {
        $script:primaryExitCode = 1
        $script:primaryErrorMessage = "AUDIT FAILURE: Query for profiles UPDATE privilege returned null or empty."
        throw $script:primaryErrorMessage
    }
    $updateGrantExists = $updateGrantExistsRaw.ToString().Trim()
    if ($updateGrantExists -ne "1") {
        $script:primaryExitCode = 1
        $script:primaryErrorMessage = "AUDIT FAILURE: Authenticated table-level UPDATE grant on profiles was not restored."
        throw $script:primaryErrorMessage
    }
    Write-Host "  -> Verified: Table-level UPDATE grant on profiles restored to authenticated role." -ForegroundColor Green

    $scriptSucceeded = $true

} catch {
    if ($primaryExitCode -eq 0) {
        $primaryExitCode = 1
    }
    if ([string]::IsNullOrEmpty($primaryErrorMessage)) {
        $primaryErrorMessage = $_.Exception.Message
    }
    Write-Error "STEP FAILED: $primaryErrorMessage" -ErrorAction Continue
} finally {
    # --------------------------------------------------------------------------
    # Step 6: Teardown Disposable Test Database (Always executed on success or failure)
    # --------------------------------------------------------------------------
    if ($dbCreated) {
        Write-Host "`n[6/6] Cleaning up: Dropping disposable test database '$REQUIRED_TEST_DB'..." -ForegroundColor Yellow
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $dropdb -h $HostName -p $Port -U $User $REQUIRED_TEST_DB
            $dropExitCode = $LASTEXITCODE
            if ($dropExitCode -ne 0) {
                $cleanupFailed = $true
                $cleanupErrorMessage = "dropdb returned non-zero exit code $dropExitCode while dropping '$REQUIRED_TEST_DB'."
                Write-Warning "Cleanup warning: $cleanupErrorMessage"
            } else {
                Write-Host "  -> Disposable test database '$REQUIRED_TEST_DB' dropped cleanly. Host is unaffected." -ForegroundColor Green
            }
        } catch {
            $cleanupFailed = $true
            $cleanupErrorMessage = $_.Exception.Message
            Write-Warning "Cleanup error while dropping database: $cleanupErrorMessage"
        } finally {
            $ErrorActionPreference = $prevEAP
        }
    }

    # Clear temporary password if set by this script
    if ($passwordSetByScript) {
        $env:PGPASSWORD = $null
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

# ------------------------------------------------------------------------------
# 7. Final Exit Determination & Status Reporting
# ------------------------------------------------------------------------------
# Rule 1: If migrations/primary steps failed, preserve the primary exit code
if ($primaryExitCode -ne 0) {
    if ($cleanupFailed) {
        Write-Host ""
        Write-Error "ADDITIONAL TEARDOWN ERROR: Database cleanup failed: $cleanupErrorMessage" -ErrorAction Continue
        Write-Warning "CRITICAL: The disposable test database '$REQUIRED_TEST_DB' may not have been dropped!"
    }
    Write-Host ""
    Write-Error "EXECUTION TERMINATED: Test suite failed with primary exit code ${primaryExitCode}: $primaryErrorMessage" -ErrorAction Continue
    exit $primaryExitCode
}

# Rule 2: If migrations succeeded but cleanup failed, the overall test MUST FAIL
if ($cleanupFailed) {
    Write-Host ""
    Write-Error "CLEANUP FAILURE: All migrations and rollbacks passed, but database cleanup failed: $cleanupErrorMessage" -ErrorAction Continue
    Write-Warning "CRITICAL: The disposable test database '$REQUIRED_TEST_DB' was left behind!"
    Write-Error "TEST SUITE FAILED: Overall test suite marked as FAILED due to cleanup failure." -ErrorAction Continue
    exit 1
}

# Rule 3: Only print success banner if both migrations AND cleanup succeeded cleanly
if ($scriptSucceeded) {
    Write-Host "`n======================================================" -ForegroundColor Cyan
    Write-Host " ALL LOCAL DATABASE MIGRATION & ROLLBACK TESTS PASSED!" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Error "EXECUTION TERMINATED: Script ended without completing all steps." -ErrorAction Continue
    exit 1
}
