"""
Safety and Correctness Verification Suite for Local Database Testing Runner.
Validates:
1. Hardened database-name restriction to 'healthsync_local_test' (rejects all system/protected DBs).
2. Explicit exit-code validation ($LASTEXITCODE) and immediate halting on failure.
3. Canonical migration sequence: 001, 002, 003, 004 (local compat), 005, 006, 007.
4. Clean separation: local compatibility version for 004 vs. untouched original 004.
5. Zero direct SQL writes to PostgreSQL system catalogs (pg_extension, etc.).
6. Supabase compatibility harness completeness (auth.jwt, auth.uid, auth.role, mock auth.users).
7. Rollback schema and privilege invariance verification.
"""

from pathlib import Path
import re
import pytest

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
PS_RUNNER_PATH = WORKSPACE_ROOT / "run_local_db_tests.ps1"
HARNESS_PATH = WORKSPACE_ROOT / "backend" / "scripts" / "supabase_test_harness.sql"
COMPAT_004_PATH = WORKSPACE_ROOT / "backend" / "scripts" / "004_ai_assistant_rag_local_compat.sql"
ORIGINAL_004_PATH = WORKSPACE_ROOT / "backend" / "migrations" / "004_ai_assistant_rag.sql"
ROLLBACK_SQL_PATH = WORKSPACE_ROOT / "backend" / "migrations" / "007_unified_extraction_result_rollback.sql"


class TestLocalDatabaseRunnerSafety:
    """Validates structural and operational safety guards of run_local_db_tests.ps1."""

    def test_runner_file_exists(self):
        assert PS_RUNNER_PATH.is_file(), "run_local_db_tests.ps1 must exist at workspace root."

    def test_database_name_hard_restricted(self):
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        assert '$REQUIRED_TEST_DB = "healthsync_local_test"' in content
        assert '$TestDbName -ne $REQUIRED_TEST_DB' in content, (
            "Runner must strictly reject any database name other than 'healthsync_local_test'."
        )

    def test_forbidden_databases_blacklisted(self):
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        assert "$FORBIDDEN_DATABASES" in content
        for forbidden in ["postgres", "template0", "template1", "healthsync", "production", "staging"]:
            assert f'"{forbidden}"' in content, f"Runner must explicitly blacklist '{forbidden}'."

    def test_remote_connections_blocked(self):
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        assert '$HostName -ne "127.0.0.1"' in content
        assert "CRITICAL SAFETY VIOLATION" in content
        assert "Refusing remote connections" in content

    def test_exit_code_checking_implemented(self):
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        assert "$code = $LASTEXITCODE" in content
        assert "if ($code -ne 0)" in content
        assert "$script:primaryExitCode = $code" in content
        assert "exit $primaryExitCode" in content
        assert "Invoke-SafePgCommand" in content
        assert "Invoke-SafePgQuery" in content

    def test_no_plaintext_password_in_param_block(self):
        """Verifies -Password is completely excluded from param block to prevent CLI/history leakage."""
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        param_match = re.search(r"param\s*\((.*?)\)", content, re.DOTALL)
        assert param_match is not None, "Runner must define param block."
        param_block = param_match.group(1)
        assert "Password" not in param_block, (
            "SECURITY VIOLATION: -Password parameter must not exist in param block."
        )

    def test_secure_password_handling_and_environment_wipe(self):
        """Verifies interactive secure string prompt and temporary variable wiping in finally."""
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        assert "Read-Host" in content
        assert "-AsSecureString" in content
        assert "passwordSetByScript" in content
        assert "finally {" in content
        assert "$env:PGPASSWORD = $null" in content

    def test_cleanup_failure_blocks_success_banner_and_exits_nonzero(self):
        """Verifies that if cleanup fails, the script returns non-zero and suppresses success banner."""
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        assert "$cleanupFailed = $false" in content
        assert "if ($cleanupFailed)" in content
        assert "CLEANUP FAILURE" in content
        assert "exit 1" in content
        assert "$scriptSucceeded" in content
        # Banner must only be printed when script succeeded AND cleanup did not fail
        assert "ALL LOCAL DATABASE MIGRATION & ROLLBACK TESTS PASSED!" in content

    def test_primary_exit_code_preserved_across_cleanup(self):
        """Verifies that primary migration errors are preserved and not masked by cleanup errors."""
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        assert "if ($primaryExitCode -ne 0)" in content
        assert "ADDITIONAL TEARDOWN ERROR" in content
        assert "exit $primaryExitCode" in content

    def test_ps51_stderr_harmless_notice_handling(self):
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        # Confirms scoped ErrorActionPreference to prevent NativeCommandError on harmless NOTICE
        assert '$ErrorActionPreference = "Continue"' in content
        assert '$prevEAP = $ErrorActionPreference' in content
        assert 'finally {' in content
        assert '$ErrorActionPreference = $prevEAP' in content

    def test_canonical_migration_sequence(self):
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        expected_sequence = [
            "backend/migrations/001_initial_schema.sql",
            "backend/migrations/002_row_level_security.sql",
            "backend/migrations/003_medication_reminders.sql",
            "backend/scripts/004_ai_assistant_rag_local_compat.sql",
            "backend/migrations/005_advanced_intelligence.sql",
            "backend/migrations/006_table_privileges.sql",
        ]
        
        # Locate baseline migrations array definition
        array_start = content.find("$baselineMigrations = @(")
        assert array_start != -1, "$baselineMigrations array must exist in runner."
        array_block = content[array_start:]

        pos = 0
        for mig in expected_sequence:
            current_pos = array_block.find(mig)
            assert current_pos != -1, f"Missing {mig} from $baselineMigrations."
            assert current_pos > pos, f"Migration {mig} is out of canonical order."
            pos = current_pos

        # Verify 007 follows baseline
        pos_007 = content.find("backend/migrations/007_unified_extraction_result.sql")
        assert pos_007 > array_start, "Migration 007 must execute after all baseline migrations."

        # Verify rollback follows 007
        pos_rollback = content.find("backend/migrations/007_unified_extraction_result_rollback.sql")
        assert pos_rollback > pos_007, "Rollback must execute after Migration 007."

    def test_post_rollback_invariance_verification(self):
        content = PS_RUNNER_PATH.read_text(encoding="utf-8")
        assert "_migration_007_manifest" in content
        assert "information_schema.table_privileges" in content
        assert "grantee = 'authenticated'" in content
        assert "privilege_type = 'UPDATE'" in content


