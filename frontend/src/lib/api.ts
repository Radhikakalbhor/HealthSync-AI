import {
  AuthTokenResponse,
  UserProfile,
  MedicalDocument,
  DocumentReviewResponse,
  DocumentCategory,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function normalizeDocument(raw: any): MedicalDocument {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      document_id: '',
      user_id: '',
      filename: 'Unknown document',
      original_filename: 'Unknown document',
      storage_path: '',
      file_size_bytes: 0,
      mime_type: 'application/octet-stream',
      document_type: 'other',
      processing_status: 'failed',
      status: 'failed',
      needs_human_review: false,
      ocr_confidence: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as MedicalDocument;
  }

  const id = raw.id || raw.document_id || '';
  const filename = raw.filename || raw.original_filename || 'Untitled document';
  const original_filename = raw.original_filename || raw.filename || filename;
  const status = (raw.status || raw.processing_status || 'uploaded').toLowerCase();
  const processing_status = (raw.processing_status || raw.status || status).toLowerCase();
  const document_type = (raw.document_type || 'other').toLowerCase();

  return {
    ...raw,
    id,
    document_id: id,
    filename,
    original_filename,
    status,
    processing_status,
    document_type,
    file_size_bytes: typeof raw.file_size_bytes === 'number' ? raw.file_size_bytes : (raw.file_size || 0),
    mime_type: raw.mime_type || 'application/octet-stream',
    ocr_confidence: raw.ocr_confidence ?? raw.confidence_score ?? null,
    needs_human_review: raw.needs_human_review ?? (status === 'needs_review'),
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
    extracted_data: raw.extracted_data || raw.extraction_result?.structured_data || null,
  } as MedicalDocument;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('healthsync_token');
  }

  public setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('healthsync_token', token);
    }
  }

  public clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('healthsync_token');
      localStorage.removeItem('healthsync_user');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData?.detail) {
          errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {
        // Fallback to default message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // --- Auth Endpoints ---

  async register(email: string, password: string, fullName?: string): Promise<UserProfile> {
    return this.request<UserProfile>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
  }

  async login(email: string, password: string): Promise<AuthTokenResponse> {
    const data = await this.request<AuthTokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    } finally {
      this.clearToken();
    }
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/v1/auth/me');
  }

  // --- Document Endpoints ---

  async uploadDocument(
    file: File,
    documentTypeHint?: string,
    enableLlm: boolean = true
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (documentTypeHint) {
      formData.append('document_type_hint', documentTypeHint);
    }
    formData.append('enable_llm_extraction', String(enableLlm));

    return this.request('/api/v1/documents/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async listDocuments(limit: number = 50, offset: number = 0): Promise<{ total: number; documents: MedicalDocument[] }> {
    const res = await this.request<any>(`/api/v1/documents?limit=${limit}&offset=${offset}`);
    let rawDocs: any[] = [];
    let total = 0;
    if (Array.isArray(res)) {
      rawDocs = res;
      total = res.length;
    } else if (res && typeof res === 'object') {
      rawDocs = Array.isArray(res.documents) ? res.documents : [];
      total = typeof res.total === 'number' ? res.total : rawDocs.length;
    }
    const documents = rawDocs.map(normalizeDocument);
    return { total, documents };
  }

  async getDocument(documentId: string): Promise<MedicalDocument> {
    const raw = await this.request<any>(`/api/v1/documents/${documentId}`);
    return normalizeDocument(raw);
  }

  async extractDocument(documentId: string, forceLlm: boolean = false): Promise<any> {
    return this.request(`/api/v1/documents/${documentId}/extract?force_llm=${forceLlm}`, {
      method: 'POST',
    });
  }

  async downloadDocumentFile(documentId: string, fallbackFilename?: string): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/documents/${documentId}/file`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Failed to download file (HTTP ${response.status})`;
      if (response.status === 401) {
        errorMessage = 'Your session has expired or is unauthorized. Please log in again.';
      } else if (response.status === 403) {
        errorMessage = 'You do not have permission to download this document.';
      } else if (response.status === 404) {
        errorMessage = 'The requested file could not be found on the server.';
      } else {
        try {
          const errData = await response.json();
          if (errData?.detail) errorMessage = errData.detail;
        } catch {
          // ignore
        }
      }
      throw new Error(errorMessage);
    }

    // Try to parse filename from Content-Disposition header
    let filename = fallbackFilename || `document_${documentId}`;
    const disposition = response.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '').trim();
      }
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }

  async deleteDocument(documentId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/v1/documents/${documentId}`, {
      method: 'DELETE',
    });
  }

  async reclassifyDocuments(dryRun: boolean = true): Promise<{
    user_id: string;
    dry_run: boolean;
    scanned_documents_count: number;
    reclassified_count: number;
    reclassified_documents: Array<{
      document_id: string;
      filename: string;
      previous_type: string;
      previous_status: string;
      new_type: string;
      new_status: string;
      reason: string;
    }>;
  }> {
    return this.request(`/api/v1/documents/reclassify?dry_run=${dryRun}`, {
      method: 'POST',
    });
  }

  async getDownloadUrl(documentId: string): Promise<{ download_url: string; expires_in_seconds: number }> {
    return this.request<{ download_url: string; expires_in_seconds: number }>(
      `/api/v1/documents/${documentId}/download`
    );
  }

  async getDocumentReview(documentId: string): Promise<DocumentReviewResponse> {
    return this.request<DocumentReviewResponse>(`/api/v1/documents/${documentId}/review`);
  }

  async shareDocument(
    documentId: string,
    sharedWithEmail: string,
    permissionLevel: 'VIEW' | 'EDIT' = 'VIEW',
    expiresInDays: number = 7
  ): Promise<any> {
    return this.request(`/api/v1/documents/${documentId}/share`, {
      method: 'POST',
      body: JSON.stringify({
        shared_with_email: sharedWithEmail,
        permission_level: permissionLevel,
        expires_in_days: expiresInDays,
      }),
    });
  }

  async saveReviewCorrections(
    documentId: string,
    corrections: Record<string, any>
  ): Promise<any> {
    return this.request(`/api/v1/documents/${documentId}/review`, {
      method: 'PATCH',
      body: JSON.stringify(corrections),
    });
  }

  async verifyDocumentAsClinician(
    documentId: string,
    verificationPayload: Record<string, any>
  ): Promise<any> {
    return this.request(`/api/v1/documents/${documentId}/verify-clinician`, {
      method: 'POST',
      body: JSON.stringify(verificationPayload),
    });
  }

  // --- Phase 5: Medication Reminders Endpoints ---

  async createSchedule(payload: any): Promise<any> {
    return this.request('/api/v1/reminders/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listSchedules(activeOnly: boolean = false): Promise<any[]> {
    return this.request<any[]>(`/api/v1/reminders/schedules?active_only=${activeOnly}`);
  }

  async getSchedule(scheduleId: string): Promise<any> {
    return this.request(`/api/v1/reminders/schedules/${scheduleId}`);
  }

  async updateSchedule(scheduleId: string, payload: any): Promise<any> {
    return this.request(`/api/v1/reminders/schedules/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteSchedule(scheduleId: string): Promise<any> {
    return this.request(`/api/v1/reminders/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  }

  async getTodayReminders(): Promise<any[]> {
    return this.request<any[]>('/api/v1/reminders/today');
  }

  async logDoseAction(reminderId: string, action: 'TAKEN' | 'SKIPPED' | 'MISSED', notes?: string): Promise<any> {
    return this.request(`/api/v1/reminders/${reminderId}/log`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    });
  }

  async getAdherenceStats(days: number = 7): Promise<any> {
    return this.request(`/api/v1/reminders/adherence?days=${days}`);
  }

  // --- Phase 5: AI Medical Records Assistant Endpoints ---

  async createConversation(title?: string): Promise<any> {
    return this.request('/api/v1/assistant/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async listConversations(): Promise<any[]> {
    return this.request<any[]>('/api/v1/assistant/conversations');
  }

  async getConversation(conversationId: string): Promise<any> {
    return this.request(`/api/v1/assistant/conversations/${conversationId}`);
  }

  async deleteConversation(conversationId: string): Promise<any> {
    return this.request(`/api/v1/assistant/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async askAssistant(conversationId: string, content: string): Promise<any> {
    return this.request(`/api/v1/assistant/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // --- Phase 6: Advanced Health Intelligence Endpoints ---

  async getTimeline(
    category?: string,
    startDate?: string,
    endDate?: string,
    search?: string
  ): Promise<{ total: number; events: any[] }> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (search) params.append('search', search);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/v1/timeline${queryStr}`);
  }

  async getHealthTrends(testName?: string): Promise<{
    total_biomarkers: number;
    series: any[];
    date_range_start?: string;
    date_range_end?: string;
    disclaimer: string;
  }> {
    const query = testName ? `?test_name=${encodeURIComponent(testName)}` : '';
    return this.request(`/api/v1/analytics/trends${query}`);
  }

  async previewDoctorSummary(
    selectedDocumentIds?: string[],
    specialty?: string,
    notes?: string
  ): Promise<any> {
    return this.request('/api/v1/summary/preview', {
      method: 'POST',
      body: JSON.stringify({
        selected_document_ids: selectedDocumentIds,
        visit_specialty: specialty,
        notes,
      }),
    });
  }

  async downloadDoctorSummaryPdf(
    selectedDocumentIds?: string[],
    specialty?: string,
    notes?: string
  ): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/summary/generate-pdf`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        selected_document_ids: selectedDocumentIds,
        visit_specialty: specialty,
        notes,
      }),
    });

    if (!response.ok) {
      throw new Error(`PDF generation failed: ${response.statusText}`);
    }

    return response.blob();
  }

  async createShareToken(
    documentIds: string[],
    recipientLabel?: string,
    expiresInHours: number = 24
  ): Promise<any> {
    return this.request('/api/v1/shares', {
      method: 'POST',
      body: JSON.stringify({
        document_ids: documentIds,
        recipient_label: recipientLabel,
        expires_in_hours: expiresInHours,
      }),
    });
  }

  async listShares(): Promise<any[]> {
    return this.request<any[]>('/api/v1/shares');
  }

  async revokeShare(tokenOrId: string): Promise<any> {
    return this.request(`/api/v1/shares/${tokenOrId}`, {
      method: 'DELETE',
    });
  }

  async getPublicShare(token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/shares/public/${token}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || err?.error?.message || 'Shared link expired or invalid');
    }
    return response.json();
  }

  async getEmergencyCard(): Promise<any> {
    return this.request('/api/v1/emergency');
  }

  async updateEmergencyCard(payload: {
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
    blood_group?: string;
    allergies?: string[];
    confirmed_medications?: string[];
    critical_notes?: string;
    is_active?: boolean;
  }): Promise<any> {
    return this.request('/api/v1/emergency', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getPublicEmergencyCard(token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/v1/emergency/public/${token}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail || err?.error?.message || 'Emergency card unavailable');
    }
    return response.json();
  }

  async createFamilyProfile(payload: {
    full_name: string;
    relationship: string;
    date_of_birth?: string;
    gender?: string;
  }): Promise<any> {
    return this.request('/api/v1/family', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listFamilyProfiles(): Promise<any[]> {
    return this.request<any[]>('/api/v1/family');
  }

  async deleteFamilyProfile(profileId: string): Promise<any> {
    return this.request(`/api/v1/family/${profileId}`, {
      method: 'DELETE',
    });
  }

  async generateDoctorBriefing(
    specialty: string,
    primaryConcern: string,
    selectedDocumentIds?: string[]
  ): Promise<any> {
    return this.request('/api/v1/briefing/generate', {
      method: 'POST',
      body: JSON.stringify({
        doctor_specialty: specialty,
        primary_concern: primaryConcern,
        selected_document_ids: selectedDocumentIds,
      }),
    });
  }
}

export const api = new ApiClient();
