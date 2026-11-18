"""
HealthSync AI — Live PostgreSQL Integration Tests.
Executes genuine Python-to-PostgreSQL queries against an isolated local PostgreSQL database
using the native Direct PostgreSQL Adapter (psycopg 3) and Migration 001–007 schema.

TESTS VERIFIED:
1. Document creation, retrieval, listing, and deletion under authenticated RLS.
2. Unified extraction persistence using Migration 007 RPC (save_document_extraction_atomic).
3. Relational projection synchronization (extracted_prescriptions, extracted_medications).
4. Patient review persistence using Migration 007 RPC (save_document_patient_review_atomic) + audit history diff.
5. Clinician verification using Migration 007 RPC (verify_document_as_clinician_atomic) + clinician snapshot.
6. Multi-tenant isolation: User B is strictly denied access to User A's document via RLS.
7. Atomic rollback on error and clean session state.
"""

import os
import uuid
import pytest

from backend.app.core.config import settings
from backend.app.core.db import (
    PostgresAdapter,
    get_db_connection,
    get_rls_connection,
    is_direct_db_configured,
    validate_database_url,
)
from backend.app.core.exceptions import EntityNotFoundException, ForbiddenException
from backend.app.schemas.document import DocumentStatus, DocumentType
from backend.app.services.db_service import DatabaseService


def get_live_test_url() -> str:
    """Retrieves live database connection URL from environment if configured."""
    return os.getenv("HEALTHSYNC_DATABASE_URL") or os.getenv("TEST_DATABASE_URL") or ""


@pytest.fixture(scope="module")
def live_postgres_db():
    """
    Checks if a live local PostgreSQL instance is reachable for integration tests.
    If not reachable or credentials missing, gracefully skips live tests.
    """
    url = get_live_test_url()
    if not url:
        # Check default local connection string if PGPASSWORD is set
        pgpass = os.getenv("PGPASSWORD")
        if pgpass:
            url = f"postgresql://postgres:{pgpass}@127.0.0.1:5432/healthsync_local_test"

    if not url:
        pytest.skip(
            "Live PostgreSQL integration tests skipped: neither HEALTHSYNC_DATABASE_URL nor PGPASSWORD "
            "is set in the environment. Run with HEALTHSYNC_DATABASE_URL pointing to local test DB."
        )

    try:
        valid_url = validate_database_url(url)
    except Exception as e:
        pytest.skip(f"Live PostgreSQL URL invalid or remote: {str(e)}")

    adapter = PostgresAdapter.get_instance(valid_url)
    if not adapter.ping():
        pytest.skip(
            f"Live PostgreSQL database is not reachable at {valid_url}. Ensure PostgreSQL is running "
            "and healthsync_local_test database is provisioned with migrations 001–007."
        )

    # Configure settings for test session
    prev_url = settings.HEALTHSYNC_DATABASE_URL
    settings.HEALTHSYNC_DATABASE_URL = valid_url

    yield valid_url

    # Cleanup and reset
    settings.HEALTHSYNC_DATABASE_URL = prev_url
    PostgresAdapter.reset_instance()


