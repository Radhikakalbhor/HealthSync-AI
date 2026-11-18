"""
HealthSync AI — Native Direct PostgreSQL Adapter.
Provides high-performance, direct PostgreSQL 18 connection pooling and transaction
management using psycopg 3 (psycopg[binary,pool]).

STRICT SAFETY GUARANTEES:
- Completely opt-in: enabled ONLY when HEALTHSYNC_DATABASE_URL is set.
- Default mode remains Supabase REST client; existing services and tests are unaffected.
- Blocks connections to hosted Supabase (enforces local/dedicated database endpoints).
- Secure RLS session handling: sets transaction-local JWT claims (sub, role) using
  PostgreSQL set_config(..., true) and SET LOCAL ROLE with strict UUID and role allowlisting.
- Guaranteed connection cleanup and cross-connection claim isolation via connection pooling.
"""

from contextlib import contextmanager
import logging
import threading
from typing import Any, Dict, Generator, List, Optional
import uuid

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from backend.app.core.config import settings
from backend.app.core.exceptions import HealthSyncException

logger = logging.getLogger("healthsync.db")

# Strict allowlist of hosts that must NEVER be targeted by this local direct adapter
FORBIDDEN_HOST_PATTERNS = ["supabase.co", "supabase.in", "supabase.net"]

# Strict allowlist of RLS roles
ALLOWED_RLS_ROLES = {"authenticated", "anon", "service_role"}


# ==============================================================================
# Exceptions
# ==============================================================================

class DatabaseException(HealthSyncException):
    """Base exception for native database adapter operations."""
    def __init__(self, message: str = "Database operation failed.", status_code: int = 500, details: Optional[Any] = None):
        super().__init__(message=message, status_code=status_code, code="DATABASE_ERROR", details=details)


class DatabaseConfigurationException(DatabaseException):
    """Raised when database configuration is missing, invalid, or improperly formatted."""
    def __init__(self, message: str = "Database adapter is not configured.", details: Optional[Any] = None):
        super().__init__(message=message, status_code=500, details=details)
        self.code = "DATABASE_CONFIGURATION_ERROR"


class DatabaseSecurityException(DatabaseException):
    """Raised when connection parameters violate safety constraints (e.g. attempting remote Supabase)."""
    def __init__(self, message: str = "Database security constraint violated.", details: Optional[Any] = None):
        super().__init__(message=message, status_code=403, details=details)
        self.code = "DATABASE_SECURITY_ERROR"


class DatabaseConnectionException(DatabaseException):
    """Raised when unable to establish or retrieve a connection from the pool."""
    def __init__(self, message: str = "Failed to establish database connection.", details: Optional[Any] = None):
        super().__init__(message=message, status_code=503, details=details)
        self.code = "DATABASE_CONNECTION_ERROR"


# ==============================================================================
# Configuration & Validation
# ==============================================================================

def is_direct_db_configured() -> bool:
    """Returns True ONLY when HEALTHSYNC_DATABASE_URL is explicitly set and non-empty."""
    url = (settings.HEALTHSYNC_DATABASE_URL or "").strip()
    return bool(url)


def validate_database_url(url: Optional[str] = None) -> str:
    """
    Validates the connection URL.
    Enforces postgresql:// scheme and guarantees that hosted Supabase endpoints are rejected.
    """
    target_url = (url or settings.HEALTHSYNC_DATABASE_URL or "").strip()
    if not target_url:
        raise DatabaseConfigurationException(
            "HEALTHSYNC_DATABASE_URL is not configured. Direct PostgreSQL access requires an explicit database URL."
        )

    lower_url = target_url.lower()
    if not (lower_url.startswith("postgresql://") or lower_url.startswith("postgres://")):
        raise DatabaseConfigurationException(
            "Invalid database URL scheme. Connection string must start with 'postgresql://' or 'postgres://'."
        )

    for pattern in FORBIDDEN_HOST_PATTERNS:
        if pattern in lower_url:
            raise DatabaseSecurityException(
                f"CRITICAL SAFETY VIOLATION: Direct PostgreSQL adapter is hard-restricted from connecting "
                f"to hosted Supabase endpoints ('{pattern}'). Use Supabase client for hosted projects."
            )

    return target_url


