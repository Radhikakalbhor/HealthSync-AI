'use client';

import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Download,
  Sparkles,
  Pill,
  BarChart3,
  FileText,
  HelpCircle,
  Copy,
  Check,
  ShieldCheck,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export default function DoctorSummaryPage() {
  const { t } = useTranslation();
  const [specialty, setSpecialty] = useState('General Medicine');
  const [notes, setNotes] = useState('');
  const [primaryConcern, setPrimaryConcern] = useState('Routine review of current medications and recent blood tests');
  
  const [preview, setPreview] = useState<any>(null);
  const [briefing, setBriefing] = useState<any>(null);
  
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [copiedQuestionIdx, setCopiedQuestionIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchPreview();
  }, [specialty]);

  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const data = await api.previewDoctorSummary(undefined, specialty, notes);
      setPreview(data);
    } catch (err) {
      console.error('Failed to load doctor summary preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const blob = await api.downloadDoctorSummaryPdf(undefined, specialty, notes);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HealthSync_${specialty.replace(/\s+/g, '_')}_Summary.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Failed to generate PDF summary.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleGenerateBriefing = async () => {
    if (!primaryConcern.trim()) return;
    setGeneratingBriefing(true);
    try {
      const data = await api.generateDoctorBriefing(specialty, primaryConcern);
      setBriefing(data);
    } catch (err) {
      console.error('Briefing generation error:', err);
    } finally {
      setGeneratingBriefing(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionIdx(idx);
    setTimeout(() => setCopiedQuestionIdx(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight flex items-center gap-2">
            <Stethoscope className="w-7 h-7 text-health-600" />
            {t('summary_title')}
          </h1>
          <p className="text-sm text-navy-600 mt-1">{t('summary_subtitle')}</p>
        </div>

        <button
          onClick={handleDownloadPdf}
          disabled={downloadingPdf || loadingPreview}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all"
        >
          <Download className="w-4 h-4" />
          {downloadingPdf ? 'Compiling PDF...' : t('btn_download_pdf')}
        </button>
      </div>

      {/* Specialty and Notes Config Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-navy-800 mb-1.5">
            {t('summary_specialty_label')}
          </label>
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-navy-900 bg-white focus:ring-2 focus:ring-health-500/20 focus:border-health-500"
          >
            <option value="General Medicine">General Medicine / Physician</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Endocrinology">Endocrinology & Diabetology</option>
            <option value="Gastroenterology">Gastroenterology</option>
            <option value="Orthopedics">Orthopedics</option>
            <option value="Pulmonology">Pulmonology</option>
            <option value="Dermatology">Dermatology</option>
            <option value="Pediatrics">Pediatrics</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-navy-800 mb-1.5">
            Visit Notes (included in report header)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Routine 3-month follow-up, reviewing lipid numbers and blood sugar"
            className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-navy-900 placeholder:text-slate-400 focus:ring-2 focus:ring-health-500/20 focus:border-health-500"
          />
        </div>
      </div>

      {/* Active vs Previous Medications & Recent Labs Grid */}
      {loadingPreview ? (
        <div className="py-16 text-center text-sm text-navy-500 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-health-500 border-t-transparent animate-spin mb-3" />
          Compiling clinical summary preview...
        </div>
      ) : preview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Medications (Active vs Previous) */}
          <div className="space-y-6">
            {/* Active Medications */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-navy-950 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  {t('summary_active_meds')} ({preview.active_medications?.length || 0})
                </h3>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Last 30 Days
                </span>
              </div>

              {preview.active_medications?.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No active medications recorded recently.</p>
              ) : (
                <div className="space-y-2">
                  {preview.active_medications.map((m: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-navy-950">{m.name}</span>
                        <span className="font-semibold text-teal-700">{m.dosage}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Frequency: <span className="text-navy-800">{m.frequency}</span> • Dr. {m.prescribed_by}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">Source: {m.source_doc}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Previous Medications */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-navy-950 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-slate-400" />
                  {t('summary_prev_meds')} ({preview.previous_medications?.length || 0})
                </h3>
                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  Historical
                </span>
              </div>

              {preview.previous_medications?.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No historical prescriptions found.</p>
              ) : (
                <div className="space-y-2">
                  {preview.previous_medications.map((m: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-slate-500">{m.dosage}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Prescribed {m.date} • {m.prescribed_by}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Recent Labs & Document References */}
          <div className="space-y-6">
            {/* Recent Labs */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-navy-950 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-health-600" />
                  {t('summary_recent_labs')} ({preview.recent_labs?.length || 0})
                </h3>
                <span className="text-[10px] font-semibold text-navy-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  Verified Lab Results
                </span>
              </div>

              {preview.recent_labs?.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No laboratory reports available.</p>
              ) : (
                <div className="space-y-2">
                  {preview.recent_labs.map((l: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-navy-950">{l.test_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-navy-900">
                            {l.value} <span className="font-normal text-slate-500">{l.unit}</span>
                          </span>
                          {l.flag && l.flag !== 'NORMAL' ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              {l.flag}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              NORMAL
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ref: {l.reference_range || 'N/A'} • {l.lab} • {l.date}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document References */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-navy-950 flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-4 h-4 text-teal-600" />
                Indexed Source Documents ({preview.document_references?.length || 0})
              </h3>
              <div className="space-y-1.5">
                {preview.document_references?.map((d: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50">
                    <span className="font-medium text-navy-900 truncate max-w-[220px]">{d.filename}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{d.type} • {d.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PART 2: Pre-Visit Doctor Briefing & Suggested Questions */}
      <div className="bg-gradient-to-tr from-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-teal-400 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Patient Empowerment Tool
            </span>
            <h2 className="text-xl font-bold mt-1 text-white">{t('summary_briefing_heading')}</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Synthesize your medical history and generate tailored questions to ask during your upcoming consultation.
            </p>
          </div>

          <button
            onClick={handleGenerateBriefing}
            disabled={generatingBriefing}
            className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-navy-950 font-bold text-xs shadow-md transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {generatingBriefing ? 'Generating Briefing...' : t('btn_generate_briefing')}
          </button>
        </div>

        {/* Primary Concern Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-200 mb-1.5">
            {t('summary_concern_label')}
          </label>
          <input
            type="text"
            value={primaryConcern}
            onChange={(e) => setPrimaryConcern(e.target.value)}
            placeholder="e.g. Having frequent dizzy spells in the morning after taking blood pressure medicine"
            className="w-full text-xs rounded-xl bg-white/10 border border-white/20 p-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        {/* Generated Briefing Questions */}
        {briefing && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="text-sm font-bold text-teal-300 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Suggested Questions for Your Physician
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {briefing.suggested_questions_for_doctor?.map((q: string, idx: number) => (
                <div
                  key={idx}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs hover:bg-white/10 transition-colors"
                >
                  <p className="text-slate-100 leading-relaxed">{q}</p>
                  <button
                    onClick={() => copyToClipboard(q, idx)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 shrink-0"
                    title="Copy question"
                  >
                    {copiedQuestionIdx === idx ? (
                      <Check className="w-3.5 h-3.5 text-teal-300" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 italic pt-2">
              {briefing.disclaimer}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
