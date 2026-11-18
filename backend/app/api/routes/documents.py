from typing import Any, Dict, List
from fastapi import APIRouter, Body, Depends, File, Query, UploadFile, status
from fastapi.responses import FileResponse

from backend.app.core.auth import get_current_user, UserTokenPayload
from backend.app.schemas.document import (
    DocumentUploadResponse,
    DocumentDetailResponse,
    DocumentReviewResponse,
    DocumentStatusResponse,
)
from backend.app.schemas.auth import ShareDocumentRequest, DocumentShareResponse
from backend.app.services.document_service import DocumentService

router = APIRouter(tags=["Documents"])


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Medical Document",
    description=(
        "Accepts a medical document (PDF, PNG, JPG, JPEG) via multipart/form-data. "
        "Validates magic bytes, file extension, and size limit. "
        "Stores the file securely, associates with the authenticated user, and records an audit event."
    ),
)
async def upload_document(
    file: UploadFile = File(..., description="Document file to upload (PDF, PNG, JPG, JPEG)"),
    current_user: UserTokenPayload = Depends(get_current_user),
) -> DocumentUploadResponse:
    """Ingests, validates, and stores a medical record."""
    file_bytes = await file.read()
    return await DocumentService.upload_document(
        original_filename=file.filename or "unnamed_document",
        file_bytes=file_bytes,
        user_id=current_user.user_id,
    )


@router.post(
    "/{document_id}/extract",
    response_model=DocumentDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract Medical Document Information",
    description=(
        "Processes the uploaded document: renders/extracts text via PyMuPDF/Tesseract OCR, "
        "classifies the medical document category, and structures medical entities. "
        "Enforces user ownership or verified share authorization."
    ),
)
async def extract_document(
    document_id: str,
    force_llm: bool = Query(
        False,
        description="Set to true to mandate Vision LLM processing; fails if LLM is unconfigured.",
    ),
    current_user: UserTokenPayload = Depends(get_current_user),
) -> DocumentDetailResponse:
    """Executes OCR and structured entity extraction for a document."""
    return await DocumentService.process_and_extract(
        doc_id=document_id,
        user_id=current_user.user_id,
        force_llm=force_llm,
    )


@router.get(
    "",
    response_model=List[DocumentDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="List User Documents",
    description="Returns all medical records owned by the authenticated user.",
)
async def list_documents(
    current_user: UserTokenPayload = Depends(get_current_user),
) -> List[DocumentDetailResponse]:
    """Lists all personal medical documents for the authenticated user."""
    return DocumentService.list_user_documents(current_user.user_id)


@router.get(
    "/{document_id}",
    response_model=DocumentDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Document Details and Extraction",
    description="Retrieves full document metadata, preserved OCR text, and structured medical data after ownership check.",
)
async def get_document(
    document_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> DocumentDetailResponse:
    """Retrieves complete document information."""
    return DocumentService.get_document_detail(document_id, current_user.user_id)


@router.get(
    "/{document_id}/status",
    response_model=DocumentStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Document Processing Status",
    description="Lightweight status check endpoint for monitoring upload and extraction lifecycle.",
)
async def get_document_status(
    document_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> DocumentStatusResponse:
    """Polls document processing state."""
    return DocumentService.get_document_status(document_id, current_user.user_id)


@router.get(
    "/{document_id}/review",
    response_model=DocumentReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Document Review Data",
    description=(
        "Retrieves a structured payload tailored for the medical review screen. "
        "Contains extracted fields, OCR text, confidence breakdown, and list of fields requiring user verification."
    ),
)
async def get_document_review(
    document_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> DocumentReviewResponse:
    """Provides complete review-screen representation of the document."""
    return DocumentService.get_document_review(document_id, current_user.user_id)


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Medical Document",
    description="Permanently deletes a medical document and cascading extracted entities after verifying ownership.",
)
async def delete_document(
    document_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> dict:
    """Deletes medical record."""
    DocumentService.delete_document(document_id, current_user.user_id)
    return {"status": "success", "message": f"Document {document_id} successfully deleted."}


@router.post(
    "/{document_id}/share",
    response_model=DocumentShareResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Share Medical Document",
    description="Grants temporary read/review access to a medical document for another email address.",
)
async def share_document(
    document_id: str,
    payload: ShareDocumentRequest,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> DocumentShareResponse:
    """Creates a document sharing authorization."""
    return DocumentService.create_share(document_id, current_user.user_id, payload)


@router.get(
    "/{document_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Get Signed Download URL",
    description="Generates a signed storage URL or authorized download route for retrieving the medical file.",
)
async def get_download_url(
    document_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generates download URL for document."""
    return await DocumentService.get_download_url(document_id, current_user.user_id)


@router.get(
    "/{document_id}/file",
    summary="Serve Document File Content",
    description="Serves the raw file content directly for preview or download after verifying ownership.",
)
async def get_document_file(
    document_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> FileResponse:
    """Returns the document file content directly."""
    file_path = DocumentService.get_document_file_path(document_id, current_user.user_id)
    rec = DocumentService.get_document_record(document_id, current_user.user_id)
    orig_name = rec.get("original_filename") or rec.get("filename") or "document.pdf"
    mime_type = rec.get("mime_type") or "application/octet-stream"
    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        filename=orig_name,
        headers={"Content-Disposition": f'attachment; filename="{orig_name}"'},
    )


@router.patch(
    "/{document_id}/review",
    status_code=status.HTTP_200_OK,
    summary="Save Human Review Corrections",
    description="Saves user-confirmed or corrected medical information for the document.",
)
async def update_document_review(
    document_id: str,
    corrections: Dict[str, Any] = Body(...),
    current_user: UserTokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    """Applies human review corrections to extracted document data."""
    return DocumentService.update_review(document_id, current_user.user_id, corrections)


@router.post(
    "/{document_id}/verify-clinician",
    status_code=status.HTTP_200_OK,
    summary="Verify Document as Clinician",
    description="Signs and marks a document as clinician-verified.",
)
async def verify_document_as_clinician(
    document_id: str,
    payload: Dict[str, Any] = Body(...),
    current_user: UserTokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    """Applies formal clinician verification."""
    return DocumentService.verify_as_clinician(document_id, current_user.user_id, payload)


@router.post(
    "/reclassify",
    status_code=status.HTTP_200_OK,
    summary="Reclassify Documents & Quarantine Invalid Data",
    description=(
        "Scans all documents for the authenticated user and idempotently reclassifies non-medical files. "
        "Quarantines invalid clinical entities and RAG chunks. Supports dry_run mode."
    ),
)
async def reclassify_documents(
    dry_run: bool = Query(True, description="When true, previews changes without writing to database or index."),
    current_user: UserTokenPayload = Depends(get_current_user),
) -> Dict[str, Any]:
    """Reclassifies user documents and quarantines non-medical entities."""
    return DocumentService.reclassify_user_documents(current_user.user_id, dry_run=dry_run)


