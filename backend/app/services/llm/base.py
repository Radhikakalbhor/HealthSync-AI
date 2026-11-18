import abc
import json
import re
import time
from typing import Any, Dict, List, Optional, Type
from PIL import Image
from pydantic import BaseModel, ValidationError

from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.core.exceptions import ValidationException, DocumentProcessingException
from backend.app.schemas.document import (
    DocumentType,
    PrescriptionData,
    LabReportData,
    ImagingReportData,
    ConsultationData,
    DischargeSummaryData,
    GenericDocumentData,
    StructuredMedicalData,
)


class BaseVisionLLMProvider(abc.ABC):
    """
    Abstract base class for provider-independent Vision LLM integration.
    Handles retry logic, prompt construction, JSON extraction, and Pydantic validation.
    """

    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        self.max_retries = settings.LLM_MAX_RETRIES
        self.timeout = settings.LLM_TIMEOUT_SECONDS

    @abc.abstractmethod
    async def _call_vision_model(
        self, prompt: str, images: List[Image.Image]
    ) -> str:
        """Sends multimodal prompt and images to the provider's API. Returns raw response text."""
        pass

    def get_target_schema(self, doc_type: DocumentType) -> Type[BaseModel]:
        """Returns the appropriate Pydantic schema for the document type."""
        if doc_type == DocumentType.PRESCRIPTION:
            return PrescriptionData
        elif doc_type in [DocumentType.BLOOD_TEST, DocumentType.LAB_REPORT]:
            return LabReportData
        elif doc_type == DocumentType.IMAGING_REPORT:
            return ImagingReportData
        elif doc_type == DocumentType.CONSULTATION_RECORD:
            return ConsultationData
        elif doc_type == DocumentType.DISCHARGE_SUMMARY:
            return DischargeSummaryData
        return GenericDocumentData

    def build_system_prompt(self, doc_type: DocumentType) -> str:
        """Constructs a strict system prompt enforcing medical safety and structured JSON format."""
        schema_cls = self.get_target_schema(doc_type)
        schema_json = json.dumps(schema_cls.model_json_schema(), indent=2)

        return (
            "You are an expert medical document transcription and understanding assistant for HealthSync AI.\n\n"
            "CRITICAL MEDICAL SAFETY & EXTRACTION DIRECTIVES:\n"
            "1. NEVER invent, hallucinate, guess, or extrapolate medical diagnoses or prescriptions.\n"
            "2. NEVER recommend changes in medication, dosage, or clinical treatments.\n"
            "3. Extract ONLY information that is explicitly stated or clearly handwritten in the document.\n"
            "4. For handwritten prescriptions: carefully decipher physician handwriting, clinic stamps, and standard "
            "abbreviations (e.g. Tab, Cap, Syr, OD, BD, TDS, QID, HS, PRN, SOS, mg, ml, mcg, po, iv). "
            "If a word or dosage is ambiguous, illegible, or unreadable, set its value strictly to null.\n"
            "5. For laboratory and blood test reports: accurately extract analyte names, measured numerical values, "
            "measurement units (e.g. g/dL, mg/dL, %), biological reference ranges, and abnormal markers.\n"
            "6. Any field that is absent or uncertain MUST be null. Never output placeholder strings like 'N/A' or 'Unknown'.\n"
            "7. Return strictly valid JSON conforming exactly to the following JSON schema:\n\n"
            f"```json\n{schema_json}\n```\n\n"
            "Respond ONLY with raw JSON inside ```json ... ``` blocks."
        )

    def extract_json_from_response(self, response_text: str) -> Dict[str, Any]:
        """Extracts and parses JSON from markdown code blocks or raw response text."""
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", response_text)
        json_str = match.group(1).strip() if match else response_text.strip()

        try:
            return json.loads(json_str)
        except json.JSONDecodeError as err:
            logger.warning("Failed to decode JSON from LLM response: %s", str(err))
            raise ValidationException(
                "Vision LLM returned an unparseable response.",
                details={"raw_snippet": response_text[:200]},
            )

    def validate_structured_output(
        self, data_dict: Dict[str, Any], doc_type: DocumentType
    ) -> StructuredMedicalData:
        """Validates extracted dictionary against target Pydantic schema."""
        schema_cls = self.get_target_schema(doc_type)
        try:
            return schema_cls.model_validate(data_dict)
        except ValidationError as val_err:
            logger.warning("Pydantic validation failed for LLM extraction: %s", str(val_err))
            raise ValidationException(
                "Structured medical data failed schema validation.",
                details=val_err.errors(),
            )

    async def extract_structured_document(
        self,
        document_text: str,
        images: List[Image.Image],
        doc_type: DocumentType,
    ) -> StructuredMedicalData:
        """
        Coordinates full LLM extraction pipeline with retry logic and exponential backoff.
        """
        prompt = self.build_system_prompt(doc_type)
        if document_text.strip():
            prompt += f"\n\nVerbatim OCR Text for reference:\n{document_text}\n"

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(
                    "Calling Vision LLM [%s] (attempt %d/%d)...",
                    self.model_name,
                    attempt,
                    self.max_retries,
                )
                raw_response = await self._call_vision_model(prompt, images)
                parsed_json = self.extract_json_from_response(raw_response)
                validated_model = self.validate_structured_output(parsed_json, doc_type)
                return validated_model
            except Exception as e:
                last_error = e
                # Check for rate limit or network error
                wait_time = 2 ** attempt
                logger.warning(
                    "LLM extraction attempt %d failed: %s. Retrying in %ds...",
                    attempt,
                    str(e),
                    wait_time,
                )
                if attempt < self.max_retries:
                    time.sleep(wait_time)

        raise DocumentProcessingException(
            f"Vision LLM extraction failed after {self.max_retries} attempts: {str(last_error)}"
        )
