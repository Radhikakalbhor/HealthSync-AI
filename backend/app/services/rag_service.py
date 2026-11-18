import json
import logging
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.app.core.config import settings
from backend.app.core.exceptions import EntityNotFoundException, ForbiddenException, ValidationException
from backend.app.core.supabase_client import get_supabase_admin_client, is_supabase_configured
from backend.app.schemas.assistant import (
    CitationItem,
    ChatMessageResponse,
    ConversationResponse,
)
from backend.app.services.audit_service import AuditService, AuditAction
from backend.app.services.document_service import DocumentService
from backend.app.utils.file_security import ensure_upload_dir

logger = logging.getLogger("healthsync.assistant")


class RAGAssistantService:
    """
    Retrieval-Augmented Generation (RAG) assistant for querying personal medical records.
    Enforces strict user isolation (no cross-user retrieval), zero-hallucination guardrails,
    verifiable document citations, and patient safety constraints.
    """

    _lock = threading.RLock()
    _rag_file = ensure_upload_dir() / "assistant_rag.json"

    ALLOWED_RAG_TYPES = {
        "prescription",
        "blood_test",
        "lab_report",
        "imaging_report",
        "discharge_summary",
        "consultation_record",
    }
    EXCLUDED_STATUSES = {
        "unsupported",
        "failed",
        "uploaded",
        "processing",
        "needs_review",
    }
    APPROVED_RAG_STATUSES = {
        "extracted",
        "verified",
    }
    MIN_RAG_CONFIDENCE = 0.70
    STOP_WORDS = {
        "what", "was", "my", "in", "the", "a", "an", "is", "of", "to", "for",
        "on", "at", "by", "with", "from", "report", "document", "test", "last",
        "me", "i", "do", "have", "had", "can", "you", "tell", "show", "give",
        "value", "results", "result", "about", "any", "which", "how", "much"
    }

    SAFETY_DISCLAIMER = (
        "HealthSync AI explains information from your existing medical records for informational reference only. "
        "It NEVER diagnoses diseases, prescribes medicines, or recommends changes to your prescribed treatment. "
        "Always consult a qualified healthcare professional for medical advice."
    )

    @classmethod
    def _load_data(cls) -> Dict[str, Any]:
        """Loads assistant and conversation store."""
        if not cls._rag_file.exists():
            return {"conversations": {}, "messages": {}, "chunks": {}}
        try:
            with open(cls._rag_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"conversations": {}, "messages": {}, "chunks": {}}

    @classmethod
    def _save_data(cls, data: Dict[str, Any]) -> None:
        """Persists data to disk."""
        with cls._lock:
            with open(cls._rag_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)

    @classmethod
    def chunk_and_index_document(
        cls,
        doc_id: str,
        user_id: str,
        filename: str,
        doc_type: str,
        raw_text: Optional[str],
        structured_data: Optional[Dict[str, Any]],
        confidence: Optional[float] = None,
        status: Optional[str] = None,
        requires_verification: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        """
        Splits medical document text and structured entities into indexed chunks.
        Strictly tagged with user_id to enforce user isolation.
        Enforces strict confidence (>=0.70), approved status, and verification gates.
        """
        # Resolve missing attributes from document record if not explicitly supplied
        if confidence is None or status is None or requires_verification is None:
            try:
                from backend.app.services.document_service import DocumentService
                rec = DocumentService.get_document_record(doc_id, user_id)
                if rec:
                    if status is None:
                        status = rec.get("status")
                    if requires_verification is None:
                        requires_verification = rec.get("requires_verification", False) or rec.get("needs_human_review", False)
                    if confidence is None:
                        if rec.get("confidence") is not None:
                            confidence = float(rec["confidence"])
                        elif rec.get("ocr_confidence") is not None:
                            confidence = float(rec["ocr_confidence"])
                        else:
                            ext = rec.get("extraction_result")
                            if isinstance(ext, dict):
                                if ext.get("confidence") is not None:
                                    confidence = float(ext["confidence"])
                                else:
                                    conf_info = ext.get("confidence_info")
                                    if isinstance(conf_info, dict):
                                        c = conf_info.get("overall_confidence") or conf_info.get("ocr_confidence")
                                        if c is not None:
                                            confidence = float(c)
            except Exception:
                pass

        # Gate 1: Document type must belong to ALLOWED_RAG_TYPES
        doc_type_clean = (doc_type or "").lower().strip()
        if doc_type_clean in ["non_medical", "other"] or doc_type_clean not in cls.ALLOWED_RAG_TYPES:
            logger.info("Excluding document %s from RAG: disallowed document type '%s'", doc_id, doc_type)
            return []

        # Gate 2: Classification/extraction confidence must be present and at least 0.70
        if confidence is None:
            logger.info("Excluding document %s from RAG: missing classification/extraction confidence", doc_id)
            return []

        if confidence < cls.MIN_RAG_CONFIDENCE:
            logger.info(
                "Excluding document %s from RAG: confidence %.2f below threshold %.2f",
                doc_id,
                confidence,
                cls.MIN_RAG_CONFIDENCE,
            )
            return []

        # Gate 3: Status must be an explicitly approved completed medical processing status
        status_clean = (status or "").lower().strip()
        if not status_clean or status_clean in cls.EXCLUDED_STATUSES or status_clean not in cls.APPROVED_RAG_STATUSES:
            logger.info("Excluding document %s from RAG: status '%s' not approved for RAG", doc_id, status)
            return []

        # Gate 4: Document must not require human verification
        if requires_verification is True:
            logger.info("Excluding document %s from RAG: document requires human review", doc_id)
            return []

        chunks: List[Dict[str, Any]] = []
        now = datetime.now(timezone.utc)

        # 1. Chunk structured entities
        if structured_data:
            # Prescriptions
            if "medications" in structured_data and isinstance(structured_data["medications"], list):
                meds_summary = [
                    f"{m.get('name', 'Unknown')}: {m.get('dosage', '')} {m.get('frequency', '')} ({m.get('instructions', '')})"
                    for m in structured_data["medications"]
                ]
                content = (
                    f"Prescription Document: {filename}\n"
                    f"Prescribing Doctor: {structured_data.get('doctor_name', 'Not specified')}\n"
                    f"Clinic: {structured_data.get('clinic_name', 'Not specified')}\n"
                    f"Date: {structured_data.get('prescription_date', 'Not specified')}\n"
                    f"Medications Prescribed:\n- " + "\n- ".join(meds_summary)
                )
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "document_id": doc_id,
                    "user_id": user_id,
                    "chunk_index": len(chunks),
                    "chunk_text": content,
                    "metadata": {
                        "filename": filename,
                        "doc_type": doc_type,
                        "date": structured_data.get("prescription_date"),
                        "doctor": structured_data.get("doctor_name"),
                        "section": "medications",
                    },
                    "created_at": now.isoformat(),
                })

            # Lab Reports
            if "results" in structured_data and isinstance(structured_data["results"], list):
                results_summary = [
                    f"{r.get('test_name')}: {r.get('value')} {r.get('unit', '')} (Reference: {r.get('reference_range', 'N/A')}, Flag: {r.get('flag', 'NORMAL')})"
                    for r in structured_data["results"]
                ]
                content = (
                    f"Laboratory Diagnostic Report: {filename}\n"
                    f"Lab Facility: {structured_data.get('lab_name', 'Not specified')}\n"
                    f"Test Date: {structured_data.get('test_date', 'Not specified')}\n"
                    f"Analytes & Biomarkers:\n- " + "\n- ".join(results_summary)
                )
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "document_id": doc_id,
                    "user_id": user_id,
                    "chunk_index": len(chunks),
                    "chunk_text": content,
                    "metadata": {
                        "filename": filename,
                        "doc_type": doc_type,
                        "date": structured_data.get("test_date"),
                        "lab": structured_data.get("lab_name"),
                        "section": "lab_results",
                    },
                    "created_at": now.isoformat(),
                })

        # 2. Chunk raw text
        if raw_text and raw_text.strip():
            paragraphs = [p.strip() for p in raw_text.split("\n\n") if len(p.strip()) > 20]
            if not paragraphs:
                paragraphs = [raw_text.strip()[:1000]]

            for idx, p in enumerate(paragraphs[:8]):
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "document_id": doc_id,
                    "user_id": user_id,
                    "chunk_index": len(chunks),
                    "chunk_text": f"Document: {filename} (Excerpt {idx + 1}):\n{p}",
                    "metadata": {
                        "filename": filename,
                        "doc_type": doc_type,
                        "date": None,
                        "section": f"excerpt_{idx+1}",
                    },
                    "created_at": now.isoformat(),
                })

        # Persist chunks locally
        with cls._lock:
            data = cls._load_data()
            for ch in chunks:
                data["chunks"][ch["id"]] = ch
            cls._save_data(data)

        # Persist to Supabase if configured
        if is_supabase_configured():
            try:
                admin_client = get_supabase_admin_client()
                for ch in chunks:
                    admin_client.table("document_chunks").insert({
                        "id": ch["id"],
                        "document_id": ch["document_id"],
                        "user_id": ch["user_id"],
                        "chunk_index": ch["chunk_index"],
                        "chunk_text": ch["chunk_text"],
                        "metadata": ch["metadata"],
                    }).execute()
            except Exception as e:
                logger.warning("Supabase document_chunks insert warning: %s", str(e))

        return chunks

    @classmethod
    def delete_document_chunks(cls, doc_id: str, user_id: str) -> int:
        """Deletes all chunks belonging to a document from local and database stores."""
        count = 0
        with cls._lock:
            data = cls._load_data()
            to_delete = [
                cid for cid, ch in data.get("chunks", {}).items()
                if ch.get("document_id") == doc_id and ch.get("user_id") == user_id
            ]
            for cid in to_delete:
                del data["chunks"][cid]
                count += 1
            if count > 0:
                cls._save_data(data)

        if is_supabase_configured():
            try:
                admin_client = get_supabase_admin_client()
                admin_client.table("document_chunks").delete().eq("document_id", doc_id).eq("user_id", user_id).execute()
            except Exception as e:
                logger.warning("Supabase delete_document_chunks warning: %s", str(e))
        return count

    @classmethod
    def quarantine_invalid_chunks(cls, user_id: str) -> int:
        """Removes chunks originating from non-medical, unsupported, low-confidence, or unverified documents."""
        user_docs = DocumentService.list_user_documents(user_id)
        invalid_doc_ids = set()
        for d in user_docs:
            doc_type = d.document_type.value
            status = d.status.value
            conf = d.confidence_score if d.confidence_score is not None else d.ocr_confidence
            if conf is None and d.extraction_result:
                conf = d.extraction_result.confidence
                if conf is None and d.extraction_result.confidence_info:
                    conf = d.extraction_result.confidence_info.overall_confidence

            is_disallowed_type = (doc_type in ["non_medical", "other"] or doc_type not in cls.ALLOWED_RAG_TYPES)
            is_disallowed_status = (status in cls.EXCLUDED_STATUSES or status not in cls.APPROVED_RAG_STATUSES)
            is_unverified = bool(d.needs_human_review)
            is_low_or_missing_conf = (conf is None or conf < cls.MIN_RAG_CONFIDENCE)

            if is_disallowed_type or is_disallowed_status or is_unverified or is_low_or_missing_conf:
                invalid_doc_ids.add(d.document_id)

        total_deleted = 0
        for doc_id in invalid_doc_ids:
            total_deleted += cls.delete_document_chunks(doc_id, user_id)
        return total_deleted

    @classmethod
    def retrieve_relevant_chunks(
        cls, user_id: str, query: str, top_k: int = 5
    ) -> List[Tuple[Dict[str, Any], float]]:
        """
        Retrieves top relevant chunks strictly scoped to the authenticated user_id.
        Enforces 100% tenant isolation and medical record eligibility (no non-medical or unverified chunks).
        """
        # Get user documents to build valid medical document whitelist
        user_docs = DocumentService.list_user_documents(user_id)
        valid_doc_map = {}
        for d in user_docs:
            doc_type = d.document_type.value
            status = d.status.value
            conf = d.confidence_score if d.confidence_score is not None else d.ocr_confidence
            if conf is None and d.extraction_result:
                conf = d.extraction_result.confidence
                if conf is None and d.extraction_result.confidence_info:
                    conf = d.extraction_result.confidence_info.overall_confidence

            is_valid_type = (doc_type in cls.ALLOWED_RAG_TYPES and doc_type not in ["non_medical", "other"])
            is_valid_status = (status in cls.APPROVED_RAG_STATUSES and status not in cls.EXCLUDED_STATUSES)
            is_verified = not bool(d.needs_human_review)
            has_confidence = (conf is not None and conf >= cls.MIN_RAG_CONFIDENCE)

            if is_valid_type and is_valid_status and is_verified and has_confidence:
                valid_doc_map[d.document_id] = d

        data = cls._load_data()
        user_chunks = [ch for ch in data["chunks"].values() if ch.get("user_id") == user_id]

        # Index any unindexed valid documents
        indexed_doc_ids = {ch.get("document_id") for ch in user_chunks}
        for d in valid_doc_map.values():
            if d.document_id not in indexed_doc_ids:
                rec = DocumentService.get_document_record(d.document_id, user_id)
                ext = rec.get("extraction_result", {})
                structured = ext.get("structured_data") if isinstance(ext, dict) else None
                conf = d.confidence_score if d.confidence_score is not None else d.ocr_confidence
                if conf is None and d.extraction_result:
                    conf = d.extraction_result.confidence
                    if conf is None and d.extraction_result.confidence_info:
                        conf = d.extraction_result.confidence_info.overall_confidence
                cls.chunk_and_index_document(
                    doc_id=d.document_id,
                    user_id=user_id,
                    filename=d.original_filename,
                    doc_type=d.document_type.value,
                    raw_text=rec.get("raw_text"),
                    structured_data=structured,
                    confidence=conf,
                    status=d.status.value,
                    requires_verification=bool(d.needs_human_review),
                )

        data = cls._load_data()
        raw_user_chunks = [ch for ch in data["chunks"].values() if ch.get("user_id") == user_id]

        # Strictly filter chunks: must belong to a known valid medical document
        valid_chunks = []
        for ch in raw_user_chunks:
            p_doc_id = ch.get("document_id")
            meta_type = (ch.get("metadata", {}).get("doc_type") or "").lower()
            if p_doc_id in valid_doc_map and meta_type in cls.ALLOWED_RAG_TYPES:
                valid_chunks.append(ch)

        # Extract substantive content words from query (ignoring stopwords)
        all_query_words = set(re.findall(r"\w+", query.lower()))
        content_query_words = {w for w in all_query_words if w not in cls.STOP_WORDS and len(w) > 2}
        keywords_to_match = content_query_words if content_query_words else all_query_words

        scored_chunks: List[Tuple[Dict[str, Any], float]] = []
        for ch in valid_chunks:
            text = ch.get("chunk_text", "").lower()
            ch_words = set(re.findall(r"\w+", text))
            if not ch_words:
                continue

            overlap = keywords_to_match.intersection(ch_words)
            if not overlap:
                continue

            # Token overlap score based on substantive query terms
            score = len(overlap) / (len(keywords_to_match) + 0.5)

            meta = ch.get("metadata", {})
            if meta.get("doc_type") and meta["doc_type"].lower() in query.lower():
                score += 0.25

            # Require minimum relevance threshold to prevent noise/false citations
            if score >= 0.20:
                scored_chunks.append((ch, score))

        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return scored_chunks[:top_k]

    @classmethod
    def create_conversation(cls, user_id: str, title: Optional[str] = None) -> ConversationResponse:
        """Creates a new private conversation session."""
        conv_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        title_str = title.strip() if title and title.strip() else "Medical Records Query"

        conv_data = {
            "id": conv_id,
            "user_id": user_id,
            "title": title_str,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        with cls._lock:
            data = cls._load_data()
            data["conversations"][conv_id] = conv_data
            cls._save_data(data)

        return ConversationResponse(
            id=conv_id,
            user_id=user_id,
            title=title_str,
            created_at=conv_data["created_at"],
            updated_at=conv_data["updated_at"],
            messages=[],
        )

    @classmethod
    def list_conversations(cls, user_id: str) -> List[ConversationResponse]:
        """Lists user's chat conversations in chronological order."""
        data = cls._load_data()
        convs = [
            ConversationResponse(
                id=c["id"],
                user_id=c["user_id"],
                title=c["title"],
                created_at=str(c["created_at"]),
                updated_at=str(c["updated_at"]),
            )
            for c in data["conversations"].values()
            if c.get("user_id") == user_id
        ]
        return sorted(convs, key=lambda x: x.updated_at, reverse=True)

    @classmethod
    def get_conversation(cls, conv_id: str, user_id: str) -> ConversationResponse:
        """Retrieves conversation with all messages after verifying ownership."""
        data = cls._load_data()
        c = data["conversations"].get(conv_id)
        if not c:
            raise EntityNotFoundException("Conversation", conv_id)
        if c.get("user_id") != user_id:
            raise ForbiddenException("Access to conversation denied.")

        msgs = [
            ChatMessageResponse(
                id=m["id"],
                conversation_id=m["conversation_id"],
                role=m["role"],
                content=m["content"],
                citations=[CitationItem(**cit) for cit in m.get("citations", [])],
                created_at=str(m["created_at"]),
                disclaimer=cls.SAFETY_DISCLAIMER,
            )
            for m in data["messages"].values()
            if m.get("conversation_id") == conv_id and m.get("user_id") == user_id
        ]
        msgs.sort(key=lambda x: x.created_at)

        return ConversationResponse(
            id=c["id"],
            user_id=c["user_id"],
            title=c["title"],
            created_at=str(c["created_at"]),
            updated_at=str(c["updated_at"]),
            messages=msgs,
        )

    @classmethod
    def delete_conversation(cls, conv_id: str, user_id: str) -> None:
        """Deletes conversation and associated messages."""
        data = cls._load_data()
        c = data["conversations"].get(conv_id)
        if not c:
            raise EntityNotFoundException("Conversation", conv_id)
        if c.get("user_id") != user_id:
            raise ForbiddenException("Access to conversation denied.")

        with cls._lock:
            del data["conversations"][conv_id]
            data["messages"] = {
                mid: m for mid, m in data["messages"].items() if m.get("conversation_id") != conv_id
            }
            cls._save_data(data)

    @classmethod
    async def ask_question(
        cls, conv_id: str, user_id: str, user_query: str
    ) -> ChatMessageResponse:
        """
        Executes citation-based RAG query against the user's isolated medical documents.
        Generates structured response with verifiable citations and strict safety disclaimers.
        """
        if not user_query.strip():
            raise ValidationException("Query cannot be empty.")

        # Verify conversation ownership
        data = cls._load_data()
        conv = data["conversations"].get(conv_id)
        if not conv:
            # Auto-create conversation if missing
            conv = cls.create_conversation(user_id, title=user_query[:40]).model_dump()

        if conv.get("user_id") != user_id:
            raise ForbiddenException("Access to conversation denied.")

        now = datetime.now(timezone.utc)

        # 1. Save user message
        user_msg_id = str(uuid.uuid4())
        user_msg_data = {
            "id": user_msg_id,
            "conversation_id": conv_id,
            "user_id": user_id,
            "role": "user",
            "content": user_query.strip(),
            "citations": [],
            "created_at": now.isoformat(),
        }

        # 2. Retrieve relevant chunks for user
        relevant_chunks = cls.retrieve_relevant_chunks(user_id, user_query)

        # 3. Generate response with citations
        citations: List[CitationItem] = []
        assistant_content: str = ""

        if not relevant_chunks:
            # Missing source information handling - exact required text
            assistant_content = "I couldn't find this information in your uploaded medical records."
            citations = []
        else:
            # Build context from chunks and collect citations
            context_blocks = []
            seen_docs = set()

            for chunk, score in relevant_chunks:
                meta = chunk.get("metadata", {})
                doc_id = chunk.get("document_id")
                filename = meta.get("filename", "Medical Document")
                doc_date = meta.get("date")

                context_blocks.append(chunk.get("chunk_text", ""))

                if doc_id and doc_id not in seen_docs:
                    seen_docs.add(doc_id)
                    citations.append(
                        CitationItem(
                            document_id=doc_id,
                            document_filename=filename,
                            document_date=doc_date,
                            document_type=meta.get("doc_type"),
                            snippet=chunk.get("chunk_text", "")[:200] + "...",
                            relevance_score=round(score, 2),
                        )
                    )

            # Generate synthesis using LLM or deterministic fallback
            assistant_content = await cls._synthesize_answer(user_query, context_blocks, citations)

        # 4. Save assistant response
        asst_msg_id = str(uuid.uuid4())
        asst_msg_data = {
            "id": asst_msg_id,
            "conversation_id": conv_id,
            "user_id": user_id,
            "role": "assistant",
            "content": assistant_content,
            "citations": [c.model_dump() for c in citations],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        with cls._lock:
            data = cls._load_data()
            data["messages"][user_msg_id] = user_msg_data
            data["messages"][asst_msg_id] = asst_msg_data
            # Update conversation timestamp
            if conv_id in data["conversations"]:
                data["conversations"][conv_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
            cls._save_data(data)

        AuditService.log_event(
            action=AuditAction.ASSISTANT_QUERY,
            resource_type="chat_conversation",
            resource_id=conv_id,
            user_id=user_id,
            metadata={"citations_count": len(citations)},
        )

        return ChatMessageResponse(
            id=asst_msg_id,
            conversation_id=conv_id,
            role="assistant",
            content=assistant_content,
            citations=citations,
            created_at=asst_msg_data["created_at"],
            disclaimer=cls.SAFETY_DISCLAIMER,
        )

    @classmethod
    async def _synthesize_answer(
        cls, query: str, context_blocks: List[str], citations: List[CitationItem]
    ) -> str:
        """
        Synthesizes an answer strictly based on retrieved context blocks.
        Enforces clinical safety constraints.
        """
        # If Gemini LLM is configured, call it
        if settings.LLM_PROVIDER.lower() == "gemini" and settings.LLM_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.LLM_API_KEY)
                model = genai.GenerativeModel(settings.LLM_MODEL)
                system_instruction = (
                    "You are the HealthSync AI Medical Records Assistant. "
                    "Your role is to summarize and explain the patient's existing uploaded records. "
                    "CRITICAL MEDICAL CONSTRAINTS:\n"
                    "1. NEVER diagnose diseases or medical conditions.\n"
                    "2. NEVER prescribe medications or suggest alternative drugs.\n"
                    "3. NEVER recommend changing, doubling, or stopping prescribed dosages.\n"
                    "4. ONLY provide information that is explicitly stated in the context excerpts below.\n"
                    "5. If the excerpts do not contain the answer, explicitly state that it is not in the records.\n"
                    "6. Always cite the document name when stating clinical facts.\n"
                    "7. Maintain a reassuring, clear, and professional tone."
                )
                prompt = (
                    f"{system_instruction}\n\n"
                    f"PATIENT'S MEDICAL EXCERPTS:\n"
                    + "\n---\n".join(context_blocks)
                    + f"\n\nPATIENT'S QUESTION: {query}\n\nANSWER:"
                )
                res = await model.generate_content_async(prompt)
                if res and res.text:
                    return res.text.strip()
            except Exception as e:
                logger.warning("Gemini RAG synthesis error: %s; falling back to deterministic synthesis", str(e))

        # Deterministic Clinical Response Synthesizer
        # Extracts relevant lines directly matching query keywords
        all_query_words = set(re.findall(r"\w+", query.lower()))
        content_query_words = {w for w in all_query_words if w not in cls.STOP_WORDS and len(w) > 2}
        keywords = content_query_words if content_query_words else all_query_words

        matching_lines = []
        fallback_lines = []
        for block in context_blocks:
            for line in block.split("\n"):
                s = line.strip()
                if not s or s.startswith("Document:"):
                    continue
                fallback_lines.append(s)
                line_words = set(re.findall(r"\w+", s.lower()))
                if keywords.intersection(line_words):
                    matching_lines.append(s)

        chosen_lines = matching_lines if matching_lines else fallback_lines
        if not chosen_lines:
            return "I couldn't find this information in your uploaded medical records."

        source_names = ", ".join(f"'{c.document_filename}'" for c in citations[:3])
        return (
            f"Based on your medical records in {source_names}:\n\n"
            + "\n".join(f"• {line}" for line in chosen_lines[:6])
            + "\n\n(Information extracted directly from your verified medical documentation. "
            "Please consult your prescribing physician for clinical decisions.)"
        )
