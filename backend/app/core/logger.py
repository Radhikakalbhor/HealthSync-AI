import logging
import sys
from backend.app.core.config import settings

"""
HealthSync AI Logging Module.

PRIVACY & COMPLIANCE NOTICE:
To protect Protected Health Information (PHI) and patient privacy:
- Never log raw medical records, lab results, medication names, or patient identifying info.
- Only log operational metadata: request IDs, document IDs, processing durations, and system errors.
"""

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
LOG_LEVEL = logging.DEBUG if settings.DEBUG else logging.INFO


def setup_logging() -> logging.Logger:
    """Configures application-wide logging with safe sanitization principles."""
    logger = logging.getLogger("healthsync")
    logger.setLevel(LOG_LEVEL)

    # Avoid duplicate handlers if setup is called multiple times
    if not logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(LOG_LEVEL)
        formatter = logging.Formatter(LOG_FORMAT)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger


logger = setup_logging()
