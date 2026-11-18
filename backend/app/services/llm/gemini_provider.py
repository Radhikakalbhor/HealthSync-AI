import base64
import io
from typing import List
from PIL import Image
import httpx

from backend.app.core.logger import logger
from backend.app.services.llm.base import BaseVisionLLMProvider
from backend.app.core.exceptions import DocumentProcessingException


class GeminiVisionProvider(BaseVisionLLMProvider):
    """
    Google Gemini Multimodal Vision implementation.
    Sends high-resolution document images and system instructions to Gemini.
    """

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    async def _call_vision_model(
        self, prompt: str, images: List[Image.Image]
    ) -> str:
        """Invokes Gemini generateContent endpoint with base64 encoded document images."""
        endpoint = f"{self.BASE_URL}/{self.model_name}:generateContent?key={self.api_key}"

        parts = [{"text": prompt}]

        # Append document images (up to 5 pages)
        for img in images[:5]:
            buffered = io.BytesIO()
            # Normalize size if image exceeds 2048px on any side
            max_dim = 2048
            if img.width > max_dim or img.height > max_dim:
                img_copy = img.copy()
                img_copy.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                img_copy.save(buffered, format="JPEG", quality=90)
            else:
                img.save(buffered, format="JPEG", quality=90)

            img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
            parts.append(
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": img_b64,
                    }
                }
            )

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.05,  # Highly deterministic for clinical safety
                "response_mime_type": "application/json",
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(endpoint, json=payload)
            except httpx.TimeoutException:
                raise DocumentProcessingException(
                    f"Gemini API request timed out after {self.timeout}s."
                )
            except httpx.RequestError as exc:
                raise DocumentProcessingException(
                    f"Network error communicating with Gemini API: {str(exc)}"
                )

            if response.status_code == 429:
                raise DocumentProcessingException(
                    "Gemini API rate limit exceeded (HTTP 429). Retry will be attempted."
                )
            elif response.status_code in [400, 403]:
                err_text = response.text[:250]
                raise DocumentProcessingException(
                    f"Gemini API authentication/request failure ({response.status_code}): {err_text}"
                )
            elif response.status_code != 200:
                raise DocumentProcessingException(
                    f"Gemini API returned unexpected status HTTP {response.status_code}: {response.text[:200]}"
                )

            data = response.json()
            try:
                candidate = data["candidates"][0]["content"]["parts"][0]["text"]
                return candidate
            except (KeyError, IndexError) as err:
                raise DocumentProcessingException(
                    f"Unexpected Gemini API response structure: {str(err)}"
                )
