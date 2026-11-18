import os
import uuid
from pathlib import Path
from typing import Tuple
from backend.app.core.config import settings
from backend.app.core.exceptions import (
    UnsupportedFileTypeException,
    FileTooLargeException,
    ValidationException,
)

# Canonical Magic Byte Signatures
MAGIC_SIGNATURES = {
    "application/pdf": b"%PDF-",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
}

# Executable signatures to explicitly block
EXECUTABLE_SIGNATURES = [
    b"MZ",           # Windows PE executable / DLL
    b"\x7fELF",      # Linux ELF executable
    b"#!",           # Unix script shebang
    b"<!DOCTYPE",    # HTML/SVG script vectors
    b"<html",
    b"<svg",
]


def ensure_upload_dir() -> Path:
    """Ensures that the upload directory exists and returns its canonical Path."""
    upload_path = Path(settings.UPLOAD_DIR).resolve()
    upload_path.mkdir(parents=True, exist_ok=True)
    return upload_path


def sanitize_filename(filename: str) -> str:
    """Strips directory traversal sequences and unsafe characters from a filename."""
    # Retain only the base name (no path separators)
    clean_name = os.path.basename(filename).strip()
    # Remove null bytes or forbidden characters
    clean_name = clean_name.replace("\x00", "").replace("..", "")
    if not clean_name:
        raise ValidationException("Invalid filename provided.")
    return clean_name


def validate_file_extension(filename: str) -> str:
    """Validates that file extension is one of the supported formats."""
    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        allowed = ", ".join(settings.ALLOWED_EXTENSIONS)
        raise UnsupportedFileTypeException(
            f"Unsupported file format '{ext}'. Allowed extensions: {allowed}."
        )
    return ext


def detect_and_validate_mime(file_bytes: bytes, filename: str) -> str:
    """
    Validates file content by inspecting magic byte signatures.
    Guarantees the actual content matches the extension and is not an executable.
    """
    if len(file_bytes) < 4:
        raise UnsupportedFileTypeException("File is empty or corrupted (too short).")

    # Check for executable vectors
    for sig in EXECUTABLE_SIGNATURES:
        if file_bytes.startswith(sig) or file_bytes.lower().startswith(sig.lower()):
            raise UnsupportedFileTypeException("Executable or scripted files are strictly prohibited.")

    # Match magic bytes
    ext = validate_file_extension(filename)

    if ext == ".pdf":
        if not file_bytes.startswith(MAGIC_SIGNATURES["application/pdf"]):
            raise UnsupportedFileTypeException("File content does not match valid PDF specification.")
        return "application/pdf"

    elif ext == ".png":
        if not file_bytes.startswith(MAGIC_SIGNATURES["image/png"]):
            raise UnsupportedFileTypeException("File content does not match valid PNG specification.")
        return "image/png"

    elif ext in [".jpg", ".jpeg"]:
        if not file_bytes.startswith(MAGIC_SIGNATURES["image/jpeg"]):
            raise UnsupportedFileTypeException("File content does not match valid JPEG specification.")
        return "image/jpeg"

    raise UnsupportedFileTypeException(f"Unsupported file type for extension '{ext}'.")


def validate_file_size(file_bytes: bytes) -> int:
    """Validates that file size does not exceed the configured maximum."""
    size_bytes = len(file_bytes)
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if size_bytes > max_bytes:
        raise FileTooLargeException(settings.MAX_UPLOAD_SIZE_MB, size_bytes)
    return size_bytes


def generate_secure_storage_path(original_filename: str) -> Tuple[str, Path]:
    """
    Generates a secure UUID-based filename and verifies the path remains
    strictly within the configured upload directory.
    Returns: (document_id, resolved_file_path)
    """
    doc_id = str(uuid.uuid4())
    ext = validate_file_extension(original_filename)
    safe_name = f"{doc_id}{ext}"

    upload_dir = ensure_upload_dir()
    target_path = (upload_dir / safe_name).resolve()

    # Prevent path traversal
    if not str(target_path).startswith(str(upload_dir)):
        raise ValidationException("Path traversal attempt detected.")

    return doc_id, target_path
