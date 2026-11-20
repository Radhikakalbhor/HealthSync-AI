'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Pill,
  BarChart3,
  Upload,
  ShieldCheck,
  Calendar,
  ChevronRight,
  Activity,
  FileSearch,
  Sparkles,
  Clock,
  Check,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { MedicalDocument } from '@/types';
import { cn } from '@/lib/utils';
import { UploadModal } from '@/components/documents/UploadModal';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { DisclaimerBanner } from '@/components/ui/disclaimer-banner';
import { Skeleton } from '@/components/ui/skeleton';

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
    <div className="space-y-8 animate-in fade-in-50 duration-200 font-sans max-w-7xl mx-auto pb-12">
      {/* Welcome Hero Banner with Animated Heartbeat ECG & Futuristic Medical Technology Theme */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#071D2B] via-[#0B3D4A] to-[#071D2B] p-6 sm:p-8 text-white shadow-xl shadow-[#071D2B]/15 border border-[#13B8AE]/30">
        {/* Subtle radial cyan glow */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(19,184,174,0.2),transparent_70%)] pointer-events-none" />

        {/* Medical Cross Pattern in Hero */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(54, 214, 232, 0.4) 1.5px, transparent 0)`,
            backgroundSize: '24px 24px'
          }}
        />

        {/* Animated ECG Heartbeat Line in Hero */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-full md:w-3/5 h-28 pointer-events-none opacity-40 overflow-hidden flex items-center justify-end pr-4">
          <svg viewBox="0 0 700 120" className="w-full h-full text-[#36D6E8] stroke-current fill-none">
            <path
              d="M0 60 L120 60 L140 30 L160 90 L180 15 L200 100 L215 50 L230 60 L310 60 C320 40 340 30 360 45 C380 30 400 40 410 60 C420 80 360 105 360 105 C360 105 300 80 310 60 L390 60 L410 20 L425 105 L440 35 L455 80 L470 60 L700 60"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-ecg-line"
            />
          </svg>
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#13B8AE]/15 border border-[#13B8AE]/40 text-[#36D6E8] text-xs font-semibold mb-3 select-none">
            <span className="w-2 h-2 rounded-full bg-[#13B8AE] animate-ping inline-block" />
            <ShieldCheck className="w-3.5 h-3.5 text-[#36D6E8]" />
            <span>Digital Hospital & Vault Active</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight font-display text-white">
            Good Day, {user?.full_name || 'Alex Morgan'}! 👋
          </h1>
          <p className="mt-2 text-sm sm:text-base text-cyan-100/90 leading-relaxed font-sans">
            Your personal medical records, all in one place. Instant access to clinical entities, biomarker trends, and encrypted health cards.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsUploadOpen(true)}
              className="bg-gradient-to-r from-[#13B8AE] to-[#36D6E8] hover:from-[#0da59c] hover:to-[#25c4d6] text-[#071D2B] font-black border-0 shadow-lg shadow-teal-500/25"
            >
              <Upload className="w-4 h-4 mr-1.5 stroke-[2.5]" />
              Upload Medical Document
            </Button>
            <Link href="/documents">
              <Button
                variant="outline"
                size="md"
                className="bg-white/10 hover:bg-white/20 border-white/25 text-white hover:text-white"
              >
                Browse All Records
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards - Solid Crisp White with Subtle Borders and Glow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Total Records (Cyan Accent) */}
        <div className="p-5 rounded-2xl bg-white border border-[#d6e8f2] shadow-sm shadow-[#071D2B]/5 flex flex-col justify-between transition-all hover:-translate-y-1 hover:border-[#13B8AE] hover:shadow-lg hover:shadow-cyan-900/10 duration-200 relative overflow-hidden group">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0B3D4A] to-[#13B8AE] text-white flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20">
              <FileText className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-[#071D2B] font-display tabular-nums tracking-tight">
                {loading ? '...' : totalDocs}
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Records
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#0B3D4A] font-semibold">
            <span>Encrypted & Indexed</span>
            <span className="text-slate-400">Vault Safe</span>
          </div>
        </div>

        {/* Card 2: Prescriptions (Blue / Pill Accent) */}
        <div className="p-5 rounded-2xl bg-white border border-[#d6e8f2] shadow-sm shadow-[#071D2B]/5 flex flex-col justify-between transition-all hover:-translate-y-1 hover:border-[#3289D8] hover:shadow-lg hover:shadow-blue-900/10 duration-200 relative overflow-hidden group">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#3289D8] to-[#13B8AE] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <Pill className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-[#071D2B] font-display tabular-nums tracking-tight">
                {loading ? '...' : prescriptionsCount}
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Prescriptions
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#3289D8] font-semibold">
            <span>Medication Schedules</span>
            <span className="text-slate-400">Rx Active</span>
          </div>
        </div>

        {/* Card 3: Lab Reports (Purple / Diagnostic Accent) */}
        <div className="p-5 rounded-2xl bg-white border border-[#d6e8f2] shadow-sm shadow-[#071D2B]/5 flex flex-col justify-between transition-all hover:-translate-y-1 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-900/10 duration-200 relative overflow-hidden group">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
              <BarChart3 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-[#071D2B] font-display tabular-nums tracking-tight">
                {loading ? '...' : labReportsCount}
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Lab Reports
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-purple-700 font-semibold">
            <span>Biomarker Panels</span>
            <span className="text-slate-400">Analyte Trends</span>
          </div>
        </div>

        {/* Card 4: Consultations & Review (Teal Accent) */}
        <div className="p-5 rounded-2xl bg-white border border-[#d6e8f2] shadow-sm shadow-[#071D2B]/5 flex flex-col justify-between transition-all hover:-translate-y-1 hover:border-[#13B8AE] hover:shadow-lg hover:shadow-emerald-900/10 duration-200 relative overflow-hidden group">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-[#13B8AE] text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <Calendar className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-[#071D2B] font-display tabular-nums tracking-tight">
                {loading ? '...' : (totalDocs > 0 ? Math.max(1, totalDocs - prescriptionsCount - labReportsCount) : 0)}
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Consultations
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
            <span>Doctor Notes</span>
            <span className="text-slate-400">Verified</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Documents & Today's Medication Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 Cols: Recent Medical Records Feed */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 font-display">Recent Medical Records</h2>
            <Link
              href="/documents"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 transition-colors"
            >
              <span>View All ({totalDocs})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-[#d6e8f2] bg-white p-6 space-y-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FileSearch className="w-7 h-7 text-[#13B8AE]" />}
              title="No medical records uploaded yet"
              description="Start by uploading a PDF or photo of a prescription, blood test, or doctor consultation note. HealthSync AI will organize it automatically."
              actionLabel="Upload Your First Document"
              onAction={() => setIsUploadOpen(true)}
            />
          ) : (
            <div className="rounded-2xl border border-[#d6e8f2] bg-white shadow-sm shadow-[#071D2B]/5 overflow-hidden divide-y divide-slate-100">
              {documents.slice(0, 5).map((doc) => {
                const docType = (doc.document_type || 'other').toLowerCase();
                const isPrescription = docType.includes('prescription') || docType.includes('rx');
                const isLab = docType.includes('lab') || docType.includes('blood') || docType.includes('test');
                const isConsultation = docType.includes('consult') || docType.includes('doctor') || docType.includes('note');

                return (
                  <div
                    key={doc.id}
                    className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Color-accented icon badge tailored by document type */}
                      <div
                        className={cn(
                          "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105",
                          isPrescription
                            ? "bg-blue-50 text-[#3289D8] border border-blue-200"
                            : isLab
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : isConsultation
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-teal-50 text-[#13B8AE] border border-teal-200"
                        )}
                      >
                        {isPrescription ? (
                          <Pill className="w-5 h-5 stroke-[2.2]" />
                        ) : isLab ? (
                          <BarChart3 className="w-5 h-5 stroke-[2.2]" />
                        ) : isConsultation ? (
                          <Calendar className="w-5 h-5 stroke-[2.2]" />
                        ) : (
                          <FileText className="w-5 h-5 stroke-[2.2]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#071D2B] truncate font-display group-hover:text-[#13B8AE] transition-colors">
                          {doc.filename || doc.original_filename || 'Untitled document'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-sans mt-0.5">
                          <span
                            className={cn(
                              "font-semibold capitalize px-2 py-0.5 rounded-md text-[11px]",
                              isPrescription
                                ? "bg-blue-50 text-[#3289D8]"
                                : isLab
                                ? "bg-purple-50 text-purple-700"
                                : isConsultation
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-teal-50 text-[#13B8AE]"
                            )}
                          >
                            {(doc.document_type || 'other').replace(/_/g, ' ')}
                          </span>
                          <span>•</span>
                          <span className="tabular-nums">
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                          {doc.ocr_confidence !== undefined && doc.ocr_confidence !== null && (
                            <>
                              <span>•</span>
                              <span className="text-[#13B8AE] font-bold tabular-nums">
                                {Math.round(doc.ocr_confidence * 100)}% verified
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 ml-4">
                      {doc.status === 'unsupported' || doc.document_type === 'non_medical' ? (
                        <Badge variant="default" size="sm">
                          Non-Medical
                        </Badge>
                      ) : (doc.needs_human_review || doc.status === 'needs_review') ? (
                        <StatusBadge status="warning" label="Review Needed" size="sm" />
                      ) : (
                        <StatusBadge status="optimal" label="Verified" size="sm" />
                      )}
                      <Link href={`/documents/${doc.id}/review`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white hover:bg-teal-50 hover:text-[#0B3D4A] hover:border-[#13B8AE] font-bold text-xs"
                        >
                          Review
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 4 Cols: Upload Action Banner + Reminders & Assistant Short-cuts */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Action Upload Card (Matching User's Reference) */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0B3D4A] via-[#0e4857] to-[#071D2B] text-white p-5 shadow-lg shadow-[#071D2B]/15 border border-[#13B8AE]/30 relative overflow-hidden">
            <div className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-white/10 pointer-events-none">
              <Upload className="w-full h-full" />
            </div>
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Upload className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white font-display">Upload New Document</h3>
                  <p className="text-xs text-cyan-100">Prescriptions, lab reports, discharge summaries</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="w-full bg-gradient-to-r from-[#13B8AE] to-[#36D6E8] hover:from-[#0da59c] hover:to-[#22b5c6] text-[#071D2B] font-black text-xs py-2.5 rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.01]"
              >
                Upload Files →
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d6e8f2] bg-white shadow-sm shadow-[#071D2B]/5 overflow-hidden">
            <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#13B8AE]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#071D2B]">
                  Today&apos;s Medication Schedule
                </h3>
              </div>
              <Link href="/reminders">
                <span className="text-[11px] font-bold text-[#13B8AE] hover:text-[#0B3D4A] bg-teal-50 px-2.5 py-1 rounded-full cursor-pointer hover:bg-teal-100 transition-colors">
                  Tracker →
                </span>
              </Link>
            </div>

            <div className="p-4 space-y-3">
              {todayReminders.length > 0 ? (
                todayReminders.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${r.status === 'TAKEN' ? 'bg-emerald-500 text-white' : 'bg-amber-400'}`}>
                        {r.status === 'TAKEN' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{r.medication_name} {r.dosage || ''}</p>
                        <p className="text-[11px] text-slate-500">{r.status === 'TAKEN' ? 'Taken on schedule' : 'Pending dose'}</p>
                      </div>
                    </div>
                    <StatusBadge
                      status={r.status === 'TAKEN' ? 'optimal' : 'warning'}
                      label={r.status === 'TAKEN' ? 'Taken' : 'Pending'}
                      size="sm"
                    />
                  </div>
                ))
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-[#13B8AE]" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Smart Daily Reminders</p>
                      <p className="text-[11px] text-slate-500">Track medication adherence</p>
                    </div>
                  </div>
                  <Link href="/reminders" className="text-xs font-bold text-[#13B8AE] hover:text-[#0B3D4A]">
                    View
                  </Link>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#13B8AE] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Clinical AI Assistant</p>
                    <p className="text-[11px] text-slate-500">Ask questions with source citations</p>
                  </div>
                </div>
                <Link href="/assistant">
                  <Button variant="ghost" size="sm" className="text-xs font-bold text-[#13B8AE] hover:bg-teal-100">
                    Chat
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Privacy & Security Assurance Pill */}
          <div className="p-4 rounded-2xl bg-white border border-[#d6e8f2] flex items-center gap-3 text-xs text-slate-600 shadow-sm shadow-[#071D2B]/5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#13B8AE] flex items-center justify-center shrink-0 border border-teal-100">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-[#071D2B]">Your Health Data is Safe</p>
              <p className="text-[11px] text-slate-500">Strict patient isolation with Row-Level Security.</p>
            </div>
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
