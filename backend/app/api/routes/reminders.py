from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from backend.app.core.auth import get_current_user, UserTokenPayload
from backend.app.schemas.reminders import (
    AdherenceStatsResponse,
    LogMedicationActionRequest,
    MedicationReminderResponse,
    MedicationScheduleCreate,
    MedicationScheduleResponse,
    MedicationScheduleUpdate,
)
from backend.app.services.reminder_service import ReminderService

router = APIRouter(prefix="/reminders", tags=["Medication Reminders"])


@router.post(
    "/schedules",
    response_model=MedicationScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Medication Reminder Schedule",
    description="Creates a new dosage schedule. Requires user confirmation before generating live reminders.",
)
def create_schedule(
    payload: MedicationScheduleCreate,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> MedicationScheduleResponse:
    """Creates a medication schedule for the authenticated patient."""
    return ReminderService.create_schedule(current_user.user_id, payload)


@router.get(
    "/schedules",
    response_model=List[MedicationScheduleResponse],
    status_code=status.HTTP_200_OK,
    summary="List Medication Schedules",
    description="Returns all active or inactive medication schedules owned by the patient.",
)
def list_schedules(
    active_only: bool = Query(False, description="Filter for active schedules only"),
    current_user: UserTokenPayload = Depends(get_current_user),
) -> List[MedicationScheduleResponse]:
    """Lists medication schedules."""
    return ReminderService.list_schedules(current_user.user_id, active_only=active_only)


@router.get(
    "/schedules/{schedule_id}",
    response_model=MedicationScheduleResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Medication Schedule",
    description="Retrieves a specific medication schedule after verifying ownership.",
)
def get_schedule(
    schedule_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> MedicationScheduleResponse:
    """Retrieves schedule details."""
    return ReminderService.get_schedule(schedule_id, current_user.user_id)


@router.patch(
    "/schedules/{schedule_id}",
    response_model=MedicationScheduleResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Medication Schedule",
    description="Updates schedule dosage, frequency, times, or active status.",
)
def update_schedule(
    schedule_id: str,
    payload: MedicationScheduleUpdate,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> MedicationScheduleResponse:
    """Updates a medication schedule."""
    return ReminderService.update_schedule(schedule_id, current_user.user_id, payload)


@router.delete(
    "/schedules/{schedule_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Medication Schedule",
    description="Permanently deletes a schedule and its linked reminder doses.",
)
def delete_schedule(
    schedule_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> dict:
    """Deletes schedule."""
    ReminderService.delete_schedule(schedule_id, current_user.user_id)
    return {"status": "success", "message": "Medication schedule deleted."}


@router.get(
    "/today",
    response_model=List[MedicationReminderResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Today's Scheduled Reminders",
    description="Returns all scheduled dosage instances for today with taken/skipped status.",
)
def get_today_reminders(
    current_user: UserTokenPayload = Depends(get_current_user),
) -> List[MedicationReminderResponse]:
    """Retrieves today's scheduled doses."""
    return ReminderService.get_today_reminders(current_user.user_id)


@router.post(
    "/{reminder_id}/log",
    response_model=MedicationReminderResponse,
    status_code=status.HTTP_200_OK,
    summary="Log Dose Action (Taken / Skipped)",
    description="Records adherence event. Never advises users to double or alter prescribed doses.",
)
def log_dose_action(
    reminder_id: str,
    payload: LogMedicationActionRequest,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> MedicationReminderResponse:
    """Logs medication dose action."""
    return ReminderService.log_action(
        reminder_id=reminder_id,
        user_id=current_user.user_id,
        action=payload.action,
        notes=payload.notes,
    )


@router.post(
    "/{reminder_id}/notify",
    status_code=status.HTTP_200_OK,
    summary="Mark Reminder Notification Sent",
    description="Prevents duplicate notification alerts for the same reminder dose.",
)
def mark_notification_sent(
    reminder_id: str,
    current_user: UserTokenPayload = Depends(get_current_user),
) -> dict:
    """Records notification dispatch."""
    ReminderService.mark_notification_sent(reminder_id, current_user.user_id)
    return {"status": "success", "message": "Notification status recorded."}


@router.get(
    "/adherence",
    response_model=AdherenceStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Medication Adherence Statistics",
    description="Computes adherence percentage and weekly breakdown of scheduled, taken, and skipped doses.",
)
def get_adherence_stats(
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    current_user: UserTokenPayload = Depends(get_current_user),
) -> AdherenceStatsResponse:
    """Calculates adherence statistics."""
    return ReminderService.get_adherence_stats(current_user.user_id, days=days)
