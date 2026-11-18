import os
import shutil
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image, ImageOps
import pytesseract

from backend.app.core.config import settings
from backend.app.core.logger import logger
from backend.app.core.exceptions import TesseractNotInstalledException


class OCRService:
    """
    Modular OCR service using Pillow and Tesseract OCR.
    Handles missing binary dependencies gracefully without fake fallbacks.
    """

    @classmethod
    def _find_tesseract_binary(cls) -> Optional[str]:
        """Locates Tesseract executable from settings, common paths, or system PATH."""
        # 1. Configured setting
        if settings.TESSERACT_CMD and Path(settings.TESSERACT_CMD).is_file():
            return settings.TESSERACT_CMD

        # 2. Check if already in PATH
        found_in_path = shutil.which("tesseract")
        if found_in_path:
            return found_in_path

        # 3. Common Windows installation locations
        common_windows_paths = [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        ]
        for p in common_windows_paths:
            if Path(p).is_file():
                return p

        return None

    @classmethod
    def is_tesseract_available(cls) -> bool:
        """Returns True if Tesseract OCR executable is detected and operational."""
        binary_path = cls._find_tesseract_binary()
        if not binary_path:
            return False
        pytesseract.pytesseract.tesseract_cmd = binary_path
        return True

    @classmethod
    def preprocess_image(cls, image: Image.Image) -> Image.Image:
        """
        Preprocesses an image for higher OCR extraction accuracy:
        - Converts to grayscale
        - Normalizes contrast via autocontrast
        """
        # Convert to Grayscale
        gray_image = image.convert("L")
        # Enhance contrast
        enhanced_image = ImageOps.autocontrast(gray_image)
        return enhanced_image

    @classmethod
    def extract_text_from_image(cls, image: Image.Image) -> Tuple[str, Optional[float], str]:
        """
        Extracts readable text from an image using Tesseract OCR.
        Returns: (extracted_text, calibrated_confidence, confidence_method)
        Raises TesseractNotInstalledException if Tesseract binary is missing.
        """
        if not cls.is_tesseract_available():
            logger.warning("OCR requested but Tesseract binary is not installed.")
            raise TesseractNotInstalledException()

        preprocessed = cls.preprocess_image(image)

        # 1. Extract full text
        extracted_text = pytesseract.image_to_string(preprocessed, config="--psm 1")
        if not extracted_text.strip():
            # Retry with automatic page segmentation
            extracted_text = pytesseract.image_to_string(preprocessed, config="--psm 3")

        # 2. Extract calibrated word-level confidence
        confidence: Optional[float] = None
        method = "unavailable"
        try:
            data = pytesseract.image_to_data(preprocessed, output_type=pytesseract.Output.DICT)
            confidences = [
                float(c) for c, w in zip(data["conf"], data["text"])
                if float(c) >= 0 and w.strip()
            ]
            if confidences:
                # Average word confidence scaled between 0.0 and 1.0
                confidence = round(sum(confidences) / len(confidences) / 100.0, 3)
                method = "tesseract_word_mean"
        except Exception as e:
            logger.warning("Could not calculate OCR word confidence: %s", str(e))
            confidence = None
            method = "unavailable"

        return extracted_text.strip(), confidence, method