def validate_uuid(val: Any) -> str:
    """Validates that a string is a well-formed UUID to prevent injection into session settings."""
    try:
        return str(uuid.UUID(str(val).strip()))
    except (ValueError, AttributeError, TypeError):
        raise ValueError(f"Invalid UUID provided for RLS claim: '{val}'")


# ==============================================================================
# Connection Pool Lifecycle Manager
# ==============================================================================

class PostgresAdapter:
    """
    Thread-safe connection pool singleton for direct PostgreSQL access.
    Supports Windows and Python 3.12 with psycopg 3.
    """
    _instance: Optional["PostgresAdapter"] = None
    _lock = threading.Lock()

    def __init__(self, conninfo: Optional[str] = None):
        self._conninfo = validate_database_url(conninfo)
        self._pool: Optional[ConnectionPool] = None
        self._pool_lock = threading.Lock()

    @classmethod
    def get_instance(cls, conninfo: Optional[str] = None) -> "PostgresAdapter":
        """Retrieves or creates the singleton adapter instance."""
        with cls._lock:
            if cls._instance is None or (conninfo and conninfo != cls._instance._conninfo):
                cls._instance = cls(conninfo)
            return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Closes and resets the singleton instance (used in tests and shutdown)."""
        with cls._lock:
            if cls._instance is not None:
                cls._instance.close()
                cls._instance = None

    def get_pool(self) -> ConnectionPool:
        """Lazily initializes and opens the connection pool."""
        with self._pool_lock:
            if self._pool is None or self._pool.closed:
                try:
                    self._pool = ConnectionPool(
                        conninfo=self._conninfo,
                        min_size=settings.DB_POOL_MIN_SIZE,
                        max_size=settings.DB_POOL_MAX_SIZE,
                        timeout=settings.DB_POOL_TIMEOUT,
                        open=True,
                        kwargs={"row_factory": dict_row},
                    )
                    logger.info("Direct PostgreSQL connection pool initialized.")
                except Exception as e:
                    logger.error("Failed to initialize PostgreSQL connection pool: %s", str(e))
                    raise DatabaseConnectionException(f"Connection pool initialization failed: {str(e)}")
            return self._pool

    def close(self) -> None:
        """Closes the connection pool and drains connections."""
        with self._pool_lock:
            if self._pool is not None and not self._pool.closed:
                try:
                    self._pool.close()
                    logger.info("Direct PostgreSQL connection pool closed.")
                except Exception as e:
                    logger.warning("Error closing PostgreSQL connection pool: %s", str(e))
                finally:
                    self._pool = None

    def ping(self) -> bool:
        """Performs a lightweight healthcheck ping against the database."""
        try:
            with self.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1;")
                    res = cur.fetchone()
                    if not res:
                        return False
                    if isinstance(res, dict):
                        return list(res.values())[0] == 1
                    return res[0] == 1
        except Exception:
            return False

    @contextmanager
    def connection(self) -> Generator[psycopg.Connection, None, None]:
        """
        Borrows a connection from the pool and returns it cleanly.
        Rolls back uncommitted transactions on error.
        """
        pool = self.get_pool()
        conn = None
        try:
            conn = pool.getconn()
            yield conn
        except Exception as e:
            if conn is not None and not conn.closed:
                try:
                    conn.rollback()
                except Exception:
                    pass
            if isinstance(e, DatabaseException):
                raise
            raise DatabaseConnectionException(f"Database query execution error: {str(e)}") from e
        finally:
            if conn is not None and not conn.closed:
                try:
                    # Clean session state before returning to pool
                    conn.rollback()
                except Exception:
                    pass
                pool.putconn(conn)


# ==============================================================================
# Context Managers & Transaction Helpers
# ==============================================================================

@contextmanager
def get_db_connection(conninfo: Optional[str] = None) -> Generator[psycopg.Connection, None, None]:
    """
    Context manager that yields a raw pooled connection.
    Guarantees rollback on exception and return to pool in finally.
    """
    adapter = PostgresAdapter.get_instance(conninfo)
    with adapter.connection() as conn:
        yield conn


@contextmanager
def get_db_transaction(conninfo: Optional[str] = None) -> Generator[psycopg.Connection, None, None]:
    """
    Context manager that executes inside an explicit database transaction block.
    Commits on normal exit; automatically rolls back on exception.
    """
    adapter = PostgresAdapter.get_instance(conninfo)
    with adapter.connection() as conn:
        with conn.transaction():
            yield conn


@contextmanager
def get_rls_connection(
    user_id: str,
    role: str = "authenticated",
    conninfo: Optional[str] = None,
) -> Generator[psycopg.Connection, None, None]:
    """
    Secure transaction-scoped context manager enforcing PostgreSQL Row-Level Security (RLS).
    
    SECURITY CONTROLS:
    1. Validates user_id is a valid UUID string (prevents setting arbitrary/malicious strings).
    2. Enforces strict role allowlist: 'authenticated', 'anon', 'service_role'.
    3. Uses PostgreSQL transaction-local set_config(setting, value, is_local=true) so claims
       are bound strictly to the active transaction and automatically vanish upon COMMIT or ROLLBACK.
    4. Applies SET LOCAL ROLE to activate RLS policies matching the authenticated role.
    5. Discards any residual session configuration upon context exit to prevent pool leakage.
    """
    clean_user_id = validate_uuid(user_id)
    clean_role = role.lower().strip()
    if clean_role not in ALLOWED_RLS_ROLES:
        raise DatabaseSecurityException(
            f"Invalid RLS role: '{role}'. Must be one of {sorted(ALLOWED_RLS_ROLES)}."
        )

    adapter = PostgresAdapter.get_instance(conninfo)
    with adapter.connection() as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                # Set transaction-local claims (is_local = true ensures claims vanish on commit/rollback)
                cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true);", (clean_user_id,))
                cur.execute("SELECT set_config('request.jwt.claim.role', %s, true);", (clean_role,))
                cur.execute(
                    "SELECT set_config('request.jwt.claims', %s, true);",
                    (f'{{"sub":"{clean_user_id}","role":"{clean_role}"}}',),
                )
                # Apply local role
                if clean_role == "authenticated":
                    cur.execute("SET LOCAL ROLE authenticated;")
                elif clean_role == "anon":
                    cur.execute("SET LOCAL ROLE anon;")
                elif clean_role == "service_role":
                    cur.execute("SET LOCAL ROLE service_role;")

            yield conn

            # End of transaction block automatically resets LOCAL ROLE and set_config


# ==============================================================================
# Helper Execution Primitives
# ==============================================================================

def execute_query(
    query: str,
    params: Optional[tuple] = None,
    user_id: Optional[str] = None,
    role: str = "authenticated",
    conninfo: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Executes a SELECT query and returns rows as dictionaries.
    Applies RLS session context when user_id is provided.
    """
    if user_id:
        with get_rls_connection(user_id=user_id, role=role, conninfo=conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute(query, params or ())
                return cur.fetchall()
    else:
        with get_db_connection(conninfo=conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute(query, params or ())
                return cur.fetchall()


def execute_scalar(
    query: str,
    params: Optional[tuple] = None,
    user_id: Optional[str] = None,
    role: str = "authenticated",
    conninfo: Optional[str] = None,
) -> Any:
    """Executes a query and returns the first column of the first row."""
    rows = execute_query(query, params, user_id=user_id, role=role, conninfo=conninfo)
    if rows:
        first_row = rows[0]
        return next(iter(first_row.values()))
    return None


def execute_mutation(
    query: str,
    params: Optional[tuple] = None,
    user_id: Optional[str] = None,
    role: str = "authenticated",
    conninfo: Optional[str] = None,
) -> int:
    """Executes an INSERT, UPDATE, or DELETE statement and returns the affected rowcount."""
    if user_id:
        with get_rls_connection(user_id=user_id, role=role, conninfo=conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute(query, params or ())
                return cur.rowcount
    else:
        with get_db_transaction(conninfo=conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute(query, params or ())
                return cur.rowcount
