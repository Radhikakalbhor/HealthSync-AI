import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.app.services.rag_service import RAGAssistantService
from backend.app.services.document_service import DocumentService
from backend.tests.conftest import create_test_jwt


def test_conversation_lifecycle_and_isolation(client: TestClient):
    """Tests conversation creation, message history, and user isolation."""
    token_a = create_test_jwt("user-rag-a", "raga@healthsync.ai")
    token_b = create_test_jwt("user-rag-b", "ragb@healthsync.ai")

    # User A creates a conversation
    res_create = client.post(
        "/api/v1/assistant/conversations",
        json={"title": "Blood Test Analysis"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_create.status_code == 201
    conv_a_id = res_create.json()["id"]

    # User B lists conversations -> must NOT see User A's conversation
    res_b_list = client.get(
        "/api/v1/assistant/conversations",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b_list.status_code == 200
    b_conv_ids = [c["id"] for c in res_b_list.json()]
    assert conv_a_id not in b_conv_ids

    # User B tries to view User A's conversation -> 403 Forbidden
    res_b_get = client.get(
        f"/api/v1/assistant/conversations/{conv_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b_get.status_code == 403


def test_rag_query_with_citations_and_missing_source_handling(client: TestClient):
    """Tests RAG query returning verifiable citations, and handles missing information gracefully."""
    token = create_test_jwt("user-rag-patient", "ragpatient@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    # Register document record in DocumentService so whitelist includes it
    DocumentService._save_record(
        "doc-prescription-777",
        {
            "document_id": "doc-prescription-777",
            "user_id": "user-rag-patient",
            "original_filename": "Prescription_DrSmith.pdf",
            "stored_filename": "doc-prescription-777.pdf",
            "storage_path": "doc-prescription-777.pdf",
            "mime_type": "application/pdf",
            "document_type": "prescription",
            "status": "extracted",
            "confidence": 0.95,
            "ocr_confidence": 0.95,
            "requires_verification": False,
            "raw_text": "Dr. Sarah Smith prescribed Amoxicillin 500mg three times daily for 7 days.",
        },
    )

    # Index sample medical document chunks for this user
    RAGAssistantService.chunk_and_index_document(
        doc_id="doc-prescription-777",
        user_id="user-rag-patient",
        filename="Prescription_DrSmith.pdf",
        doc_type="prescription",
        raw_text="Dr. Sarah Smith prescribed Amoxicillin 500mg three times daily for 7 days.",
        structured_data={
            "doctor_name": "Dr. Sarah Smith",
            "prescription_date": "15/11/2026",
            "medications": [
                {
                    "name": "Amoxicillin",
                    "dosage": "500mg",
                    "frequency": "Three times daily",
                    "instructions": "Take after meals",
                }
            ],
        },
        confidence=0.95,
        status="extracted",
        requires_verification=False,
    )

    # 1. Create conversation
    res_conv = client.post(
        "/api/v1/assistant/conversations",
        json={"title": "Medication Inquiry"},
        headers=headers,
    )
    conv_id = res_conv.json()["id"]

    # 2. Ask question about prescribed medicine
    res_ask = client.post(
        f"/api/v1/assistant/conversations/{conv_id}/messages",
        json={"content": "What dose of Amoxicillin was prescribed to me?"},
        headers=headers,
    )
    assert res_ask.status_code == 200
    reply = res_ask.json()
    assert reply["role"] == "assistant"
    assert len(reply["citations"]) >= 1
    citation = reply["citations"][0]
    assert citation["document_id"] == "doc-prescription-777"
    assert citation["document_filename"] == "Prescription_DrSmith.pdf"
    assert "Amoxicillin" in reply["content"]
    assert "HealthSync AI explains information" in reply["disclaimer"]

    # 3. Ask question about an analyte NOT in the records
    res_missing = client.post(
        f"/api/v1/assistant/conversations/{conv_id}/messages",
        json={"content": "What was my Ferritin level?"},
        headers=headers,
    )
    assert res_missing.status_code == 200
    missing_reply = res_missing.json()
    assert "couldn't find" in missing_reply["content"].lower() or "could not find" in missing_reply["content"].lower() or "not found" in missing_reply["content"].lower()


def test_rag_cross_tenant_isolation(client: TestClient):
    """Ensures Patient A's medical chunks are never returned to Patient B."""
    token_a = create_test_jwt("patient-a", "patienta@healthsync.ai")
    token_b = create_test_jwt("patient-b", "patientb@healthsync.ai")

    # Index secret clinical data for Patient A
    RAGAssistantService.chunk_and_index_document(
        doc_id="doc-confidential-a",
        user_id="patient-a",
        filename="SecretDiagnosisA.pdf",
        doc_type="consultation_record",
        raw_text="Patient A has a secret private prescription for SpecializedMedicationX.",
        structured_data=None,
    )

    # Patient B creates conversation
    res_conv_b = client.post(
        "/api/v1/assistant/conversations",
        json={"title": "Patient B Chat"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    conv_b_id = res_conv_b.json()["id"]

    # Patient B asks about SpecializedMedicationX
    res_query_b = client.post(
        f"/api/v1/assistant/conversations/{conv_b_id}/messages",
        json={"content": "Do I take SpecializedMedicationX?"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_query_b.status_code == 200
    b_data = res_query_b.json()

    # Patient B must NOT receive Patient A's citation or content
    assert len(b_data["citations"]) == 0
    assert "doc-confidential-a" not in [c["document_id"] for c in b_data["citations"]]
    assert "couldn't find" in b_data["content"].lower() or "could not find" in b_data["content"].lower() or "not found" in b_data["content"].lower()
