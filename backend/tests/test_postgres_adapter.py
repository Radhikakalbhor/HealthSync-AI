"""
Unit and Integration Tests for Native Direct PostgreSQL Adapter (backend/app/core/db.py).
Tests:
- Configuration detection and validation (is_direct_db_configured)
- Security checks: rejection of hosted Supabase URLs (*.supabase.co, *.supabase.in, *.supabase.net)
- Safety: invalid scheme rejection (must be postgresql:// or postgres://)
- UUID and role allowlist validation
- Connection pool initialization and lifecycle (get_pool, close, reset, ping)
- Transaction management: commit and rollback behavior
- Secure RLS session configuration: set_config(..., is_local=true) and SET LOCAL ROLE
- Cross-user claim isolation (guaranteed cleanup after transaction)
- Connection cleanup after exceptions
- Helper query functions (execute_query, execute_scalar, execute_mutation)
- Backward compatibility: default Supabase mode remains default
"""

from unittest.mock import MagicMock, patch
import pytest

from backend.app.core.config import settings
from backend.app.core.db import (
    ALLOWED_RLS_ROLES,
    DatabaseConfigurationException,
    DatabaseConnectionException,
    DatabaseException,
    DatabaseSecurityException,
    PostgresAdapter,
    execute_mutation,
    execute_query,
    execute_scalar,
    get_db_connection,
    get_db_transaction,
    get_rls_connection,
    is_direct_db_configured,
    validate_database_url,
    validate_uuid,
)


def create_mock_pool_and_conn():
    """Helper to create a properly configured mock pool and connection."""
    mock_pool = MagicMock()
    mock_pool.closed = False
    mock_conn = MagicMock()
    mock_conn.closed = False
    mock_cur = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_conn.transaction.return_value.__enter__.return_value = mock_conn
    mock_pool.getconn.return_value = mock_conn
    return mock_pool, mock_conn, mock_cur


class TestAdapterConfigurationAndSecurity:
    """Tests configuration detection and defensive security guards."""

    def test_default_mode_is_not_direct_db(self, monkeypatch):
        """Verifies direct DB adapter is opt-in and False by default."""
        monkeypatch.setattr(settings, "HEALTHSYNC_DATABASE_URL", None)
        assert is_direct_db_configured() is False

        monkeypatch.setattr(settings, "HEALTHSYNC_DATABASE_URL", "")
        assert is_direct_db_configured() is False

    def test_opt_in_when_database_url_configured(self, monkeypatch):
        """Verifies direct DB adapter is True when explicitly configured."""
        monkeypatch.setattr(
            settings, "HEALTHSYNC_DATABASE_URL", "postgresql://postgres:secret@127.0.0.1:5432/healthsync_local_test"
        )
        assert is_direct_db_configured() is True

    def test_missing_url_raises_configuration_exception(self):
        """Verifies empty or missing URL raises DatabaseConfigurationException."""
        with pytest.raises(DatabaseConfigurationException) as exc:
            validate_database_url("")
        assert "HEALTHSYNC_DATABASE_URL is not configured" in str(exc.value)

    def test_invalid_scheme_rejected(self):
        """Verifies non-postgresql schemes (e.g. http://, mysql://) are rejected."""
        with pytest.raises(DatabaseConfigurationException) as exc:
            validate_database_url("http://127.0.0.1:5432/test")
        assert "Invalid database URL scheme" in str(exc.value)

    def test_hosted_supabase_urls_strictly_forbidden(self):
        """Verifies adapter strictly forbids pointing at hosted Supabase endpoints."""
        forbidden_urls = [
            "postgresql://postgres:pass@db.xyz.supabase.co:5432/postgres",
            "postgres://postgres:pass@db.xyz.supabase.in:5432/postgres",
            "postgresql://postgres:pass@aws-0-us-west-1.pooler.supabase.net:6543/postgres",
        ]
        for url in forbidden_urls:
            with pytest.raises(DatabaseSecurityException) as exc:
                validate_database_url(url)
            assert "CRITICAL SAFETY VIOLATION" in str(exc.value)
            assert "hosted Supabase" in str(exc.value)

    def test_valid_local_url_accepted(self):
        """Verifies valid local PostgreSQL connection strings pass validation."""
        valid_url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        assert validate_database_url(valid_url) == valid_url

    def test_uuid_validation_blocks_injection(self):
        """Verifies validate_uuid rejects malformed or SQL-injected user IDs."""
        valid_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
        assert validate_uuid(valid_id) == valid_id

        malicious_inputs = [
            "admin'; DROP TABLE profiles; --",
            "123-not-a-uuid",
            "'' OR '1'='1'",
            None,
        ]
        for bad in malicious_inputs:
            with pytest.raises(ValueError) as exc:
                validate_uuid(bad)
            assert "Invalid UUID" in str(exc.value)

    def test_exception_status_and_codes(self):
        """Verifies custom database exceptions inherit proper status and error codes."""
        exc_base = DatabaseException("Test message")
        assert exc_base.status_code == 500
        assert exc_base.code == "DATABASE_ERROR"

        exc_cfg = DatabaseConfigurationException("Config error")
        assert exc_cfg.status_code == 500
        assert exc_cfg.code == "DATABASE_CONFIGURATION_ERROR"

        exc_sec = DatabaseSecurityException("Security error")
        assert exc_sec.status_code == 403
        assert exc_sec.code == "DATABASE_SECURITY_ERROR"

        exc_conn = DatabaseConnectionException("Connection error")
        assert exc_conn.status_code == 503
        assert exc_conn.code == "DATABASE_CONNECTION_ERROR"


