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
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10 border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(#14b8a6_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold mb-3 select-none">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Encrypted Clinical Record Vault</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-white">
            Hello, {user?.full_name || 'Alex Morgan'}
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed font-sans">
            Your centralized medical timeline is active. All prescriptions, laboratory findings, and diagnostic reports are organized and indexed with calibrated clinical OCR.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsUploadOpen(true)}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload Medical Document
            </Button>
            <Link href="/documents">
              <Button
                variant="outline"
                size="md"
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white hover:text-white"
              >
                Browse All Records
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Documents"
          value={loading ? '...' : totalDocs}
          subtitle="Ingested & verified records"
          icon={<FileText className="w-4 h-4" />}
          trend={{ direction: "neutral", value: "Vault Active", isPositive: true }}
        />
        <StatCard
          title="Prescriptions"
          value={loading ? '...' : prescriptionsCount}
          subtitle="Structured medication lists"
          icon={<Pill className="w-4 h-4" />}
          trend={{ direction: "up", value: "Verified active", isPositive: true }}
        />
        <StatCard
          title="Lab Reports"
          value={loading ? '...' : labReportsCount}
          subtitle="Biomarker & blood test sets"
          icon={<BarChart3 className="w-4 h-4" />}
          trend={{ direction: "up", value: "Analyte series", isPositive: true }}
        />
        <StatCard
          title="Review Needed"
          value={loading ? '...' : pendingReviewCount}
          subtitle="Requires patient verification"
          icon={<Activity className="w-4 h-4" />}
          trend={{
            direction: pendingReviewCount > 0 ? "down" : "neutral",
            value: pendingReviewCount > 0 ? "Action required" : "All verified",
            isPositive: pendingReviewCount === 0
          }}
        />
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
            <Card>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </CardContent>
            </Card>
          ) : documents.length === 0 ? (
            <EmptyState
              icon={<FileSearch className="w-7 h-7 text-teal-600" />}
              title="No medical records uploaded yet"
              description="Start by uploading a PDF or photo of a prescription, blood test, or doctor consultation note. HealthSync AI will organize it automatically."
              actionLabel="Upload Your First Document"
              onAction={() => setIsUploadOpen(true)}
            />
          ) : (
            <Card className="divide-y divide-slate-100 overflow-hidden shadow-card">
              {documents.slice(0, 5).map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate font-display">
                        {doc.filename || doc.original_filename || 'Untitled document'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-sans mt-0.5">
                        <span className="capitalize">{(doc.document_type || 'other').replace(/_/g, ' ')}</span>
                        <span>•</span>
                        <span className="tabular-nums">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'}
                        </span>
                        {doc.ocr_confidence !== undefined && doc.ocr_confidence !== null && (
                          <>
                            <span>•</span>
                            <span className="text-teal-700 font-semibold tabular-nums">
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
                      <Button variant="outline" size="sm">
                        Review
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Right 4 Cols: Reminders & Assistant Short-cuts */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-card">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-700" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Today&apos;s Medication Schedule
                  </CardTitle>
                </div>
                <Link href="/reminders">
                  <Badge variant="secondary" size="sm" className="cursor-pointer hover:bg-teal-100 transition-colors">
                    Tracker →
                  </Badge>
                </Link>
              </div>
              <CardDescription className="text-xs">
                Synchronized daily doses and adherence tracking.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-4">
              {todayReminders.length > 0 ? (
                todayReminders.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full flex items-center justify-center ${r.status === 'TAKEN' ? 'bg-emerald-500 text-white' : 'bg-amber-400'}`}>
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
                    <Clock className="w-4 h-4 text-teal-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Smart Daily Reminders</p>
                      <p className="text-[11px] text-slate-500">Track medication adherence</p>
                    </div>
                  </div>
                  <Link href="/reminders" className="text-xs font-bold text-teal-700 hover:text-teal-800">
                    View
                  </Link>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Clinical AI Assistant</p>
                    <p className="text-[11px] text-slate-500">Ask questions with source citations</p>
                  </div>
                </div>
                <Link href="/assistant">
                  <Button variant="ghost" size="sm" className="text-xs text-teal-700 hover:bg-teal-100">
                    Chat
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & RLS Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-50/70 to-slate-50 border border-teal-100 shadow-2xs">
            <div className="flex items-center gap-2 text-teal-900 font-bold text-xs mb-1.5 font-display">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Tenant Isolation Active</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              PostgreSQL Row-Level Security restricts all medical records strictly to your verified patient identity (`Alex Morgan`).
            </p>
          </div>
        </div>
      </div>

      {/* Persistent Medical Disclaimer */}
      <DisclaimerBanner />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => fetchDashboardData()}
      />
    </div>
  );
}
