import io
from pathlib import Path
from typing import List, Optional, Tuple
import pymupdf as fitz
from PIL import Image

from backend.app.core.logger import logger
from backend.app.core.exceptions import DocumentProcessingException
from backend.app.services.ocr_service import OCRService


class PDFService:
    """
    Handles PDF ingestion, native text extraction, and page-by-page rendering
    for optical character recognition.
    """

    @classmethod
    def extract_pdf_content(
        cls, file_path: Path
    ) -> Tuple[str, int, str, Optional[float], Optional[str], List[Image.Image]]:
        """
        Extracts textual content from a PDF document.
        - First attempts native digital text extraction.
        - If pages are scanned/image-based, renders them at 300 DPI and invokes OCRService.

        Returns:
            Tuple of:
            - full_text (str)
            - page_count (int)
            - engine_used (str)
            - confidence (Optional[float])
            - confidence_method (Optional[str])
            - rendered_images (List[Image.Image])
        """
        try:
            doc = fitz.open(file_path)
        except Exception as e:
            raise DocumentProcessingException(f"Failed to open PDF document: {str(e)}")

        page_count = len(doc)
        if page_count == 0:
            doc.close()
            raise DocumentProcessingException("PDF document contains no pages.")

        extracted_pages: List[str] = []
        rendered_images: List[Image.Image] = []
        needs_ocr = False

        # Phase 1: Native text extraction pass
        for page_num in range(page_count):
            page = doc[page_num]
            text = page.get_text("text").strip()
            extracted_pages.append(text)
            # If any page has fewer than 20 characters, it may be a scanned page
            if len(text) < 20:
                needs_ocr = True

        # Phase 2: Render pages for OCR or vision LLM
        for page_num in range(page_count):
            page = doc[page_num]
            # Render page at 300 DPI for high fidelity
            pix = page.get_pixmap(dpi=200)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            rendered_images.append(img)

        doc.close()

        # If native digital text was found throughout, use it
        all_native_text = "\n\n".join(p for p in extracted_pages if p.strip()).strip()

        if not needs_ocr and len(all_native_text) > 40:
            # 100% fidelity native digital PDF text
            return (
                all_native_text,
                page_count,
                "pymupdf_native_text",
                1.0,
                "digital_pdf_stream",
                rendered_images,
            )

        # Scanned PDF: If Tesseract is available, perform OCR on rendered pages
        if OCRService.is_tesseract_available():
            logger.info("Performing OCR on %d rendered PDF pages...", page_count)
            ocr_texts: List[str] = []
            confidences: List[float] = []

            for idx, img in enumerate(rendered_images):
                page_text, conf, _ = OCRService.extract_text_from_image(img)
                if page_text:
                    ocr_texts.append(f"--- Page {idx + 1} ---\n{page_text}")
                if conf is not None:
                    confidences.append(conf)

            full_ocr_text = "\n\n".join(ocr_texts).strip()
            avg_conf = (
                round(sum(confidences) / len(confidences), 3)
                if confidences
                else None
            )

            # Combine any native text with OCR text if both exist
            combined_text = full_ocr_text if full_ocr_text else all_native_text
            return (
                combined_text,
                page_count,
                "tesseract_ocr",
                avg_conf,
                "tesseract_word_mean" if avg_conf else "unavailable",
                rendered_images,
            )

        # If Tesseract is not available, return whatever native text exists
        # without faking OCR results
        return (
            all_native_text,
            page_count,
            "pymupdf_native_partial",
            None,
            "unavailable",
            rendered_images,
        )
