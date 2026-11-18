import time
import jwt
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from backend.main import app
from backend.app.core.config import settings

# Test secret for HMAC SHA-256 JWT generation during automated testing
TEST_JWT_SECRET = "super-secret-test-jwt-key-for-healthsync-ai-testing-32bytes"
settings.SUPABASE_JWT_SECRET = TEST_JWT_SECRET

# Disable live remote sockets during testing to ensure fast local-only execution
settings.SUPABASE_URL = ""
settings.SUPABASE_KEY = ""
settings.SUPABASE_SERVICE_ROLE_KEY = ""
settings.LLM_API_KEY = ""
settings.LLM_PROVIDER = "none"


def pytest_configure(config):
    """Registers custom test markers for explicit opt-in execution."""
    config.addinivalue_line("markers", "live_network: mark test as requiring external internet access")
    config.addinivalue_line("markers", "live_supabase: mark test as requiring live Supabase credentials and network")
    config.addinivalue_line("markers", "live_gemini: mark test as requiring live Gemini API access")


def pytest_addoption(parser):
    """Adds CLI flag to explicitly enable live remote integration tests."""
    parser.addoption(
        "--run-live",
        action="store_true",
        default=False,
        help="Run live external integration tests against Supabase or Gemini",
    )


def pytest_collection_modifyitems(config, items):
    """Skips live external network tests by default unless --run-live is supplied."""
    if not config.getoption("--run-live"):
        skip_live = pytest.mark.skip(
            reason="Live external tests skipped by default. Pass --run-live to enable."
        )
        for item in items:
            if any(marker in item.keywords for marker in ["live_network", "live_supabase", "live_gemini"]):
                item.add_marker(skip_live)


@pytest.fixture(autouse=True)
def isolate_test_environment(monkeypatch, tmp_path):
    """
    Enforces strict test isolation across all tests:
    1. Blocks external network requests by mocking Supabase and Gemini clients.
    2. Isolates persistent local JSON stores to a temporary directory so real user
       medical records (e.g. uploads/metadata.json) are NEVER read, altered, or deleted.
    3. Guarantees deterministic synthetic data during automated testing.
    """
    import backend.app.core.supabase_client as sc
    import backend.app.services.db_service as dbs
    import backend.app.services.document_service as ds
    import backend.app.services.rag_service as rs
    import backend.app.services.reminder_service as rems
    import backend.app.services.intelligence_service as ints
    import backend.app.services.llm.factory as llms
    import backend.app.utils.file_handler as fh
    from backend.app.core.exceptions import SupabaseNotConfiguredException

    # 1. Clear external API credentials in config
    monkeypatch.setattr(settings, "SUPABASE_URL", "")
    monkeypatch.setattr(settings, "SUPABASE_KEY", "")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")
    monkeypatch.setattr(settings, "LLM_API_KEY", "")
    monkeypatch.setattr(settings, "LLM_PROVIDER", "none")
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_JWT_SECRET)

    # 2. Mock is_supabase_configured to False across all modules
    for mod in (sc, dbs, ds, rs, rems, ints):
        if hasattr(mod, "is_supabase_configured"):
            monkeypatch.setattr(mod, "is_supabase_configured", lambda: False)

    # 3. Defensive blockers for get_supabase_client / admin_client
    def _block_supabase(*args, **kwargs):
        raise SupabaseNotConfiguredException("Live Supabase client access is disabled in automated unit tests.")
    monkeypatch.setattr(sc, "get_supabase_client", _block_supabase)
    monkeypatch.setattr(sc, "get_supabase_admin_client", _block_supabase)

    # 4. Defensive blocker for Gemini / Vision LLM provider
    monkeypatch.setattr(llms, "get_vision_provider", lambda: None)

    # 5. File store sandbox isolation: redirect all JSON database stores to tmp_path
    monkeypatch.setattr(ds.DocumentService, "_metadata_file", tmp_path / "metadata.json")
    monkeypatch.setattr(rems.ReminderService, "_data_file", tmp_path / "medication_reminders.json")
    monkeypatch.setattr(ints.IntelligenceService, "_data_file", tmp_path / "advanced_intelligence.json")
    monkeypatch.setattr(rs.RAGAssistantService, "_rag_file", tmp_path / "assistant_rag.json")
    monkeypatch.setattr(fh, "ensure_upload_dir", lambda: tmp_path)


def create_test_jwt(
    user_id: str = "test-patient-uuid-1",
    email: str = "patient1@healthsync.ai",
    exp_seconds: int = 3600,
) -> str:
    """Generates a valid HMAC SHA-256 signed JWT token for automated testing."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "exp": int(time.time()) + exp_seconds,
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


@pytest.fixture(scope="session")
def client():
    """
    Provides an authenticated TestClient with a valid default patient session.
    Preserves seamless execution for existing tests.
    """
    token = create_test_jwt()
    with TestClient(app) as test_client:
        test_client.headers.update({"Authorization": f"Bearer {token}"})
        yield test_client


@pytest.fixture()
def unauthenticated_client():
    """Provides a raw TestClient without any authentication headers."""
    with TestClient(app) as raw_client:
        yield raw_client
