from datetime import date, datetime, time
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FrequencyType(str, Enum):
    ONCE_DAILY = "ONCE_DAILY"
    TWICE_DAILY = "TWICE_DAILY"
    THREE_TIMES_DAILY = "THREE_TIMES_DAILY"
    CUSTOM = "CUSTOM"


class ReminderStatus(str, Enum):
    PENDING = "PENDING"
    NOTIFIED = "NOTIFIED"
    TAKEN = "TAKEN"
    SKIPPED = "SKIPPED"
    MISSED = "MISSED"


class MedicationActionType(str, Enum):
    TAKEN = "TAKEN"
    SKIPPED = "SKIPPED"
    MISSED = "MISSED"


class MedicationScheduleCreate(BaseModel):
    medication_name: str = Field(..., min_length=1, max_length=200, examples=["Amoxicillin"])
    dosage: Optional[str] = Field(None, max_length=100, examples=["500mg"])
    frequency: FrequencyType = Field(default=FrequencyType.ONCE_DAILY)
    reminder_times: List[str] = Field(
        default=["09:00"],
        description="List of HH:MM strings in 24-hour format",
        examples=[["08:00", "20:00"]],
    )
    timezone: str = Field(default="UTC", examples=["America/New_York", "UTC"])
    start_date: date = Field(default_factory=date.today)
    end_date: Optional[date] = Field(None)
    instructions: Optional[str] = Field(None, max_length=500, examples=["Take with food and water"])
    document_id: Optional[str] = Field(None, description="Linked medical document UUID")
    prescription_id: Optional[str] = Field(None, description="Linked prescription entity UUID")
    user_confirmed: bool = Field(
        default=True,
        description="Explicit user confirmation required before generating live reminders",
    )


class MedicationScheduleUpdate(BaseModel):
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[FrequencyType] = None
    reminder_times: Optional[List[str]] = None
    timezone: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    instructions: Optional[str] = None
    is_active: Optional[bool] = None
    user_confirmed: Optional[bool] = None


class MedicationScheduleResponse(BaseModel):
    id: str
    user_id: str
    medication_name: str
    dosage: Optional[str] = None
    frequency: FrequencyType
    reminder_times: List[str]
    timezone: str = "UTC"
    start_date: str
    end_date: Optional[str] = None
    instructions: Optional[str] = None
    is_active: bool
    user_confirmed: bool
    document_id: Optional[str] = None
    prescription_id: Optional[str] = None
    created_at: str
    updated_at: str


class MedicationReminderResponse(BaseModel):
    id: str
    schedule_id: str
    user_id: str
    medication_name: str
    dosage: Optional[str] = None
    scheduled_for: str
    status: ReminderStatus
    instructions: Optional[str] = None
    notification_sent_at: Optional[str] = None
    created_at: str


class LogMedicationActionRequest(BaseModel):
    action: MedicationActionType
    notes: Optional[str] = Field(None, max_length=300)


class DailyAdherenceItem(BaseModel):
    date: str
    scheduled: int
    taken: int
    skipped: int
    missed: int


class AdherenceStatsResponse(BaseModel):
    total_scheduled: int
    total_taken: int
    total_skipped: int
    total_missed: int
    adherence_percentage: Optional[float] = None
    streak_days: int
    daily_breakdown: List[DailyAdherenceItem]
    medical_safety_disclaimer: str