class TestConnectionPoolLifecycle:
    """Tests connection pool creation, singleton behavior, and cleanup."""

    def setup_method(self):
        PostgresAdapter.reset_instance()

    def teardown_method(self):
        PostgresAdapter.reset_instance()

    def test_singleton_instance_management(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter1 = PostgresAdapter.get_instance(url)
        adapter2 = PostgresAdapter.get_instance()
        assert adapter1 is adapter2

        PostgresAdapter.reset_instance()
        adapter3 = PostgresAdapter.get_instance(url)
        assert adapter3 is not adapter1
        adapter3.close()

    def test_pool_initialization_with_settings(self):
        """Verifies get_pool creates ConnectionPool with configured parameters."""
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)

        with patch("backend.app.core.db.ConnectionPool") as mock_cp_cls:
            mock_pool = MagicMock()
            mock_pool.closed = False
            mock_cp_cls.return_value = mock_pool

            pool = adapter.get_pool()
            assert pool is mock_pool
            mock_cp_cls.assert_called_once()
            call_kwargs = mock_cp_cls.call_args[1]
            assert call_kwargs["conninfo"] == url
            assert call_kwargs["min_size"] == settings.DB_POOL_MIN_SIZE
            assert call_kwargs["max_size"] == settings.DB_POOL_MAX_SIZE
            assert call_kwargs["open"] is True

    def test_pool_initialization_failure_raises_db_connection_exception(self):
        """Verifies failure during pool initialization raises DatabaseConnectionException."""
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)

        with patch("backend.app.core.db.ConnectionPool", side_effect=Exception("Connection refused")):
            with pytest.raises(DatabaseConnectionException) as exc:
                adapter.get_pool()
            assert "Connection pool initialization failed" in str(exc.value)

    def test_pool_closed_cleanly(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool = MagicMock()
        mock_pool.closed = False
        adapter._pool = mock_pool

        adapter.close()
        mock_pool.close.assert_called_once()
        assert adapter._pool is None

    def test_ping_success(self):
        """Verifies ping returns True on successful SELECT 1."""
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        mock_cur.fetchone.return_value = {"?column?": 1}
        adapter._pool = mock_pool

        assert adapter.ping() is True
        mock_cur.execute.assert_called_once_with("SELECT 1;")

    def test_ping_failure(self):
        """Verifies ping returns False when query raises an exception."""
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        mock_cur.execute.side_effect = Exception("DB error")
        adapter._pool = mock_pool

        assert adapter.ping() is False

    def test_connection_returned_to_pool_on_success(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, _ = create_mock_pool_and_conn()
        adapter._pool = mock_pool

        with adapter.connection() as conn:
            assert conn is mock_conn

        mock_pool.getconn.assert_called_once()
        mock_pool.putconn.assert_called_once_with(mock_conn)
        mock_conn.rollback.assert_called()  # Session clean reset

    def test_connection_returned_to_pool_on_exception(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, _ = create_mock_pool_and_conn()
        adapter._pool = mock_pool

        with pytest.raises(DatabaseConnectionException):
            with adapter.connection():
                raise RuntimeError("Simulated DB failure")

        mock_conn.rollback.assert_called()
        mock_pool.putconn.assert_called_once_with(mock_conn)


class TestRLSSessionHandling:
    """Tests transaction-scoped RLS claim injection and cross-user isolation."""

    def setup_method(self):
        PostgresAdapter.reset_instance()

    def teardown_method(self):
        PostgresAdapter.reset_instance()

    def test_rls_claims_and_role_set_in_transaction(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        adapter._pool = mock_pool

        test_user = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
        with get_rls_connection(user_id=test_user, role="authenticated", conninfo=url) as conn:
            assert conn is mock_conn

        # Verify transaction-local set_config calls
        executed_calls = [str(call) for call in mock_cur.execute.mock_calls]
        assert any("request.jwt.claim.sub" in c for c in executed_calls)
        assert any("request.jwt.claim.role" in c for c in executed_calls)
        assert any("SET LOCAL ROLE authenticated" in c for c in executed_calls)

    def test_invalid_rls_role_rejected(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        test_user = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
        with pytest.raises(DatabaseSecurityException) as exc:
            with get_rls_connection(user_id=test_user, role="superuser_admin", conninfo=url):
                pass
        assert "Invalid RLS role" in str(exc.value)

    def test_cross_user_claim_isolation(self):
        """Verifies that separate get_rls_connection calls apply independent user claims."""
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        adapter._pool = mock_pool

        user1 = "11111111-1111-1111-1111-111111111111"
        user2 = "22222222-2222-2222-2222-222222222222"

        with get_rls_connection(user_id=user1, role="authenticated", conninfo=url):
            pass

        with get_rls_connection(user_id=user2, role="authenticated", conninfo=url):
            pass

        # Check call arguments
        calls = mock_cur.execute.call_args_list
        sub_calls = [c for c in calls if len(c[0]) > 1 and (user1 in str(c[0][1]) or user2 in str(c[0][1]))]
        assert len(sub_calls) >= 2


class TestHelperQueryFunctions:
    """Tests execute_query, execute_scalar, and execute_mutation helpers."""

    def setup_method(self):
        PostgresAdapter.reset_instance()

    def teardown_method(self):
        PostgresAdapter.reset_instance()

    def test_execute_query_returns_dict_rows(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        mock_cur.fetchall.return_value = [{"id": "doc-1", "title": "Prescription"}]
        adapter._pool = mock_pool

        rows = execute_query("SELECT id, title FROM documents;", conninfo=url)
        assert len(rows) == 1
        assert rows[0]["id"] == "doc-1"
        assert rows[0]["title"] == "Prescription"

    def test_execute_query_with_rls(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        mock_cur.fetchall.return_value = [{"id": "doc-1", "title": "Prescription"}]
        adapter._pool = mock_pool

        user_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
        rows = execute_query("SELECT id, title FROM documents;", user_id=user_id, conninfo=url)
        assert len(rows) == 1
        assert rows[0]["id"] == "doc-1"

    def test_execute_scalar_returns_first_column(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        mock_cur.fetchall.return_value = [{"count": 42}]
        adapter._pool = mock_pool

        val = execute_scalar("SELECT count(*) FROM documents;", conninfo=url)
        assert val == 42

    def test_execute_scalar_returns_none_on_empty(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        mock_cur.fetchall.return_value = []
        adapter._pool = mock_pool

        val = execute_scalar("SELECT count(*) FROM documents WHERE id = 'non-existent';", conninfo=url)
        assert val is None

    def test_execute_mutation_returns_rowcount(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        mock_cur.rowcount = 3
        adapter._pool = mock_pool

        count = execute_mutation("DELETE FROM documents WHERE user_id = %s;", ("user-1",), conninfo=url)
        assert count == 3

    def test_execute_mutation_with_rls(self):
        url = "postgresql://postgres:pass@127.0.0.1:5432/healthsync_local_test"
        adapter = PostgresAdapter.get_instance(url)
        mock_pool, mock_conn, mock_cur = create_mock_pool_and_conn()
        mock_cur.rowcount = 1
        adapter._pool = mock_pool

        user_id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
        count = execute_mutation(
            "UPDATE profiles SET full_name = %s WHERE id = %s;",
            ("Alice", user_id),
            user_id=user_id,
            conninfo=url,
        )
        assert count == 1
