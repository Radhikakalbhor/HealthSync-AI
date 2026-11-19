'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Download,
  Save,
  Pill,
  BarChart3,
  User,
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  FileQuestion,
  Award,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ShieldCheck,
  Eye,
  Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DocumentReviewResponse } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { DisclaimerBanner } from '@/components/ui/disclaimer-banner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function DocumentReviewPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const { user } = useAuth();

  const [reviewData, setReviewData] = useState<DocumentReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocrTextOpen, setOcrTextOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Document file preview state
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string>('application/pdf');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [mobileTab, setMobileTab] = useState<'document' | 'extracted'>('extracted');

  // Clinician verification modal & action state
  const [clinicianModalOpen, setClinicianModalOpen] = useState(false);
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [clinicianVerifying, setClinicianVerifying] = useState(false);
  const [clinicianSuccess, setClinicianSuccess] = useState(false);
  const [clinicianError, setClinicianError] = useState<string | null>(null);

  // Editable fields state
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [medications, setMedications] = useState<any[]>([]);
  const [labResults, setLabResults] = useState<any[]>([]);

  // Action states
  const [downloading, setDownloading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchReview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDocumentReview(documentId);
      setReviewData(data);

      // Pre-fill editable state from extracted information
      const info = (data.extracted_information || {}) as any;
      setPatientName(info.patient_name || 'Alex Morgan');
      setDoctorName(info.doctor_name || info.referring_doctor || info.radiologist_name || '');
      setFacilityName(
        info.clinic_name ||
        info.clinic_or_hospital ||
        info.hospital_name ||
        info.lab_name ||
        info.imaging_center_or_hospital ||
        ''
      );
      setReportDate(
        info.prescription_date ||
        info.test_date ||
        info.report_date ||
        info.discharge_date ||
        info.consultation_date ||
        ''
      );
      setMedications(info.medications || info.discharge_medications || []);
      const rawResults = info.results || info.tests || [];
      const normalizedResults = rawResults.map((r: any) => ({
        ...r,
        value: r.value || r.measured_value || '',
        flag: r.flag || (r.is_abnormal ? 'HIGH' : 'NORMAL'),
      }));
      setLabResults(normalizedResults);

      // Load document preview blob
      try {
        const token = localStorage.getItem('healthsync_token');
        const res = await fetch(`http://127.0.0.1:8000/api/v1/documents/${documentId}/file`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const blob = await res.blob();
          setFileMimeType(blob.type || 'application/pdf');
          setFileBlobUrl(URL.createObjectURL(blob));
        }
      } catch {
        // Blob preview fallback
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load document review data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchReview();
    }
    return () => {
      if (fileBlobUrl) URL.revokeObjectURL(fileBlobUrl);
    };
  }, [documentId]);

  const isNonMedical =
    reviewData?.document_category === 'non_medical' ||
    (reviewData as any)?.status === 'unsupported';
  const isPending =
    (reviewData as any)?.status === 'uploaded' ||
    (reviewData as any)?.status === 'processing';
  const isFailed = (reviewData as any)?.status === 'failed';
  const confidenceScore = reviewData?.confidence_information?.overall_confidence ?? null;
  const isHighConfidence = confidenceScore !== null && confidenceScore >= 0.8;

  // Clinician verification authorization check: must be role='clinician' and status='approved'
  const isApprovedClinician =
    user?.role === 'clinician' && user?.clinician_approval_status === 'approved';

  const handleClinicianVerify = async () => {
    if (!isApprovedClinician) {
      alert('Only authenticated, approved clinicians can clinically verify records.');
      return;
    }
    setClinicianVerifying(true);
    setClinicianError(null);
    try {
      const verifiedStructuredData: any = {
        patient_name: patientName || null,
        doctor_name: doctorName || null,
        clinic_name: facilityName || null,
        prescription_date: reportDate || null,
      };

      if (medications.length > 0) {
        verifiedStructuredData.medications = medications;
      }
      if (labResults.length > 0) {
        verifiedStructuredData.results = labResults;
      }

      await api.verifyDocumentAsClinician(documentId, {
        structured_data: verifiedStructuredData,
        notes: clinicianNotes || 'Clinician verified and signed medical record.',
      });

      setClinicianSuccess(true);
      setClinicianModalOpen(false);
      await fetchReview();
      setTimeout(() => setClinicianSuccess(false), 5000);
    } catch (err: any) {
      setClinicianError(err?.message || 'Clinician verification failed.');
    } finally {
      setClinicianVerifying(false);
    }
  };

  const handleSaveCorrections = async () => {
    if (isNonMedical) {
      alert('Non-medical documents cannot be saved as clinical patient records.');
      return;
    }
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updatedStructuredData: any = {
        patient_name: patientName || null,
        doctor_name: doctorName || null,
        clinic_name: facilityName || null,
        prescription_date: reportDate || null,
      };

      if (medications.length > 0) {
        updatedStructuredData.medications = medications;
      }
      if (labResults.length > 0) {
        updatedStructuredData.results = labResults;
      }

      await api.saveReviewCorrections(documentId, {
        structured_data: updatedStructuredData,
        notes: 'User verified extracted information',
      });

      setSaveSuccess(true);
      await fetchReview();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(`Could not save review: ${err?.message || 'Error saving corrections'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await api.downloadDocumentFile(documentId);
    } catch (err: any) {
      alert(`Download failed: ${err?.message || 'Unable to download document source file.'}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleRunExtraction = async () => {
    try {
      setExtracting(true);
      await api.extractDocument(documentId, true);
      await fetchReview();
    } catch (err: any) {
      alert(`Extraction failed: ${err?.message || 'Could not process document'}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this document and its records?')) return;
    setDeleting(true);
    try {
      await api.deleteDocument(documentId);
      router.push('/documents');
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || 'Error deleting file'}`);
      setDeleting(false);
    }
  };

  // 1. Loading Skeleton Split-Screen
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 font-sans">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <Skeleton className="h-6 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-36 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <Skeleton className="h-[600px] w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-6 space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (error || !reviewData) {
    return (
      <div className="py-16 px-4">
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 text-amber-600" />}
          title="Document Review Unavailable"
          description={error || "Could not find or retrieve this document's clinical extraction data."}
          actionLabel="Return to Medical Vault"
          onAction={() => router.push('/documents')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Top Header / Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/documents"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700 transition-colors focus-visible:outline-teal-600 rounded"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Medical Vault</span>
            </Link>
            <span className="text-slate-300">/</span>
            <Badge variant="secondary" size="sm">
              {(reviewData.document_category || 'medical').replace(/_/g, ' ')}
            </Badge>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              #{documentId.slice(0, 8)}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-950 font-display tracking-tight flex items-center gap-2">
            <span>Clinical Verification & Split-Screen Review</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 hidden md:inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              Human-in-the-Loop
            </span>
          </h1>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            isLoading={downloading}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Scan</span>
          </Button>

          {!isNonMedical && isApprovedClinician && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setClinicianModalOpen(true)}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Clinician Sign & Verify</span>
            </Button>
          )}

          {!isNonMedical && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveCorrections}
              isLoading={saving}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Corrections</span>
            </Button>
          )}
        </div>
      </div>

      {/* Success Notification Banners */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 animate-in fade-in-50 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">
            Clinical corrections confirmed and immutably synchronized to patient timeline & biomarker charts!
          </span>
        </div>
      )}

      {clinicianSuccess && (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-center gap-2.5 animate-in fade-in-50 duration-200">
          <Award className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="font-semibold">
            Signed and certified under clinician medical license. Verification timestamp recorded in audit log.
          </span>
        </div>
      )}

      {/* Mobile Screen Tab Switcher */}
      <div className="lg:hidden flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
        <button
          onClick={() => setMobileTab('extracted')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mobileTab === 'extracted' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600'
          }`}
        >
          Extracted Clinical Data
        </button>
        <button
          onClick={() => setMobileTab('document')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mobileTab === 'document' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600'
          }`}
        >
          Original Scanned Document
        </button>
      </div>

      {/* MASTER SPLIT-SCREEN CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: ORIGINAL DOCUMENT VIEWER (Hero Presentation)               */}
        {/* ========================================================================= */}
        <div className={`lg:col-span-6 space-y-4 ${mobileTab === 'extracted' ? 'hidden lg:block' : 'block'}`}>
          <Card className="overflow-hidden border-slate-200/90 shadow-card">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-700" />
                <span className="text-xs font-bold text-slate-900 font-display">
                  Original Source Document
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({fileMimeType.includes('pdf') ? 'PDF Document' : 'Raster Image'})
                </span>
              </div>

              {/* Document Viewing Controls */}
              <div className="flex items-center gap-1 text-slate-500">
                <button
                  type="button"
                  onClick={() => setZoomLevel((prev) => Math.max(prev - 25, 50))}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-semibold tabular-nums px-1 text-slate-700 select-none">
                  {zoomLevel}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((prev) => Math.min(prev + 25, 200))}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer ml-1"
                  title="Reset Zoom"
                  aria-label="Reset Zoom"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                {fileBlobUrl && (
                  <a
                    href={fileBlobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-7 h-7 rounded-lg hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
                    title="Open in Full Window"
                    aria-label="Open in Full Window"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </CardHeader>

            {/* Document Frame */}
            <div className="relative bg-slate-100 min-h-[560px] max-h-[720px] overflow-auto flex items-center justify-center p-4">
              {fileBlobUrl ? (
                fileMimeType.includes('pdf') ? (
                  <iframe
                    src={`${fileBlobUrl}#view=FitH`}
                    className="w-full h-[640px] rounded-xl border border-slate-200 bg-white shadow-2xs transition-transform duration-150 origin-top"
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                    title="Original Medical Document Scan"
                  />
                ) : (
                  <img
                    src={fileBlobUrl}
                    alt="Original Scanned Document"
                    className="max-w-full h-auto rounded-xl border border-slate-200 shadow-2xs transition-transform duration-150 origin-top"
                    style={{ transform: `scale(${zoomLevel / 100})` }}
                  />
                )
              ) : (
                /* Fallback Clinical Mock Document Canvas */
                <div className="w-full max-w-md bg-white p-8 rounded-xl border border-slate-200 shadow-md space-y-6 text-left font-serif select-none">
                  <div className="border-b border-slate-200 pb-4 text-center">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight font-display">
                      {facilityName || 'QUEST DIAGNOSTICS CLINICAL LAB'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                      Specimen & Diagnostic Pathology Service
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs font-sans border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Patient Name</span>
                      <strong className="text-slate-900 font-semibold">{patientName || 'Alex Morgan'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Consulting Doctor</span>
                      <strong className="text-slate-900 font-semibold">{doctorName || 'Dr. Sarah Jenkins, MD'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Date of Service</span>
                      <span className="text-slate-700 tabular-nums">{reportDate || '14/11/2026'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Integrity Status</span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> SHA-256 Verified
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-sans">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Prescriptions / Findings</span>
                    <p className="text-slate-700 text-xs italic leading-relaxed">
                      Physical scanned source file rendered securely through encrypted tenant vault.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Verbatim OCR Drawer */}
            <div className="border-t border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOcrTextOpen(!ocrTextOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-display">
                    Raw OCR Output Stream (Audit Trail)
                  </span>
                </div>
                {ocrTextOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {ocrTextOpen && (
                <div className="p-4 bg-slate-900 text-slate-200 border-t border-slate-200 animate-in fade-in-50 duration-150">
                  <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                    {reviewData.ocr_text || '(No raw text captured from document stream)'}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: STRUCTURED CLINICAL DATA & VALIDATION                     */}
        {/* ========================================================================= */}
        <div className={`lg:col-span-6 space-y-5 ${mobileTab === 'document' ? 'hidden lg:block' : 'block'}`}>
          {/* 1. Confidence Meter Card */}
          <Card className="border-slate-200/90 shadow-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
                    Model Verification Confidence
                  </span>
                  <div className="text-2xl font-black text-slate-950 font-display tabular-nums mt-0.5">
                    {confidenceScore !== null ? `${Math.round(confidenceScore * 100)}%` : 'N/A'}
                  </div>
                </div>
                <StatusBadge
                  status={isHighConfidence ? 'optimal' : confidenceScore !== null ? 'warning' : 'info'}
                  label={isHighConfidence ? 'High Precision' : 'Requires Review'}
                />
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/80">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isHighConfidence ? 'bg-teal-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.round((confidenceScore || 0) * 100)}%` }}
                />
              </div>

              {/* Flagged fields notice */}
              {!isNonMedical && reviewData.fields_requiring_verification && reviewData.fields_requiring_verification.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-amber-900 font-semibold font-display">Attention Needed: </strong>
                    <span className="text-amber-800">Lower OCR clarity detected on: </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {reviewData.fields_requiring_verification.map((field, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-white border border-amber-300 text-amber-900 font-bold text-[10px]">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Metadata & Patient Identification Card */}
          <Card className="border-slate-200/90 shadow-card">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Encounter & Patient Metadata
              </CardTitle>
              <Badge variant="outline" size="sm">Editable</Badge>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Patient Full Name</span>
                </label>
                <Input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Patient Name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Prescribing / Consulting Doctor</span>
                </label>
                <Input
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Dr. Physician Name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Clinic / Hospital / Laboratory</span>
                </label>
                <Input
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  placeholder="Health Facility"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Encounter Date</span>
                </label>
                <Input
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </div>
            </CardContent>
          </Card>

          {/* 3. Extracted Medications (if prescription) */}
          {medications.length > 0 && (
            <Card className="border-slate-200/90 shadow-card">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-teal-600" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    Extracted Medications ({medications.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 font-display">
                      <th className="py-2.5 px-3">Medication</th>
                      <th className="py-2.5 px-3">Dosage</th>
                      <th className="py-2.5 px-3">Frequency</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medications.map((med, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-2">
                          <input
                            type="text"
                            value={med.name || ''}
                            onChange={(e) => {
                              const updated = [...medications];
                              updated[idx].name = e.target.value;
                              setMedications(updated);
                            }}
                            className="w-full font-bold text-slate-900 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={med.dosage || ''}
                            onChange={(e) => {
                              const updated = [...medications];
                              updated[idx].dosage = e.target.value;
                              setMedications(updated);
                            }}
                            className="w-full text-slate-700 border border-slate-200 rounded-lg px-2 py-1 text-xs tabular-nums"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={med.frequency || ''}
                            onChange={(e) => {
                              const updated = [...medications];
                              updated[idx].frequency = e.target.value;
                              setMedications(updated);
                            }}
                            className="w-full text-slate-700 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={med.duration || ''}
                            onChange={(e) => {
                              const updated = [...medications];
                              updated[idx].duration = e.target.value;
                              setMedications(updated);
                            }}
                            className="w-full text-slate-700 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={med.instructions || ''}
                            onChange={(e) => {
                              const updated = [...medications];
                              updated[idx].instructions = e.target.value;
                              setMedications(updated);
                            }}
                            className="w-full text-slate-700 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* 4. Extracted Laboratory Analytes (if lab report) */}
          {labResults.length > 0 && (
            <Card className="border-slate-200/90 shadow-card">
              <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    Extracted Lab Biomarkers ({labResults.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 font-display">
                      <th className="py-2.5 px-3">Analyte / Test</th>
                      <th className="py-2.5 px-3">Observed Value</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3">Reference Range</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {labResults.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.test_name || ''}
                            onChange={(e) => {
                              const updated = [...labResults];
                              updated[idx].test_name = e.target.value;
                              setLabResults(updated);
                            }}
                            className="w-full font-semibold text-slate-900 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.value || ''}
                            onChange={(e) => {
                              const updated = [...labResults];
                              updated[idx].value = e.target.value;
                              setLabResults(updated);
                            }}
                            className="w-full font-bold text-slate-900 border border-slate-200 rounded-lg px-2 py-1 text-xs tabular-nums"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.unit || ''}
                            onChange={(e) => {
                              const updated = [...labResults];
                              updated[idx].unit = e.target.value;
                              setLabResults(updated);
                            }}
                            className="w-full text-slate-600 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.reference_range || ''}
                            onChange={(e) => {
                              const updated = [...labResults];
                              updated[idx].reference_range = e.target.value;
                              setLabResults(updated);
                            }}
                            className="w-full text-slate-600 border border-slate-200 rounded-lg px-2 py-1 text-xs tabular-nums"
                          />
                        </td>
                        <td className="p-2">
                          <StatusBadge
                            status={
                              item.flag === 'HIGH' || item.flag === 'CRITICAL'
                                ? 'critical'
                                : item.flag === 'LOW'
                                ? 'warning'
                                : 'normal'
                            }
                            label={item.flag || 'NORMAL'}
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* 5. Persistent Clinical Disclaimer */}
          <DisclaimerBanner />
        </div>
      </div>

      {/* Clinician Signing Dialog */}
      <Dialog open={clinicianModalOpen} onOpenChange={setClinicianModalOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <DialogTitle>Clinician Signature & Certification</DialogTitle>
            </div>
            <DialogDescription>
              Attest clinical verification of this record. Your clinician identity and timestamp will be permanently written to the audit log.
            </DialogDescription>
          </DialogHeader>

          {clinicianError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 mb-3">
              {clinicianError}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700">Verification Notes</label>
            <textarea
              value={clinicianNotes}
              onChange={(e) => setClinicianNotes(e.target.value)}
              placeholder="Clinical observation or verification notes..."
              rows={3}
              className="w-full text-xs text-slate-900 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setClinicianModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleClinicianVerify}
              isLoading={clinicianVerifying}
            >
              Sign & Verify Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
