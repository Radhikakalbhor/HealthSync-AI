'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Download,
  Save,
  Pill,
  BarChart3,
  User,
  Calendar,
  Building2,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Trash2,
  FileQuestion,
  Award,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DocumentReviewResponse } from '@/types';

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
      setPatientName(info.patient_name || '');
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

  if (loading) {
    return (
      <div className="p-16 text-center">
        <div className="w-8 h-8 border-2 border-health-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-navy-800">Loading Clinical Review...</p>
        <p className="text-xs text-navy-400 mt-1">Calibrating confidence scores and OCR text</p>
      </div>
    );
  }

  if (error || !reviewData) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center bg-white rounded-2xl border border-slate-200">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="font-bold text-lg text-navy-900">Review Data Unavailable</h3>
        <p className="text-xs text-navy-600 mt-1">{error || 'Could not find document review payload.'}</p>
        <Link
          href="/documents"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-health-600 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Medical Records
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-xs font-semibold text-navy-600 hover:text-navy-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Documents
        </Link>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-navy-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading ? 'Downloading...' : 'Download Source'}
          </button>
          {!isNonMedical && (
            <button
              onClick={handleSaveCorrections}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-health-600 hover:bg-health-700 rounded-xl shadow-sm transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Confirm & Save Corrections'}
            </button>
          )}

          {/* Clinician Sign & Verify action - Gated strictly to approved clinicians */}
          {!isNonMedical && isApprovedClinician && (
            <button
              onClick={() => setClinicianModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
            >
              <Award className="w-3.5 h-3.5" />
              Clinician Sign & Verify
            </button>
          )}
        </div>
      </div>

      {clinicianSuccess && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-center gap-2.5 animate-in fade-in">
          <Award className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Document successfully signed and verified under clinical authority!</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-800 flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>Clinical review corrections successfully verified and saved to the patient record vault!</span>
        </div>
      )}

      {/* State Callout Banners */}
      {isNonMedical ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-300 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <FileQuestion className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800 uppercase tracking-wider mb-1">
                Non-Medical Document Detected
              </div>
              <h3 className="text-base font-bold text-navy-950">
                Non-Medical Document
              </h3>
              <p className="text-xs text-navy-600 mt-1 leading-relaxed">
                Non-medical document detected. This file does not appear to contain healthcare information, so medical extraction was not performed.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-navy-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download Uploaded File
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? 'Deleting...' : 'Delete File'}
            </button>
            <Link
              href="/documents"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-navy-600 hover:text-navy-900 ml-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Vault
            </Link>
          </div>
        </div>
      ) : isPending ? (
        <div className="p-6 rounded-2xl bg-blue-50 border border-blue-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-blue-950">Extraction Pending</h3>
              <p className="text-xs text-blue-800 mt-0.5">
                This document has been uploaded to encrypted storage and is awaiting OCR text analysis.
              </p>
            </div>
            <button
              onClick={handleRunExtraction}
              disabled={extracting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${extracting ? 'animate-spin' : ''}`} />
              {extracting ? 'Extracting...' : 'Run Extraction Now'}
            </button>
          </div>
        </div>
      ) : isFailed ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-rose-950">Processing Failed</h3>
              <p className="text-xs text-rose-800 mt-0.5">
                The extraction engine encountered an error or the file contained unreadable text.
              </p>
            </div>
            <button
              onClick={handleRunExtraction}
              disabled={extracting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${extracting ? 'animate-spin' : ''}`} />
              {extracting ? 'Retrying...' : 'Retry Extraction'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Review Header Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border ${
              isNonMedical
                ? 'bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-health-50 text-health-700 border border-health-200'
            }`}>
              {(reviewData.document_category || 'other').replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-navy-400">
              Engine: <strong className="text-navy-700">{reviewData.extraction_engine_used}</strong>
            </span>
          </div>

          <h2 className="text-xl font-extrabold text-navy-950 mt-2">
            Clinical Verification & Extraction Review
          </h2>
          <p className="text-xs text-navy-500 mt-0.5">
            Document ID: {documentId} • Human-In-The-Loop Validation
          </p>
        </div>

        {/* Confidence Meter */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 w-full md:w-64">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-navy-700">Confidence Score</span>
            <span className={`font-bold ${confidenceScore !== null ? (isHighConfidence ? 'text-teal-700' : 'text-amber-700') : 'text-slate-400'}`}>
              {confidenceScore !== null ? `${Math.round(confidenceScore * 100)}%` : 'N/A'}
            </span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                confidenceScore !== null ? (isHighConfidence ? 'bg-teal-500' : 'bg-amber-500') : 'bg-slate-300'
              }`}
              style={{ width: confidenceScore !== null ? `${Math.round(confidenceScore * 100)}%` : '0%' }}
            />
          </div>
          <p className="text-[10px] text-navy-400 mt-1">
            Method: {reviewData.confidence_information?.confidence_method || (confidenceScore !== null ? 'Calibrated OCR Word Match' : 'Uncalibrated / Pending')}
          </p>
        </div>
      </div>

      {/* Verification Flags Notice (if any) */}
      {!isNonMedical && reviewData.fields_requiring_verification && reviewData.fields_requiring_verification.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Attention: Fields Flagged For Verification
              </h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                The extraction engine detected ambiguities or lower OCR clarity on:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {reviewData.fields_requiring_verification.map((field, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white border border-amber-300 text-amber-900"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editable Clinical Data Form */}
      {!isNonMedical && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-6">
        <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center justify-between">
          <span>Metadata & Identification</span>
          <span className="text-[11px] font-normal text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            Editable Fields
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-navy-700 mb-1">
              Patient Name
            </label>
            <div className="relative rounded-xl shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Patient Name"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy-700 mb-1">
              Doctor / Physician Name
            </label>
            <div className="relative rounded-xl shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Prescribing / Consulting Doctor"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy-700 mb-1">
              Clinic / Hospital / Laboratory
            </label>
            <div className="relative rounded-xl shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="Health Facility Name"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy-700 mb-1">
              Record / Issue Date
            </label>
            <div className="relative rounded-xl shadow-xs">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-900"
              />
            </div>
          </div>
        </div>

        {/* Prescription Medications Section (if prescription) */}
        {medications.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-health-600" />
                Extracted Medications ({medications.length})
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-navy-500">
                    <th className="py-2.5 px-3">Medicine Name</th>
                    <th className="py-2.5 px-3">Dosage</th>
                    <th className="py-2.5 px-3">Frequency</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {medications.map((med, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={med.name || ''}
                          onChange={(e) => {
                            const updated = [...medications];
                            updated[idx].name = e.target.value;
                            setMedications(updated);
                          }}
                          className="w-full text-xs font-semibold text-navy-900 border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={med.dosage || ''}
                          onChange={(e) => {
                            const updated = [...medications];
                            updated[idx].dosage = e.target.value;
                            setMedications(updated);
                          }}
                          className="w-full text-xs text-navy-700 border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={med.frequency || ''}
                          onChange={(e) => {
                            const updated = [...medications];
                            updated[idx].frequency = e.target.value;
                            setMedications(updated);
                          }}
                          className="w-full text-xs text-navy-700 border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={med.duration || ''}
                          onChange={(e) => {
                            const updated = [...medications];
                            updated[idx].duration = e.target.value;
                            setMedications(updated);
                          }}
                          className="w-full text-xs text-navy-700 border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={med.instructions || ''}
                          onChange={(e) => {
                            const updated = [...medications];
                            updated[idx].instructions = e.target.value;
                            setMedications(updated);
                          }}
                          className="w-full text-xs text-navy-700 border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Laboratory Biomarkers Section (if lab report) */}
        {labResults.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              Extracted Lab Analytes ({labResults.length})
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-navy-500">
                    <th className="py-2.5 px-3">Analyte / Test</th>
                    <th className="py-2.5 px-3">Observed Value</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3">Reference Range</th>
                    <th className="py-2.5 px-3">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {labResults.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.test_name || ''}
                          onChange={(e) => {
                            const updated = [...labResults];
                            updated[idx].test_name = e.target.value;
                            setLabResults(updated);
                          }}
                          className="w-full text-xs font-semibold text-navy-900 border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.value || ''}
                          onChange={(e) => {
                            const updated = [...labResults];
                            updated[idx].value = e.target.value;
                            setLabResults(updated);
                          }}
                          className="w-full text-xs font-bold text-navy-800 border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.unit || ''}
                          onChange={(e) => {
                            const updated = [...labResults];
                            updated[idx].unit = e.target.value;
                            setLabResults(updated);
                          }}
                          className="w-full text-xs text-navy-600 border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.reference_range || ''}
                          onChange={(e) => {
                            const updated = [...labResults];
                            updated[idx].reference_range = e.target.value;
                            setLabResults(updated);
                          }}
                          className="w-full text-xs text-navy-600 border border-slate-200 rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.flag === 'HIGH' || item.flag === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : item.flag === 'LOW'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-teal-50 text-teal-700 border border-teal-200'
                          }`}
                        >
                          {item.flag || 'NORMAL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Preserve Verbatim OCR Text Accordion */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <button
          onClick={() => setOcrTextOpen(!ocrTextOpen)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-navy-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-navy-800">
              Verbatim Extracted OCR Text (Audit Reference)
            </span>
          </div>
          {ocrTextOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {ocrTextOpen && (
          <div className="p-6 bg-slate-900 text-slate-200 border-t border-slate-200">
            <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-96">
              {reviewData.ocr_text || '(No raw text captured from document stream)'}
            </pre>
          </div>
        )}
      </div>

      {/* Medical Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {reviewData.medical_disclaimer ||
            'HealthSync AI organizes, retrieves, and explains information from existing medical records. It NEVER diagnoses diseases, recommends treatments, or prescribes medications.'}
        </p>
      </div>

      {/* Clinician Confirmation & Signing Modal */}
      {clinicianModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-navy-950">Clinician Verification & Signing</h3>
                <p className="text-xs text-navy-500">Attach clinical signature and verify structured findings</p>
              </div>
            </div>

            <p className="text-xs text-navy-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              By confirming, you attest that you are an approved clinician and have reviewed this medical document.
              Your clinician identity, licence number, and timestamp will be permanently and immutably recorded in the clinical audit history.
            </p>

            {clinicianError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {clinicianError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                Clinical Verification Notes (Optional)
              </label>
              <textarea
                value={clinicianNotes}
                onChange={(e) => setClinicianNotes(e.target.value)}
                placeholder="Add clinical observation notes or verification details..."
                rows={3}
                className="w-full text-xs text-navy-800 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClinicianModalOpen(false)}
                disabled={clinicianVerifying}
                className="px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClinicianVerify}
                disabled={clinicianVerifying}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {clinicianVerifying ? 'Verifying & Signing...' : 'Sign & Verify Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
