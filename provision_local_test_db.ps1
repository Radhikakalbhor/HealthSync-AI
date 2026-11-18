# ==============================================================================
# HealthSync AI -- Safe Local Test Database Provisioner
# Provisions 'healthsync_local_test' with Migrations 001-007 and KEEPS it active
# for Python-to-PostgreSQL integration testing.
#
# STRICT SAFETY GUARANTEES:
# - Target database is hard-restricted to 'healthsync_local_test' ONLY.
# - Connects strictly to 127.0.0.1 / localhost (never connects to hosted Supabase).
# - Zero passwords permitted in command-line arguments (uses secure prompt or $env:PGPASSWORD).
# - Keeps 'healthsync_local_test' intact after migration (does NOT roll back or drop).
# - Halts immediately on any SQL or command failure ($LASTEXITCODE check).
# ==============================================================================

[CmdletBinding()]
param (
    [string]$PgBinPath = "C:\Program Files\PostgreSQL\18\bin",
    [string]$HostName = "127.0.0.1",
    [int]$Port = 5432,
    [string]$User = "postgres",
    [string]$TestDbName = "healthsync_local_test",
    [switch]$Force = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ------------------------------------------------------------------------------
# Pre-declare all script-scope variables to satisfy Set-StrictMode -Version Latest
# ------------------------------------------------------------------------------
$bin = $null
$file = $null
$mig = $null
$migIndex = 0
$migTotal = 0
$migArgs = $null
$rpc = $null
$rpcIndex = 0
$rpcTotal = 0
$rpcCheckQuery = $null
$rpcExistsRaw = $null
$rpcCount = 0
$manifestCountRaw = $null
$manifestCount = 0
$dbExists = $false
$confirm = $null
$dropArgs = $null
$createArgs = $null
$harnessArgs = $null
$passwordSetByScript = $false
$isInteractive = $false
$securePass = $null
$bstr = [IntPtr]::Zero

# ------------------------------------------------------------------------------
# 1. Database Safety & Confinement Checks
# ------------------------------------------------------------------------------
$REQUIRED_TEST_DB = "healthsync_local_test"

if ($TestDbName -ne $REQUIRED_TEST_DB) {
    Write-Error "CRITICAL SAFETY VIOLATION: TestDbName is hard-restricted to '$REQUIRED_TEST_DB'. Provided: '$TestDbName'. Execution aborted."
    exit 1
}

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

$requiredBins = @($psql, $createdb, $dropdb)
foreach ($bin in $requiredBins) {
    if (-not (Test-Path $bin)) {
        Write-Error "PostgreSQL binary missing: '$bin'. Check PgBinPath."
        exit 1
    }
}

# ------------------------------------------------------------------------------
# 3. Canonical Migration Sequence & Path Normalization
# ------------------------------------------------------------------------------
$baseDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($baseDir)) {
    $baseDir = (Get-Location).Path
}

$harnessScript = Join-Path $baseDir "backend/scripts/supabase_test_harness.sql"

$migrations = @(
    (Join-Path $baseDir "backend/migrations/001_initial_schema.sql"),
    (Join-Path $baseDir "backend/migrations/002_row_level_security.sql"),
    (Join-Path $baseDir "backend/migrations/003_medication_reminders.sql"),
    (Join-Path $baseDir "backend/scripts/004_ai_assistant_rag_local_compat.sql"),
    (Join-Path $baseDir "backend/migrations/005_advanced_intelligence.sql"),
    (Join-Path $baseDir "backend/migrations/006_table_privileges.sql"),
    (Join-Path $baseDir "backend/migrations/007_unified_extraction_result.sql")
)

$allRequiredFiles = @($harnessScript) + $migrations
foreach ($file in $allRequiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error "Required migration/script file missing: '$file'. Execution aborted."
        exit 1
    }
}

