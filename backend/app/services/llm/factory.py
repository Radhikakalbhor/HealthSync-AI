from typing import Optional
from backend.app.core.config import settings
from backend.app.core.exceptions import LLMNotConfiguredException, ValidationException
from backend.app.services.llm.base import BaseVisionLLMProvider
from backend.app.services.llm.gemini_provider import GeminiVisionProvider


def get_vision_provider() -> BaseVisionLLMProvider:
    """
    Instantiates and returns the configured Vision LLM provider.
    Raises LLMNotConfiguredException if credentials or provider are not set in the environment.
    """
    provider_name = (settings.LLM_PROVIDER or "").strip().lower()
    api_key = (settings.LLM_API_KEY or "").strip()

    if not provider_name or not api_key:
        raise LLMNotConfiguredException(provider=provider_name or None)

    if provider_name == "gemini":
        return GeminiVisionProvider(
            api_key=api_key,
            model_name=settings.LLM_MODEL or "gemini-1.5-flash",
        )
    else:
        raise ValidationException(
            f"Unsupported LLM provider '{provider_name}'. Supported providers: 'gemini'."
        )
