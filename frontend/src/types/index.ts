export type DocumentCategory =
  | 'prescription'
  | 'blood_test'
  | 'lab_report'
  | 'laboratory_report'
  | 'imaging_report'
  | 'discharge_summary'
  | 'consultation_record'
  | 'non_medical'
  | 'other'
  | string;

export type ProcessingStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'EXTRACTED'
  | 'NEEDS_REVIEW'
  | 'UNSUPPORTED'
  | 'FAILED'
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'extracted'
  | 'needs_review'
  | 'unsupported'
  | 'failed'
  | string;

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  role?: 'patient' | 'clinician' | 'admin' | string;
  clinician_approval_status?: 'none' | 'pending' | 'approved' | 'rejected' | string;
  license_number?: string | null;
  license_jurisdiction?: string | null;
  created_at?: string;
  confirmation_required?: boolean;
  session?: AuthTokenResponse | null;
}

export interface RegisterResult {
  confirmationRequired: boolean;
  user?: UserProfile;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string | null;
  user_id: string;
  email: string;
}

export interface MedicationItem {
  id?: string;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
  confidence?: number | null;
}

export interface PrescriptionData {
  patient_name?: string | null;
  doctor_name?: string | null;
  clinic_name?: string | null;
  prescription_date?: string | null;
  medications: MedicationItem[];
}

export interface LabResultItem {
  id?: string;
  test_name: string;
  value: string;
  unit?: string | null;
  reference_range?: string | null;
  flag?: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL' | null;
  confidence?: number | null;
}

export interface LabReportData {
  patient_name?: string | null;
  lab_name?: string | null;
  test_date?: string | null;
  referring_doctor?: string | null;
  results: LabResultItem[];
}

export interface ImagingReportData {
  patient_name?: string | null;
  radiologist_name?: string | null;
  imaging_center_or_hospital?: string | null;
  report_date?: string | null;
  modality?: string | null;
  body_part_or_region?: string | null;
  clinical_indication?: string | null;
  findings?: string | null;
  impression?: string | null;
}

export interface ConfidenceInfo {
  ocr_confidence?: number | null;
  llm_confidence?: number | null;
  overall_confidence?: number | null;
  confidence_method?: string | null;
  is_calibrated?: boolean;
}

export interface MedicalDocument {
  id: string;
  document_id?: string;
  user_id?: string;
  filename: string;
  original_filename?: string;
  storage_path?: string;
  mime_type: string;
  file_size_bytes: number;
  document_type: DocumentCategory;
  processing_status: ProcessingStatus;
  status?: ProcessingStatus;
  ocr_confidence?: number | null;
  needs_human_review: boolean;
  raw_extracted_text?: string | null;
  created_at: string;
  updated_at?: string;
  extracted_data?: PrescriptionData | LabReportData | ImagingReportData | Record<string, any> | null;
  confidence_score?: number | null;
  confidence_source?: string | null;
  verification_reasons?: string[];
  disclaimer?: string;
}

export interface DocumentReviewResponse {
  document_id: string;
  document_category: DocumentCategory;
  processing_status: string;
  extracted_information: PrescriptionData | LabReportData | ImagingReportData | Record<string, any>;
  extraction_engine_used: string;
  ocr_text: string;
  confidence_information: ConfidenceInfo;
  fields_requiring_verification: string[];
  requires_verification: boolean;
  review_notes?: string | null;
  medical_disclaimer: string;
}

export interface DocumentShare {
  id: string;
  document_id: string;
  shared_by_user_id: string;
  shared_with_email: string;
  permission_level: 'VIEW' | 'EDIT';
  expires_at?: string | null;
  created_at: string;
}

// --- Phase 5 Types: Medication Reminders & Adherence ---

export type FrequencyType = 'ONCE_DAILY' | 'TWICE_DAILY' | 'THREE_TIMES_DAILY' | 'CUSTOM';
export type ReminderStatus = 'PENDING' | 'NOTIFIED' | 'TAKEN' | 'SKIPPED' | 'MISSED';
export type MedicationActionType = 'TAKEN' | 'SKIPPED' | 'MISSED';

export interface MedicationSchedule {
  id: string;
  user_id: string;
  medication_name: string;
  dosage?: string | null;
  frequency: FrequencyType;
  reminder_times: string[];
  timezone: string;
  start_date: string;
  end_date?: string | null;
  instructions?: string | null;
  is_active: boolean;
  user_confirmed: boolean;
  document_id?: string | null;
  prescription_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationReminder {
  id: string;
  schedule_id: string;
  user_id: string;
  medication_name: string;
  dosage?: string | null;
  scheduled_for: string;
  status: ReminderStatus;
  instructions?: string | null;
  notification_sent_at?: string | null;
  created_at: string;
}

export interface DailyAdherenceItem {
  date: string;
  scheduled: number;
  taken: number;
  skipped: number;
  missed: number;
}

export interface AdherenceStats {
  total_scheduled: number;
  total_taken: number;
  total_skipped: number;
  total_missed: number;
  adherence_percentage: number | null;
  streak_days: number;
  daily_breakdown: DailyAdherenceItem[];
  medical_safety_disclaimer: string;
}

// --- Phase 5 Types: AI Assistant & Citations ---

export interface CitationItem {
  document_id: string;
  document_filename: string;
  document_date?: string | null;
  document_type?: string | null;
  snippet: string;
  relevance_score?: number | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: CitationItem[];
  created_at: string;
  disclaimer: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}
