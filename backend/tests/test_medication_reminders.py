import pytest
from datetime import date, datetime, timedelta, timezone
from fastapi.testclient import TestClient

from backend.main import app
from backend.app.services.reminder_service import ReminderService
from backend.tests.conftest import create_test_jwt, TEST_JWT_SECRET


@pytest.fixture(autouse=True)
def reset_reminders():
    ReminderService._save_data({"schedules": {}, "reminders": {}, "logs": {}})
    yield



def test_create_medication_schedule_with_validation(client: TestClient):
    """Tests medication schedule creation and input validation."""
    token = create_test_jwt("user-rem-001", "remuser@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Valid creation
    payload = {
        "medication_name": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "TWICE_DAILY",
        "reminder_times": ["08:00", "20:00"],
        "timezone": "UTC",
        "start_date": str(date.today()),
        "instructions": "Take after breakfast and dinner",
        "user_confirmed": True,
    }
    res = client.post("/api/v1/reminders/schedules", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["medication_name"] == "Amoxicillin"
    assert data["dosage"] == "500mg"
    assert data["frequency"] == "TWICE_DAILY"
    assert len(data["reminder_times"]) == 2
    assert data["user_confirmed"] is True
    sched_id = data["id"]

    # 2. Invalid time format rejected
    bad_payload = {
        "medication_name": "Ibuprofen",
        "frequency": "CUSTOM",
        "reminder_times": ["25:99"],  # Invalid
        "user_confirmed": True,
    }
    res_bad = client.post("/api/v1/reminders/schedules", json=bad_payload, headers=headers)
    assert res_bad.status_code == 422 or res_bad.status_code == 400


def test_unconfirmed_schedule_does_not_activate_reminders(client: TestClient):
    """Ensures unconfirmed schedule does not automatically generate active reminders."""
    token = create_test_jwt("user-rem-unconf", "unconf@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "medication_name": "Lisinopril",
        "dosage": "10mg",
        "frequency": "ONCE_DAILY",
        "reminder_times": ["09:00"],
        "timezone": "UTC",
        "user_confirmed": False,  # Unconfirmed
    }
    res = client.post("/api/v1/reminders/schedules", json=payload, headers=headers)
    assert res.status_code == 201
    sched_data = res.json()
    assert sched_data["user_confirmed"] is False

    # Check today's reminders -> should be 0 because unconfirmed
    res_today = client.get("/api/v1/reminders/today", headers=headers)
    assert res_today.status_code == 200
    reminders = res_today.json()
    assert len(reminders) == 0


def test_today_reminders_and_dose_logging(client: TestClient):
    """Tests today's reminder retrieval, dose logging (taken/skipped), and adherence stats."""
    token = create_test_jwt("user-rem-dose", "dose@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    # Create active confirmed schedule
    payload = {
        "medication_name": "Metformin",
        "dosage": "500mg",
        "frequency": "ONCE_DAILY",
        "reminder_times": ["12:00"],
        "timezone": "UTC",
        "start_date": str(date.today()),
        "user_confirmed": True,
    }
    res_create = client.post("/api/v1/reminders/schedules", json=payload, headers=headers)
    assert res_create.status_code == 201

    # Fetch today's reminders
    res_today = client.get("/api/v1/reminders/today", headers=headers)
    assert res_today.status_code == 200
    today_doses = res_today.json()
    assert len(today_doses) >= 1
    dose_id = today_doses[0]["id"]
    assert today_doses[0]["medication_name"] == "Metformin"
    assert today_doses[0]["status"] == "PENDING"

    # Mark dose as taken
    res_taken = client.post(
        f"/api/v1/reminders/{dose_id}/log",
        json={"action": "TAKEN", "notes": "Taken with lunch"},
        headers=headers,
    )
    assert res_taken.status_code == 200
    assert res_taken.json()["status"] == "TAKEN"

    # Mark notification sent (prevents duplicate alerts)
    res_notify = client.post(f"/api/v1/reminders/{dose_id}/notify", headers=headers)
    assert res_notify.status_code == 200

    # Check adherence statistics
    res_adh = client.get("/api/v1/reminders/adherence?days=7", headers=headers)
    assert res_adh.status_code == 200
    adh_data = res_adh.json()
    assert adh_data["total_scheduled"] >= 1
    assert adh_data["total_taken"] >= 1
    assert adh_data["adherence_percentage"] == 100.0
    assert "HealthSync AI reminders track" in adh_data["medical_safety_disclaimer"]


def test_duplicate_reminder_prevention(client: TestClient):
    """Ensures calling today's reminders multiple times does NOT generate duplicate doses."""
    token = create_test_jwt("user-dup-test", "duptest@healthsync.ai")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "medication_name": "Atorvastatin",
        "dosage": "20mg",
        "frequency": "ONCE_DAILY",
        "reminder_times": ["21:00"],
        "timezone": "UTC",
        "user_confirmed": True,
    }
    client.post("/api/v1/reminders/schedules", json=payload, headers=headers)

    # First fetch
    res1 = client.get("/api/v1/reminders/today", headers=headers)
    doses1 = res1.json()

    # Second fetch
    res2 = client.get("/api/v1/reminders/today", headers=headers)
    doses2 = res2.json()

    # Number of doses must not increase
    assert len(doses1) == len(doses2) == 1
    assert doses1[0]["id"] == doses2[0]["id"]


def test_schedule_user_ownership_isolation(client: TestClient):
    """Ensures User B cannot view, modify or delete User A's medication schedule."""
    token_a = create_test_jwt("user-a-sched", "usera@healthsync.ai")
    token_b = create_test_jwt("user-b-sched", "userb@healthsync.ai")

    # User A creates schedule
    res_create = client.post(
        "/api/v1/reminders/schedules",
        json={"medication_name": "Private Med A", "frequency": "ONCE_DAILY", "user_confirmed": True},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    sched_id = res_create.json()["id"]

    # User B tries to get it -> 403 Forbidden
    res_get = client.get(
        f"/api/v1/reminders/schedules/{sched_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_get.status_code == 403

    # User B tries to update it -> 403 Forbidden
    res_patch = client.patch(
        f"/api/v1/reminders/schedules/{sched_id}",
        json={"medication_name": "Tampered"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_patch.status_code == 403

    # User B tries to delete it -> 403 Forbidden
    res_del = client.delete(
        f"/api/v1/reminders/schedules/{sched_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_del.status_code == 403
