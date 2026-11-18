import json
import logging
import threading
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from backend.app.core.config import settings
from backend.app.core.exceptions import EntityNotFoundException, ValidationException, ForbiddenException
from backend.app.core.supabase_client import get_supabase_admin_client, is_supabase_configured
from backend.app.schemas.reminders import (
    FrequencyType,
    MedicationActionType,
    MedicationScheduleCreate,
    MedicationScheduleResponse,
    MedicationScheduleUpdate,
    MedicationReminderResponse,
    ReminderStatus,
    AdherenceStatsResponse,
    DailyAdherenceItem,
)
from backend.app.services.audit_service import AuditService, AuditAction
from backend.app.utils.file_security import ensure_upload_dir

logger = logging.getLogger("healthsync.reminders")


class ReminderService:
    """
    Manages medication schedules, dose generation, adherence tracking,
    and reminder dispatch. Enforces strict user ownership, timezone-aware
    scheduling, and duplicate notification prevention.
    """

    _lock = threading.RLock()
    _data_file = ensure_upload_dir() / "medication_reminders.json"

    # Medical safety rule
    SAFETY_DISCLAIMER = (
        "HealthSync AI reminders track your prescribed dosage schedule for organizational purposes only. "
        "NEVER double a dose if missed, and never adjust or stop your medication without explicit guidance "
        "from your prescribing healthcare professional."
    )

    @classmethod
    def _is_demo_user(cls, user_id: str) -> bool:
        return user_id == "demo-patient-001" or (isinstance(user_id, str) and user_id.startswith("demo-"))

    @classmethod
    def _should_use_supabase(cls, user_id: str) -> bool:
        if cls._is_demo_user(user_id):
            return False
        return is_supabase_configured()

    @classmethod
    def _ensure_demo_seeded(cls, user_id: str) -> None:
        if not cls._is_demo_user(user_id):
            return
        data = cls._load_data()
        if "demo-sched-lisinopril" in data.get("schedules", {}):
            return
        from backend.app.core.demo_data import seed_demo_reminders
        seed_demo_reminders(user_id)

    @classmethod
    def _load_data(cls) -> Dict[str, Any]:
        """Loads reminders store from local fallback file."""
        if not cls._data_file.exists():
            return {"schedules": {}, "reminders": {}, "logs": {}}
        try:
            with open(cls._data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"schedules": {}, "reminders": {}, "logs": {}}

    @classmethod
    def _save_data(cls, data: Dict[str, Any]) -> None:
        """Saves data to local fallback file."""
        with cls._lock:
            with open(cls._data_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)

    @classmethod
    def _parse_timezone(cls, tz_str: Optional[str]):
        """Parses timezone string safely, defaulting to UTC."""
        if not tz_str or tz_str.upper() in {"UTC", "GMT", "Z"}:
            return timezone.utc
        try:
            return ZoneInfo(tz_str)
        except Exception:
            return timezone.utc

    @classmethod
    def _normalize_times(cls, frequency: FrequencyType, user_times: Optional[List[str]]) -> List[str]:
        """Derives default times based on frequency if not explicitly provided."""
        if user_times and len(user_times) > 0:
            return user_times

        if frequency == FrequencyType.ONCE_DAILY:
            return ["09:00"]
        elif frequency == FrequencyType.TWICE_DAILY:
            return ["08:00", "20:00"]
        elif frequency == FrequencyType.THREE_TIMES_DAILY:
            return ["08:00", "14:00", "20:00"]
        return ["09:00"]

    @classmethod
    def create_schedule(
        cls, user_id: str, payload: MedicationScheduleCreate
    ) -> MedicationScheduleResponse:
        """
        Creates a new medication schedule.
        Requires explicit user confirmation before activating live reminders.
        """
        if not payload.medication_name.strip():
            raise ValidationException("Medication name cannot be empty.")

        # Validate timezone
        tz = cls._parse_timezone(payload.timezone)

        times = cls._normalize_times(payload.frequency, payload.reminder_times)
        for t in times:
            parts = t.split(":")
            if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
                raise ValidationException(f"Invalid reminder time format '{t}'. Must be HH:MM.")
            h, m = int(parts[0]), int(parts[1])
            if not (0 <= h < 24 and 0 <= m < 60):
                raise ValidationException(f"Time '{t}' out of bounds. Must be 00:00 - 23:59.")

        schedule_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        schedule_data = {
            "id": schedule_id,
            "user_id": user_id,
            "medication_name": payload.medication_name.strip(),
            "dosage": payload.dosage.strip() if payload.dosage else None,
            "frequency": payload.frequency.value,
            "reminder_times": times,
            "timezone": payload.timezone,
            "start_date": payload.start_date.isoformat(),
            "end_date": payload.end_date.isoformat() if payload.end_date else None,
            "instructions": payload.instructions.strip() if payload.instructions else None,
            "is_active": True,
            "user_confirmed": payload.user_confirmed,
            "document_id": payload.document_id,
            "prescription_id": payload.prescription_id,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        # Supabase persistence if available
        if cls._should_use_supabase(user_id):
            try:
                admin_client = get_supabase_admin_client()
                admin_client.table("medication_schedules").insert(schedule_data).execute()
            except Exception as e:
                logger.warning("Supabase schedule insert warning: %s", str(e))

        # Local persistence
        with cls._lock:
            data = cls._load_data()
            data["schedules"][schedule_id] = schedule_data
            cls._save_data(data)

        # Generate today's reminders if user confirmed
        if payload.user_confirmed:
            cls._generate_reminders_for_schedule(schedule_data)

        AuditService.log_event(
            action=AuditAction.REMINDER_CREATE,
            resource_type="medication_schedule",
            resource_id=schedule_id,
            user_id=user_id,
            metadata={"medication": payload.medication_name},
        )

        return MedicationScheduleResponse(
            id=schedule_id,
            user_id=user_id,
            medication_name=schedule_data["medication_name"],
            dosage=schedule_data["dosage"],
            frequency=FrequencyType(schedule_data["frequency"]),
            reminder_times=schedule_data["reminder_times"],
            timezone=schedule_data["timezone"],
            start_date=schedule_data["start_date"],
            end_date=schedule_data["end_date"],
            instructions=schedule_data["instructions"],
            is_active=schedule_data["is_active"],
            user_confirmed=schedule_data["user_confirmed"],
            document_id=schedule_data["document_id"],
            prescription_id=schedule_data["prescription_id"],
            created_at=schedule_data["created_at"],
            updated_at=schedule_data["updated_at"],
        )

    @classmethod
    def list_schedules(cls, user_id: str, active_only: bool = False) -> List[MedicationScheduleResponse]:
        """Lists medication schedules for the user."""
        cls._ensure_demo_seeded(user_id)
        if cls._should_use_supabase(user_id):
            try:
                admin_client = get_supabase_admin_client()
                query = admin_client.table("medication_schedules").select("*").eq("user_id", user_id)
                if active_only:
                    query = query.eq("is_active", True)
                res = query.order("created_at", desc=True).execute()
                if res.data:
                    return [
                        MedicationScheduleResponse(
                            id=r["id"],
                            user_id=r["user_id"],
                            medication_name=r["medication_name"],
                            dosage=r.get("dosage"),
                            frequency=FrequencyType(r.get("frequency", "ONCE_DAILY")),
                            reminder_times=r.get("reminder_times", ["09:00"]),
                            timezone=r.get("timezone", "UTC"),
                            start_date=str(r["start_date"]),
                            end_date=str(r["end_date"]) if r.get("end_date") else None,
                            instructions=r.get("instructions"),
                            is_active=r["is_active"],
                            user_confirmed=r.get("user_confirmed", True),
                            document_id=r.get("document_id"),
                            prescription_id=r.get("prescription_id"),
                            created_at=str(r["created_at"]),
                            updated_at=str(r["updated_at"]),
                        )
                        for r in res.data
                    ]
            except Exception as e:
                logger.warning("Supabase schedule list warning: %s", str(e))

        data = cls._load_data()
        results = []
        for s in data["schedules"].values():
            if s.get("user_id") == user_id:
                if active_only and not s.get("is_active", True):
                    continue
                results.append(
                    MedicationScheduleResponse(
                        id=s["id"],
                        user_id=s["user_id"],
                        medication_name=s["medication_name"],
                        dosage=s.get("dosage"),
                        frequency=FrequencyType(s.get("frequency", "ONCE_DAILY")),
                        reminder_times=s.get("reminder_times", ["09:00"]),
                        timezone=s.get("timezone", "UTC"),
                        start_date=str(s["start_date"]),
                        end_date=str(s["end_date"]) if s.get("end_date") else None,
                        instructions=s.get("instructions"),
                        is_active=s.get("is_active", True),
                        user_confirmed=s.get("user_confirmed", True),
                        document_id=s.get("document_id"),
                        prescription_id=s.get("prescription_id"),
                        created_at=str(s["created_at"]),
                        updated_at=str(s["updated_at"]),
                    )
                )
        return sorted(results, key=lambda x: x.created_at, reverse=True)

    @classmethod
    def get_schedule(cls, schedule_id: str, user_id: str) -> MedicationScheduleResponse:
        """Retrieves single schedule after verifying ownership."""
        data = cls._load_data()
        s = data["schedules"].get(schedule_id)
        if not s:
            raise EntityNotFoundException("Medication schedule", schedule_id)
        if s.get("user_id") != user_id:
            raise ForbiddenException("Access to medication schedule denied.")

        return MedicationScheduleResponse(
            id=s["id"],
            user_id=s["user_id"],
            medication_name=s["medication_name"],
            dosage=s.get("dosage"),
            frequency=FrequencyType(s.get("frequency", "ONCE_DAILY")),
            reminder_times=s.get("reminder_times", ["09:00"]),
            timezone=s.get("timezone", "UTC"),
            start_date=str(s["start_date"]),
            end_date=str(s["end_date"]) if s.get("end_date") else None,
            instructions=s.get("instructions"),
            is_active=s.get("is_active", True),
            user_confirmed=s.get("user_confirmed", True),
            document_id=s.get("document_id"),
            prescription_id=s.get("prescription_id"),
            created_at=str(s["created_at"]),
            updated_at=str(s["updated_at"]),
        )

    @classmethod
    def update_schedule(
        cls, schedule_id: str, user_id: str, payload: MedicationScheduleUpdate
    ) -> MedicationScheduleResponse:
        """Updates schedule status or details."""
        data = cls._load_data()
        s = data["schedules"].get(schedule_id)
        if not s:
            raise EntityNotFoundException("Medication schedule", schedule_id)
        if s.get("user_id") != user_id:
            raise ForbiddenException("Access to medication schedule denied.")

        now = datetime.now(timezone.utc)
        if payload.medication_name is not None:
            s["medication_name"] = payload.medication_name.strip()
        if payload.dosage is not None:
            s["dosage"] = payload.dosage.strip()
        if payload.frequency is not None:
            s["frequency"] = payload.frequency.value
        if payload.reminder_times is not None:
            s["reminder_times"] = payload.reminder_times
        if payload.timezone is not None:
            s["timezone"] = payload.timezone
        if payload.start_date is not None:
            s["start_date"] = payload.start_date.isoformat()
        if payload.end_date is not None:
            s["end_date"] = payload.end_date.isoformat()
        if payload.instructions is not None:
            s["instructions"] = payload.instructions
        if payload.is_active is not None:
            s["is_active"] = payload.is_active
        if payload.user_confirmed is not None:
            s["user_confirmed"] = payload.user_confirmed
        s["updated_at"] = now.isoformat()

        with cls._lock:
            data["schedules"][schedule_id] = s
            cls._save_data(data)

        if s.get("is_active") and s.get("user_confirmed"):
            cls._generate_reminders_for_schedule(s)

        return cls.get_schedule(schedule_id, user_id)

    @classmethod
    def delete_schedule(cls, schedule_id: str, user_id: str) -> None:
        """Deletes schedule and associated reminders."""
        data = cls._load_data()
        s = data["schedules"].get(schedule_id)
        if not s:
            raise EntityNotFoundException("Medication schedule", schedule_id)
        if s.get("user_id") != user_id:
            raise ForbiddenException("Access to medication schedule denied.")

        with cls._lock:
            del data["schedules"][schedule_id]
            # Remove linked reminders
            reminders_to_keep = {
                rid: r for rid, r in data["reminders"].items() if r.get("schedule_id") != schedule_id
            }
            data["reminders"] = reminders_to_keep
            cls._save_data(data)

    @classmethod
    def _generate_reminders_for_schedule(
        cls, schedule_data: Dict[str, Any], target_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Generates scheduled dose instances for a specific target date (defaults to today).
        Prevents duplicates by checking existing (schedule_id, scheduled_for) pairs.
        """
        schedule_id = schedule_data["id"]
        user_id = schedule_data["user_id"]
        tz_str = schedule_data.get("timezone", "UTC")
        tz = cls._parse_timezone(tz_str)

        start_d = date.fromisoformat(str(schedule_data["start_date"]))
        end_d = date.fromisoformat(str(schedule_data["end_date"])) if schedule_data.get("end_date") else None

        now_local = datetime.now(tz)
        curr_date = target_date or start_d
        if not target_date and now_local.date() >= start_d:
            curr_date = now_local.date()

        if curr_date < start_d:
            return []
        if end_d and curr_date > end_d:
            return []

        created_reminders = []
        data = cls._load_data()

        for time_str in schedule_data.get("reminder_times", ["09:00"]):
            try:
                h, m = map(int, time_str.split(":"))
                dose_time = datetime(curr_date.year, curr_date.month, curr_date.day, h, m, tzinfo=tz)
                dose_utc = dose_time.astimezone(timezone.utc)
                dose_utc_iso = dose_utc.isoformat()

                # Duplicate check: does a reminder for this schedule at this exact time already exist?
                duplicate = False
                for r in data["reminders"].values():
                    if r.get("schedule_id") == schedule_id:
                        try:
                            existing_time = datetime.fromisoformat(str(r.get("scheduled_for", "")).replace("Z", "+00:00"))
                            if existing_time == dose_utc:
                                duplicate = True
                                break
                        except Exception:
                            if r.get("scheduled_for") == dose_utc_iso:
                                duplicate = True
                                break

                if not duplicate:
                    rem_id = str(uuid.uuid4())
                    now = datetime.now(timezone.utc)
                    rem_data = {
                        "id": rem_id,
                        "schedule_id": schedule_id,
                        "user_id": user_id,
                        "medication_name": schedule_data["medication_name"],
                        "dosage": schedule_data.get("dosage"),
                        "instructions": schedule_data.get("instructions"),
                        "scheduled_for": dose_utc_iso,
                        "status": ReminderStatus.PENDING.value,
                        "notification_sent_at": None,
                        "created_at": now.isoformat(),
                    }
                    data["reminders"][rem_id] = rem_data
                    created_reminders.append(rem_data)
            except Exception as e:
                logger.warning("Error generating dose for %s at %s: %s", schedule_id, time_str, str(e))

        if created_reminders:
            with cls._lock:
                cls._save_data(data)

        return created_reminders

    @classmethod
    def get_today_reminders(cls, user_id: str) -> List[MedicationReminderResponse]:
        """
        Returns all scheduled reminders for today, generating them if not already present.
        """
        cls._ensure_demo_seeded(user_id)
        data = cls._load_data()
        schedules = [
            s for s in data["schedules"].values()
            if s.get("user_id") == user_id and s.get("is_active", True) and s.get("user_confirmed", True)
        ]

        # Generate doses for each active confirmed schedule if not demo user
        if not cls._is_demo_user(user_id):
            now_utc = datetime.now(timezone.utc)
            today_date = now_utc.date()
            for s in schedules:
                cls._generate_reminders_for_schedule(s, target_date=today_date)

        # Reload after generation
        data = cls._load_data()
        now_utc = datetime.now(timezone.utc)
        today_start = now_utc - timedelta(hours=12)
        today_end = now_utc + timedelta(hours=36)

        today_reminders = []
        for r in data["reminders"].values():
            if r.get("user_id") == user_id:
                try:
                    time_raw = str(r["scheduled_for"]).replace("Z", "+00:00")
                    sched_time = datetime.fromisoformat(time_raw)
                    if sched_time.tzinfo is None:
                        sched_time = sched_time.replace(tzinfo=timezone.utc)
                    if today_start <= sched_time < today_end:
                        today_reminders.append(
                            MedicationReminderResponse(
                                id=r["id"],
                                schedule_id=r["schedule_id"],
                                user_id=r["user_id"],
                                medication_name=r["medication_name"],
                                dosage=r.get("dosage"),
                                scheduled_for=r["scheduled_for"],
                                status=ReminderStatus(r.get("status", "PENDING")),
                                instructions=r.get("instructions"),
                                notification_sent_at=r.get("notification_sent_at"),
                                created_at=str(r["created_at"]),
                            )
                        )
                except Exception:
                    continue

        return sorted(today_reminders, key=lambda x: x.scheduled_for)

    @classmethod
    def log_action(
        cls, reminder_id: str, user_id: str, action: MedicationActionType, notes: Optional[str] = None
    ) -> MedicationReminderResponse:
        """
        Logs dose action (TAKEN, SKIPPED, MISSED) and updates status.
        Never advises users to double doses.
        """
        data = cls._load_data()
        r = data["reminders"].get(reminder_id)
        if not r:
            raise EntityNotFoundException("Medication reminder", reminder_id)
        if r.get("user_id") != user_id:
            raise ForbiddenException("Access to reminder dose denied.")

        now = datetime.now(timezone.utc)
        r["status"] = action.value
        r["updated_at"] = now.isoformat()

        # Log entry
        log_id = str(uuid.uuid4())
        log_entry = {
            "id": log_id,
            "schedule_id": r["schedule_id"],
            "reminder_id": reminder_id,
            "user_id": user_id,
            "action": action.value,
            "logged_at": now.isoformat(),
            "notes": notes,
        }

        with cls._lock:
            data["reminders"][reminder_id] = r
            data["logs"][log_id] = log_entry
            cls._save_data(data)

        AuditService.log_event(
            action=AuditAction.REMINDER_LOG,
            resource_type="medication_reminder",
            resource_id=reminder_id,
            user_id=user_id,
            metadata={"action": action.value, "medication": r["medication_name"]},
        )

        return MedicationReminderResponse(
            id=r["id"],
            schedule_id=r["schedule_id"],
            user_id=r["user_id"],
            medication_name=r["medication_name"],
            dosage=r.get("dosage"),
            scheduled_for=r["scheduled_for"],
            status=ReminderStatus(r["status"]),
            instructions=r.get("instructions"),
            notification_sent_at=r.get("notification_sent_at"),
            created_at=str(r["created_at"]),
        )

    @classmethod
    def mark_notification_sent(cls, reminder_id: str, user_id: str) -> None:
        """Marks that notification was dispatched, preventing duplicate alerts."""
        data = cls._load_data()
        r = data["reminders"].get(reminder_id)
        if not r or r.get("user_id") != user_id:
            return

        now = datetime.now(timezone.utc)
        r["notification_sent_at"] = now.isoformat()
        if r.get("status") == ReminderStatus.PENDING.value:
            r["status"] = ReminderStatus.NOTIFIED.value

        with cls._lock:
            data["reminders"][reminder_id] = r
            cls._save_data(data)

    @classmethod
    def get_adherence_stats(cls, user_id: str, days: int = 7) -> AdherenceStatsResponse:
        """Calculates adherence statistics over the specified window (default 7 days)."""
        cls._ensure_demo_seeded(user_id)
        data = cls._load_data()
        now_utc = datetime.now(timezone.utc)
        start_period = now_utc - timedelta(days=days)

        user_reminders = []
        for r in data["reminders"].values():
            if r.get("user_id") == user_id:
                try:
                    st = datetime.fromisoformat(r["scheduled_for"])
                    if st >= start_period:
                        user_reminders.append(r)
                except Exception:
                    continue

        total_scheduled = len(user_reminders)
        taken_count = sum(1 for r in user_reminders if r.get("status") == ReminderStatus.TAKEN.value)
        skipped_count = sum(1 for r in user_reminders if r.get("status") == ReminderStatus.SKIPPED.value)
        missed_count = sum(1 for r in user_reminders if r.get("status") == ReminderStatus.MISSED.value)

        adherence_pct = (taken_count / total_scheduled * 100.0) if total_scheduled > 0 else None

        # Build daily breakdown for the last `days`
        breakdown: List[DailyAdherenceItem] = []
        for i in range(days - 1, -1, -1):
            d = (now_utc - timedelta(days=i)).date()
            d_str = d.isoformat()
            d_rems = [
                r for r in user_reminders
                if datetime.fromisoformat(r["scheduled_for"]).date() == d
            ]
            breakdown.append(
                DailyAdherenceItem(
                    date=d_str,
                    scheduled=len(d_rems),
                    taken=sum(1 for r in d_rems if r.get("status") == ReminderStatus.TAKEN.value),
                    skipped=sum(1 for r in d_rems if r.get("status") == ReminderStatus.SKIPPED.value),
                    missed=sum(1 for r in d_rems if r.get("status") == ReminderStatus.MISSED.value),
                )
            )

        return AdherenceStatsResponse(
            total_scheduled=total_scheduled,
            total_taken=taken_count,
            total_skipped=skipped_count,
            total_missed=missed_count,
            adherence_percentage=round(adherence_pct, 1) if adherence_pct is not None else None,
            streak_days=min(taken_count, days) if total_scheduled > 0 else 0,
            daily_breakdown=breakdown,
            medical_safety_disclaimer=cls.SAFETY_DISCLAIMER,
        )