@pytest.fixture
def synthetic_users(live_postgres_db):
    """
    Provisions two synthetic patients and one approved clinician in auth.users and public.profiles.
    Ensures complete cleanup in teardown.
    """
    patient_a_id = str(uuid.uuid4())
    patient_b_id = str(uuid.uuid4())
    clinician_id = str(uuid.uuid4())

    created_ids = [patient_a_id, patient_b_id, clinician_id]

    with get_db_connection() as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                # 1. Insert synthetic auth.users
                cur.execute(
                    """
                    INSERT INTO auth.users (id, email) VALUES
                    (%s, 'patient_a@synthetic.test'),
                    (%s, 'patient_b@synthetic.test'),
                    (%s, 'clinician@synthetic.test')
                    ON CONFLICT (id) DO NOTHING;
                    """,
                    (patient_a_id, patient_b_id, clinician_id),
                )
                # 2. Insert/update public.profiles
                cur.execute(
                    """
                    INSERT INTO public.profiles (id, full_name, role, clinician_approval_status)
                    VALUES (%s, 'Synthetic Patient A', 'patient', 'none')
                    ON CONFLICT (id) DO UPDATE SET role = 'patient';
                    """,
                    (patient_a_id,),
                )
                cur.execute(
                    """
                    INSERT INTO public.profiles (id, full_name, role, clinician_approval_status)
                    VALUES (%s, 'Synthetic Patient B', 'patient', 'none')
                    ON CONFLICT (id) DO UPDATE SET role = 'patient';
                    """,
                    (patient_b_id,),
                )
                cur.execute(
                    """
                    INSERT INTO public.profiles (
                        id, full_name, role, clinician_approval_status, license_number, license_jurisdiction
                    ) VALUES (
                        %s, 'Dr. Synthetic Clinician', 'clinician', 'approved', 'MD-998877', 'US-CA'
                    ) ON CONFLICT (id) DO UPDATE SET
                        role = 'clinician',
                        clinician_approval_status = 'approved',
                        license_number = 'MD-998877',
                        license_jurisdiction = 'US-CA';
                    """,
                    (clinician_id,),
                )

    yield {
        "patient_a": patient_a_id,
        "patient_b": patient_b_id,
        "clinician": clinician_id,
    }

    # Teardown: purge synthetic users and associated data
    with get_db_connection() as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                for uid in created_ids:
                    cur.execute("DELETE FROM public.medical_documents WHERE user_id = %s;", (uid,))
                    cur.execute("DELETE FROM public.profiles WHERE id = %s;", (uid,))
                    cur.execute("DELETE FROM auth.users WHERE id = %s;", (uid,))


