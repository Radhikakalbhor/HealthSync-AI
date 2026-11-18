'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Pill,
  BarChart3,
  Clock,
  Upload,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Calendar,
  CheckCircle2,
  FileSearch,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { MedicalDocument } from '@/types';
import { UploadModal } from '@/components/documents/UploadModal';

export default function DashboardPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [todayReminders, setTodayReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [docsRes, remsRes] = await Promise.allSettled([
        api.listDocuments(20, 0),
        api.getTodayReminders(),
      ]);

      if (docsRes.status === 'fulfilled') {
        setDocuments(docsRes.value.documents || []);
      }
      if (remsRes.status === 'fulfilled') {
        setTodayReminders(remsRes.value || []);
      }
    } catch (err: any) {
      // If error or unconfigured, keep documents empty
      setError(err?.message || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const handleUploadEvent = () => {
      fetchDashboardData();
    };

    window.addEventListener('healthsync-record-uploaded', handleUploadEvent);
    return () => {
      window.removeEventListener('healthsync-record-uploaded', handleUploadEvent);
    };
  }, []);

  // Compute metrics
  const totalDocs = documents.length;
  const prescriptionsCount = documents.filter((d) => (d.document_type || '').toLowerCase() === 'prescription').length;
  const labReportsCount = documents.filter((d) => {
    const t = (d.document_type || '').toLowerCase();
    return t === 'blood_test' || t === 'laboratory_report' || t === 'lab_report';
  }).length;
  const pendingReviewCount = documents.filter((d) => d.needs_human_review || (d.status || '').toLowerCase() === 'needs_review').length;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-900 via-navy-800 to-health-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-health-500/20 border border-health-400/30 text-health-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Encrypted Health Record Vault</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hello, {user?.full_name || user?.email?.split('@')[0] || 'Patient'}
          </h2>
          <p className="mt-2 text-sm text-navy-200 leading-relaxed">
            Your centralized medical timeline is active. All prescriptions, laboratory findings, and diagnostic reports are organized and indexed with calibrated clinical OCR.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-health-600 hover:bg-health-700 text-white text-xs font-semibold shadow-md transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Medical Document
            </button>
            <Link
              href="/documents"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold transition-all"
            >
              Browse All Records
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Total Documents</p>
            <div className="w-9 h-9 rounded-xl bg-health-50 text-health-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-navy-950 mt-3">{loading ? '...' : totalDocs}</p>
          <p className="text-[11px] text-navy-400 mt-1">Ingested & verified records</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Prescriptions</p>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-navy-950 mt-3">{loading ? '...' : prescriptionsCount}</p>
          <p className="text-[11px] text-navy-400 mt-1">Structured medication lists</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Lab Reports</p>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-navy-950 mt-3">{loading ? '...' : labReportsCount}</p>
          <p className="text-[11px] text-navy-400 mt-1">Biomarker & blood test sets</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Review Needed</p>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-navy-950 mt-3">{loading ? '...' : pendingReviewCount}</p>
          <p className="text-[11px] text-navy-400 mt-1">Requires patient verification</p>
        </div>
      </div>

      {/* Main Grid: Recent Documents & Upcoming Reminders Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Recent Medical Records */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-navy-900">Recent Medical Records</h3>
            <Link
              href="/documents"
              className="text-xs font-semibold text-health-600 hover:text-health-700 flex items-center gap-1"
            >
              View All ({totalDocs})
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <div className="w-6 h-6 border-2 border-health-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-navy-500">Loading your medical records...</p>
            </div>
          ) : documents.length === 0 ? (
            /* Attractive Empty State */
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-health-50 text-health-600 flex items-center justify-center mx-auto mb-4">
                <FileSearch className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-base text-navy-900">No medical records uploaded yet</h4>
              <p className="text-xs text-navy-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Start by uploading a PDF or photo of a prescription, blood test, or doctor consultation note. HealthSync AI will organize it automatically.
              </p>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-health-600 hover:bg-health-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Upload className="w-4 h-4" />
                Upload Your First Document
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card divide-y divide-slate-100 overflow-hidden">
              {documents.slice(0, 5).map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-health-50 text-health-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-900 truncate">
                        {doc.filename || doc.original_filename || 'Untitled document'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-navy-400 mt-0.5">
                        <span className="capitalize">{(doc.document_type || 'other').replace(/_/g, ' ')}</span>
                        <span>•</span>
                        <span>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'}</span>
                        {doc.ocr_confidence !== undefined && doc.ocr_confidence !== null && (
                          <>
                            <span>•</span>
                            <span className="text-teal-700 font-medium">
                              {Math.round(doc.ocr_confidence * 100)}% OCR confidence
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {doc.status === 'unsupported' || doc.document_type === 'non_medical' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                        Non-Medical
                      </span>
                    ) : (doc.needs_human_review || doc.status === 'needs_review') ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Review Needed
                      </span>
                    ) : null}
                    <Link
                      href={`/documents/${doc.id}/review`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-navy-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Phase 5 Reminders Placeholder & System Security */}
        <div className="space-y-6">
          {/* Upcoming Reminders (Live in Phase 5) */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-health-600" />
                <h3 className="text-sm font-bold text-navy-900">Medication Reminders</h3>
              </div>
              <Link
                href="/reminders"
                className="px-2 py-0.5 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100 transition-colors"
              >
                OPEN TRACKER →
              </Link>
            </div>

            <p className="text-xs text-navy-500 leading-relaxed mb-4">
              Prescription-synchronized dose tracking, daily schedules, and weekly adherence.
            </p>

            <div className="space-y-3">
              {todayReminders.length > 0 ? (
                todayReminders.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${r.status === 'TAKEN' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <div>
                        <p className="text-xs font-bold text-navy-800">{r.medication_name} {r.dosage || ''}</p>
                        <p className="text-[11px] text-navy-500">{r.status === 'TAKEN' ? 'Taken on schedule' : 'Pending dose'}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'TAKEN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {r.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-health-500" />
                    <div>
                      <p className="text-xs font-semibold text-navy-800">Smart Daily Scheduling</p>
                      <p className="text-[11px] text-navy-400">Mark doses as taken or skipped</p>
                    </div>
                  </div>
                  <Link
                    href="/reminders"
                    className="text-xs font-semibold text-health-600 hover:text-health-700"
                  >
                    View
                  </Link>
                </div>
              )}

              <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-navy-800">AI Medical Records Assistant</p>
                    <p className="text-[11px] text-navy-400">Ask questions with source citations</p>
                  </div>
                </div>
                <Link
                  href="/assistant"
                  className="text-xs font-semibold text-purple-600 hover:text-purple-700"
                >
                  Chat
                </Link>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <Link
                href="/reminders"
                className="text-[11px] font-semibold text-health-600 hover:underline"
              >
                Manage your daily medication schedules →
              </Link>
            </div>
          </div>

          {/* Quick Security Summary */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-50/60 to-health-50/40 border border-teal-100">
            <div className="flex items-center gap-2 text-teal-900 font-bold text-xs mb-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Patient Data Privacy Active</span>
            </div>
            <p className="text-xs text-navy-600 leading-relaxed">
              Row-Level Security isolates all clinical documents to your unique user account. Audit logs record every retrieval action.
            </p>
          </div>
        </div>
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => fetchDashboardData()}
      />
    </div>
  );
}