# ------------------------------------------------------------------------------
# 4. Command Execution Helpers
# ------------------------------------------------------------------------------
function Invoke-SafePgCommand {
    param (
        [string]$Description,
        [string]$Executable,
        [string[]]$Arguments
    )
    Write-Host "  -> $Description" -ForegroundColor Gray

    # In PowerShell 5.1, native commands writing NOTICE/WARNING messages
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
        throw "COMMAND FAILED (exit code $code): $Description."
    }
}

function Invoke-SafePgQuery {
    param (
        [string]$Description,
        [string]$Query,
        [string]$TargetDb = $REQUIRED_TEST_DB
    )
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $queryResult = $null
    try {
        $queryResult = & $psql -h $HostName -p $Port -U $User -d $TargetDb -t -A -c $Query
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    $code = $LASTEXITCODE
    if ($code -ne 0) {
        throw "QUERY FAILED (exit code $code): $Description."
    }
    return $queryResult
}

function Test-DatabaseExists {
    param (
        [string]$DbName
    )
    $query = "SELECT count(*) FROM pg_database WHERE datname = '$DbName';"
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $raw = $null
    try {
        $raw = & $psql -h $HostName -p $Port -U $User -d "postgres" -t -A -c $query
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        throw "DATABASE EXISTENCE CHECK FAILED (exit code $code). Could not query 'postgres' database on ${HostName}:${Port}. Verify credentials and connection."
    }
    if ($null -eq $raw) {
        return $false
    }
    $trimmed = $raw.ToString().Trim()
    if ([string]::IsNullOrEmpty($trimmed)) {
        return $false
    }
    return ([int]$trimmed -gt 0)
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " HealthSync AI: Local Test Database Provisioner" -ForegroundColor Cyan
Write-Host " Target Database: $REQUIRED_TEST_DB on ${HostName}:${Port}" -ForegroundColor Cyan
Write-Host " Mode: PROVISION AND KEEP (NO DROP ON COMPLETION)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 5. Secure Interactive Password Handling
# ------------------------------------------------------------------------------
if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
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

try {
    # --------------------------------------------------------------------------
    # Step 1: Pre-drop Existence Check & Explicit Confirmation
    # --------------------------------------------------------------------------
    Write-Host "`n[1/4] Checking existence of '$REQUIRED_TEST_DB'..." -ForegroundColor Yellow
    $dbExists = Test-DatabaseExists -DbName $REQUIRED_TEST_DB

    if ($dbExists) {
        Write-Warning "Database '$REQUIRED_TEST_DB' already exists on ${HostName}:${Port}."
        if (-not $Force) {
            $confirm = $null
            if ($isInteractive) {
                $confirm = Read-Host -Prompt "Do you want to drop and re-provision '$REQUIRED_TEST_DB'? Type 'YES' to confirm"
            }
            if ($confirm -ne "YES") {
                Write-Host "Provisioning cancelled by user. Existing database was NOT modified or dropped." -ForegroundColor Yellow
                exit 0
            }
        }
        Write-Host "  -> Confirmation received. Dropping existing '$REQUIRED_TEST_DB'..." -ForegroundColor Yellow
        $dropArgs = @("-h", $HostName, "-p", [string]$Port, "-U", $User, "--force", $REQUIRED_TEST_DB)
        Invoke-SafePgCommand -Description "Drop existing test database '$REQUIRED_TEST_DB'" -Executable $dropdb -Arguments $dropArgs
        Write-Host "  [OK] Previous test database dropped cleanly." -ForegroundColor Green
    } else {
        Write-Host "  -> Verified: Database '$REQUIRED_TEST_DB' does not exist yet. Clean to proceed." -ForegroundColor Green
    }

    $createArgs = @("-h", $HostName, "-p", [string]$Port, "-U", $User, $REQUIRED_TEST_DB)
    Invoke-SafePgCommand -Description "Create disposable database '$REQUIRED_TEST_DB'" -Executable $createdb -Arguments $createArgs
    Write-Host "  [OK] Isolated database '$REQUIRED_TEST_DB' created successfully." -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Step 2: Apply Supabase Compatibility Harness
    # --------------------------------------------------------------------------
    Write-Host "`n[2/4] Applying Supabase Compatibility Harness (auth, roles, jwt)..." -ForegroundColor Yellow
    $harnessArgs = @(
        "-h", $HostName,
        "-p", [string]$Port,
        "-U", $User,
        "-d", $REQUIRED_TEST_DB,
        "-v", "ON_ERROR_STOP=1",
        "-f", $harnessScript
    )
    Invoke-SafePgCommand -Description "Apply $harnessScript" -Executable $psql -Arguments $harnessArgs
    Write-Host "  [OK] Supabase compatibility harness applied successfully." -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Step 3: Apply Migrations 001 through 007 in Sequence
    # --------------------------------------------------------------------------
    Write-Host "`n[3/4] Applying Migrations 001-007 in canonical sequence..." -ForegroundColor Yellow
    $migIndex = 0
    $migTotal = $migrations.Count
    foreach ($mig in $migrations) {
        $migIndex++
        Write-Host "`n  --------------------------------------------------" -ForegroundColor DarkGray
        Write-Host "  [$migIndex/$migTotal] Executing migration: $mig" -ForegroundColor Cyan
        Write-Host "  --------------------------------------------------" -ForegroundColor DarkGray
        $migArgs = @(
            "-h", $HostName,
            "-p", [string]$Port,
            "-U", $User,
            "-d", $REQUIRED_TEST_DB,
            "-v", "ON_ERROR_STOP=1",
            "-f", $mig
        )
        Invoke-SafePgCommand -Description "Execute migration $mig" -Executable $psql -Arguments $migArgs
        Write-Host "  [OK] Migration [$migIndex/$migTotal] applied successfully." -ForegroundColor Green
    }
    Write-Host "`n  -> All 7 migrations (001-007) applied successfully!" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # Step 4: Verify Migration 007 Manifest & RPCs
    # --------------------------------------------------------------------------
    Write-Host "`n[4/4] Verifying database schema & Migration 007 RPCs..." -ForegroundColor Yellow
    
    # 1. Manifest count verification
    $manifestCountRaw = Invoke-SafePgQuery -Description "Query manifest count" -Query "SELECT count(*) FROM public._migration_007_manifest;"
    $manifestCount = [int]($manifestCountRaw.ToString().Trim())
    if ($manifestCount -lt 1) {
        throw "VERIFICATION ERROR: _migration_007_manifest is empty."
    }
    Write-Host "  [OK] Verified: _migration_007_manifest registered $manifestCount objects." -ForegroundColor Green

    # 2. Migration 007 RPC verification
    $expectedRpcList = @(
        "save_document_extraction_atomic",
        "save_document_patient_review_atomic",
        "verify_document_as_clinician_atomic",
        "_sync_document_relational_projections",
        "prevent_profile_role_self_promotion"
    )

    $rpcIndex = 0
    $rpcTotal = $expectedRpcList.Count
    foreach ($rpc in $expectedRpcList) {
        $rpcIndex++
        $rpcCheckQuery = "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = '$rpc';"
        $rpcExistsRaw = Invoke-SafePgQuery -Description "Verify RPC $rpc" -Query $rpcCheckQuery
        $rpcCount = [int]($rpcExistsRaw.ToString().Trim())
        if ($rpcCount -lt 1) {
            throw "VERIFICATION ERROR: Required RPC function '$rpc' was not found in schema public."
        }
        Write-Host "  [OK] Verified RPC [$rpcIndex/$rpcTotal]: public.$rpc" -ForegroundColor Green
    }

    Write-Host "`n======================================================" -ForegroundColor Cyan
    Write-Host " DATABASE '$REQUIRED_TEST_DB' PROVISIONED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host " Status: KEPT ACTIVE FOR LIVE INTEGRATION TESTS" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Cyan
    exit 0

} catch {
    Write-Error "PROVISIONING FAILED: $_"
    exit 1
} finally {
    if ($passwordSetByScript) {
        $env:PGPASSWORD = $null
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}