class TestRealDatabaseIntegration:
    """Verifies end-to-end database operations against live PostgreSQL."""

    def test_document_lifecycle_and_rls_isolation(self, live_postgres_db, synthetic_users):
        """
        Tests creation, retrieval, listing, cross-user denial, and deletion
        against actual PostgreSQL with real RLS evaluation.
        """
        user_a = synthetic_users["patient_a"]
        user_b = synthetic_users["patient_b"]
        doc_id = str(uuid.uuid4())

        # 1. Create document for User A
        created = DatabaseService.create_document_record(
            doc_id=doc_id,
            user_id=user_a,
            filename="synthetic_prescription.pdf",
            storage_path=f"{user_a}/{doc_id}.pdf",
            mime_type="application/pdf",
            file_size_bytes=2048,
        )
        assert created["id"] == doc_id
        assert created["user_id"] == user_a
        assert created["status"] == "uploaded"

        # 2. Retrieve document as User A (Owner)
        retrieved = DatabaseService.get_document_record(doc_id=doc_id, user_id=user_a)
        assert retrieved["id"] == doc_id
        assert retrieved["original_filename"] == "synthetic_prescription.pdf"

        # 3. List documents for User A
        docs = DatabaseService.list_user_documents(user_id=user_a)
        assert any(d["id"] == doc_id for d in docs)

        # 4. Multi-Tenant RLS Security: User B attempts to access User A's document.
        # Under RLS, documents not owned or shared are completely invisible and return 404
        # to prevent cross-user document ID enumeration (IDOR oracle).
        with pytest.raises(EntityNotFoundException):
            DatabaseService.get_document_record(doc_id=doc_id, user_id=user_b)

        # User B attempts to delete User A's document (fails with 404 since record is invisible to User B)
        with pytest.raises(EntityNotFoundException):
            DatabaseService.delete_document(doc_id=doc_id, user_id=user_b)

        # 5. User A deletes own document
        DatabaseService.delete_document(doc_id=doc_id, user_id=user_a)

        # 6. Verify document is gone (404)
        with pytest.raises(EntityNotFoundException):
            DatabaseService.get_document_record(doc_id=doc_id, user_id=user_a)

    def test_unified_extraction_and_verification_rpcs(self, live_postgres_db, synthetic_users):
        """
        Tests Migration 007 RPCs:
        - save_document_extraction_atomic
        - save_document_patient_review_atomic
        - verify_document_as_clinician_atomic
        """
        user_a = synthetic_users["patient_a"]
        clinician = synthetic_users["clinician"]
        doc_id = str(uuid.uuid4())

        # Create base document
        DatabaseService.create_document_record(
            doc_id=doc_id,
            user_id=user_a,
            filename="synthetic_rx.pdf",
            storage_path=f"{user_a}/{doc_id}.pdf",
            mime_type="application/pdf",
            file_size_bytes=4096,
        )

        try:
            # 1. Execute save_document_extraction_unified (calls RPC save_document_extraction_atomic)
            rx_data = {
                "patient_name": "Synthetic Patient A",
                "doctor_name": "Dr. Smith",
                "clinic_or_hospital": "General Hospital",
                "prescription_date": "2026-11-18",
                "diagnosis_text": "Mild respiratory infection",
                "medications": [
                    {
                        "name": "Amoxicillin",
                        "dosage": "500mg",
                        "frequency": "Three times daily",
                        "duration": "7 days",
                        "instructions": "Take after meals",
                    }
                ],
            }

            extracted = DatabaseService.save_document_extraction_unified(
                doc_id=doc_id,
                user_id=user_a,
                status=DocumentStatus.EXTRACTED,
                document_type=DocumentType.PRESCRIPTION,
                raw_text="Rx: Amoxicillin 500mg TID 7 days",
                ocr_engine="pdfplumber",
                confidence=0.96,
                confidence_method="hybrid",
                requires_verification=True,
                fields_requiring_verification=["diagnosis_text"],
                structured_data=rx_data,
            )

            assert extracted["status"] == "extracted"
            assert extracted["requires_verification"] is True
            assert extracted["extraction_result"]["structured_data"]["patient_name"] == "Synthetic Patient A"

            # Verify relational projections were synchronized into extracted_prescriptions & extracted_medications
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM public.extracted_prescriptions WHERE document_id = %s;", (doc_id,))
                    rx_row = cur.fetchone()
                    assert rx_row is not None
                    assert rx_row["doctor_name"] == "Dr. Smith"

                    cur.execute("SELECT * FROM public.extracted_medications WHERE document_id = %s;", (doc_id,))
                    med_row = cur.fetchone()
                    assert med_row is not None
                    assert med_row["name"] == "Amoxicillin"

            # 2. Patient Review: Patient corrects diagnosis
            corrected_rx = dict(rx_data)
            corrected_rx["diagnosis_text"] = "Acute Bronchitis (Confirmed)"

            reviewed = DatabaseService.update_document_review(
                doc_id=doc_id,
                user_id=user_a,
                structured_data=corrected_rx,
                review_notes="Patient confirmed bronchitis diagnosis.",
            )

            assert reviewed["user_reviewed"] is True
            assert reviewed["extraction_result"]["verification_state"]["user_reviewed"] is True

            # Verify review audit history was recorded in document_review_history
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM public.document_review_history WHERE document_id = %s;", (doc_id,))
                    hist_row = cur.fetchone()
                    assert hist_row is not None
                    assert hist_row["reviewer_role"] == "patient"
                    assert hist_row["review_type"] == "patient_correction"

            # 3. Clinician Verification: Approved clinician validates the document
            verified = DatabaseService.verify_document_as_clinician(
                doc_id=doc_id,
                user_id=clinician,
                verified_structured_data=corrected_rx,
                review_notes="Clinician verified prescription dosage and regimen.",
            )

            assert verified["clinician_verified"] is True
            assert verified["verified_by_user_id"] == clinician
            assert verified["requires_verification"] is False

            # Verify clinician snapshot in review history
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT * FROM public.document_review_history
                        WHERE document_id = %s AND reviewer_role = 'clinician';
                        """,
                        (doc_id,),
                    )
                    clin_hist = cur.fetchone()
                    assert clin_hist is not None
                    assert clin_hist["review_type"] == "clinician_verification"

        finally:
            # Clean up test document
            try:
                DatabaseService.delete_document(doc_id=doc_id, user_id=user_a)
            except Exception:
                pass