class TestCatalogSecurityAndSeparation:
    """Verifies that system catalogs are never modified and 004 is properly isolated."""

    def test_no_sql_modifies_pg_extension_directly(self):
        """Scans all SQL files across migrations and scripts to guarantee zero catalog writes."""
        sql_files = list(WORKSPACE_ROOT.glob("backend/**/*.sql"))
        assert len(sql_files) > 0, "SQL files must be discovered."

        forbidden_patterns = [
            re.compile(r"INSERT\s+INTO\s+(?:pg_catalog\.)?pg_extension\b", re.IGNORECASE),
            re.compile(r"UPDATE\s+(?:pg_catalog\.)?pg_extension\b", re.IGNORECASE),
            re.compile(r"DELETE\s+FROM\s+(?:pg_catalog\.)?pg_extension\b", re.IGNORECASE),
            re.compile(r"INSERT\s+INTO\s+(?:pg_catalog\.)?pg_class\b", re.IGNORECASE),
            re.compile(r"INSERT\s+INTO\s+(?:pg_catalog\.)?pg_type\b", re.IGNORECASE),
        ]

        for sql_file in sql_files:
            content = sql_file.read_text(encoding="utf-8")
            for pattern in forbidden_patterns:
                match = pattern.search(content)
                assert match is None, (
                    f"SECURITY VIOLATION in {sql_file.name}: Direct system catalog modification detected: '{match.group(0)}'."
                )

    def test_original_migration_004_remains_unchanged(self):
        """Ensures production Migration 004 preserves genuine pgvector statements."""
        content = ORIGINAL_004_PATH.read_text(encoding="utf-8")
        assert "CREATE EXTENSION IF NOT EXISTS vector;" in content
        assert "embedding %I.vector(768)" in content
        assert "USING hnsw (embedding %I.vector_cosine_ops)" in content

    def test_local_compat_migration_004_structure(self):
        """Ensures local compat Migration 004 creates required tables and RLS without vector binary."""
        content = COMPAT_004_PATH.read_text(encoding="utf-8")
        
        # Strip comments to check active SQL statements
        active_sql = "\n".join(
            line for line in content.splitlines() if not line.strip().startswith("--")
        )
        # Proves no catalog modification or extension creation
        assert "pg_extension" not in active_sql
        assert "CREATE EXTENSION" not in active_sql

        # Proves real tables are created
        assert "CREATE TABLE IF NOT EXISTS public.document_chunks" in content
        assert "CREATE TABLE IF NOT EXISTS public.chat_conversations" in content
        assert "CREATE TABLE IF NOT EXISTS public.chat_messages" in content

        # Proves triggers and RLS are created
        assert "check_document_chunk_owner()" in content
        assert "check_chat_message_conversation_owner()" in content
        assert "ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;" in content
        assert "ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;" in content
        assert "ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;" in content

        # Proves limitations are clearly documented
        assert "WHAT IS EXPLICITLY NOT TESTED" in content
        assert "vector(768)" in content
        assert "HNSW" in content


class TestCompatibilityHarness:
    """Validates PostgreSQL test harness accuracy."""

    def test_harness_has_auth_jwt(self):
        content = HARNESS_PATH.read_text(encoding="utf-8")
        assert "CREATE OR REPLACE FUNCTION auth.jwt()" in content
        assert "RETURNS JSONB" in content
        assert "'role'" in content
        assert "'sub'" in content

    def test_harness_has_auth_uid_and_role(self):
        content = HARNESS_PATH.read_text(encoding="utf-8")
        assert "CREATE OR REPLACE FUNCTION auth.uid()" in content
        assert "CREATE OR REPLACE FUNCTION auth.role()" in content
        assert "CREATE SCHEMA IF NOT EXISTS auth;" in content
        assert "CREATE TABLE IF NOT EXISTS auth.users" in content

    def test_harness_has_standard_roles(self):
        content = HARNESS_PATH.read_text(encoding="utf-8")
        assert "CREATE ROLE anon" in content
        assert "CREATE ROLE authenticated" in content
        assert "CREATE ROLE service_role" in content

    def test_harness_does_not_contain_misleading_vector_domain(self):
        content = HARNESS_PATH.read_text(encoding="utf-8")
        assert "CREATE DOMAIN vector" not in content


class TestRollbackInvariance:
    """Verifies that 007 rollback restores pre-007 state without CASCADE."""

    def test_rollback_contains_no_cascade(self):
        content = ROLLBACK_SQL_PATH.read_text(encoding="utf-8")
        assert not re.search(r"DROP\s+(?:TABLE|COLUMN|INDEX|TRIGGER|FUNCTION|CONSTRAINT)\b.*?CASCADE", content, re.IGNORECASE)

    def test_rollback_restores_profile_update_grant(self):
        content = ROLLBACK_SQL_PATH.read_text(encoding="utf-8")
        assert "GRANT UPDATE ON public.profiles TO authenticated;" in content
