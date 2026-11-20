'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  const requestSeq = useRef(0);

  useEffect(() => {
    fetchPreview(specialty);
  }, [specialty]);

  const fetchPreview = async (selectedSpecialty: string = specialty) => {
    const seq = ++requestSeq.current;
    setLoadingPreview(true);
    try {
      const [data] = await Promise.all([
        api.previewDoctorSummary(undefined, selectedSpecialty, notes),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
      if (seq === requestSeq.current) {
        setPreview(data);
      }
    } catch (err) {
      console.error('Failed to load doctor summary preview:', err);
    } finally {
      if (seq === requestSeq.current) {
        setLoadingPreview(false);
      }
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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight flex items-center gap-2.5 font-display">
            <div className="w-10 h-10 rounded-2xl bg-health-50 border border-health-100 flex items-center justify-center text-health-600">
              <Stethoscope className="w-5 h-5" />
            </div>
            {t('summary_title')}
          </h1>
          <p className="text-sm text-navy-600 mt-1 max-w-2xl font-sans">{t('summary_subtitle')}</p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleDownloadPdf}
          loading={downloadingPdf}
          disabled={loadingPreview}
          className="shadow-md shadow-health-600/20"
        >
          <Download className="w-4 h-4 mr-1.5" />
          {downloadingPdf ? 'Compiling PDF...' : t('btn_download_pdf')}
        </Button>
      </div>

      {/* Specialty and Notes Config Bar */}
      <Card className="p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-navy-800 mb-1.5">
            {t('summary_specialty_label')}
          </label>
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-navy-900 bg-white font-medium focus:ring-2 focus:ring-health-500/20 focus:border-health-500"
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
          <label className="block text-xs font-bold uppercase tracking-wider text-navy-800 mb-1.5">
            Visit Notes (included in report header)
          </label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Routine 3-month follow-up, reviewing lipid numbers and blood sugar"
            className="text-xs"
          />
        </div>
      </Card>

      {/* Active vs Previous Medications & Recent Labs Grid */}
      {loadingPreview ? (
        <Card className="animate-in fade-in duration-200">
          <CardContent className="py-16 text-center text-sm text-navy-500 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-health-600 border-t-transparent animate-spin mb-3" />
            Compiling clinical summary preview...
          </CardContent>
        </Card>
      ) : preview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          {/* Column 1: Medications (Active vs Previous) */}
          <div className="space-y-6">
            {/* Active Medications */}
            <Card className="p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-navy-950 flex items-center gap-2 font-display">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  {t('summary_active_meds')} ({preview.active_medications?.length || 0})
                </h2>
                <Badge variant="verified" className="text-[10px]">
                  Last 30 Days
                </Badge>
              </div>

              {preview.active_medications?.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No active medications recorded recently.</p>
              ) : (
                <div className="space-y-2">
                  {preview.active_medications.map((m: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-navy-950">{m.name}</span>
                        <span className="font-semibold text-teal-700 font-mono">{m.dosage}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Frequency: <span className="text-navy-800 font-medium">{m.frequency}</span> • Dr. {m.prescribed_by}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">Source: {m.source_doc}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Previous Medications */}
            <Card className="p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-navy-950 flex items-center gap-2 font-display">
                  <Pill className="w-4 h-4 text-slate-400" />
                  {t('summary_prev_meds')} ({preview.previous_medications?.length || 0})
                </h2>
                <Badge variant="default" className="text-[10px]">
                  Historical
                </Badge>
              </div>

              {preview.previous_medications?.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No historical prescriptions found.</p>
              ) : (
                <div className="space-y-2">
                  {preview.previous_medications.map((m: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-slate-500 font-mono text-[11px]">{m.dosage}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Prescribed {m.date} • {m.prescribed_by}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Column 2: Recent Labs & Document References */}
          <div className="space-y-6">
            {/* Recent Labs */}
            <Card className="p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-navy-950 flex items-center gap-2 font-display">
                  <BarChart3 className="w-4 h-4 text-health-600" />
                  {t('summary_recent_labs')} ({preview.recent_labs?.length || 0})
                </h2>
                <Badge variant="purple" className="text-[10px]">
                  Verified Lab Results
                </Badge>
              </div>

              {preview.recent_labs?.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No laboratory reports available.</p>
              ) : (
                <div className="space-y-2">
                  {preview.recent_labs.map((l: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:border-slate-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-navy-950">{l.test_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-navy-900 font-mono">
                            {l.value} <span className="font-normal text-slate-500">{l.unit}</span>
                          </span>
                          {l.flag && l.flag !== 'NORMAL' ? (
                            <Badge variant="high" className="text-[10px]">
                              {l.flag}
                            </Badge>
                          ) : (
                            <Badge variant="normal" className="text-[10px]">
                              NORMAL
                            </Badge>
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
            </Card>

            {/* Document References */}
            <Card className="p-5 space-y-3 shadow-sm">
              <h2 className="text-sm font-bold text-navy-950 flex items-center gap-2 border-b border-slate-100 pb-3 font-display">
                <FileText className="w-4 h-4 text-teal-600" />
                Indexed Source Documents ({preview.document_references?.length || 0})
              </h2>
              <div className="space-y-1.5">
                {preview.document_references?.map((d: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50">
                    <span className="font-medium text-navy-900 truncate max-w-[220px]">{d.filename}</span>
                    <span className="text-[10px] text-slate-500 uppercase font-mono">{d.type} • {d.date}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* PART 2: Pre-Visit Doctor Briefing & Suggested Questions */}
      <div className="bg-gradient-to-tr from-navy-950 via-navy-900 to-navy-950 text-white rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl border border-navy-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Patient Empowerment Tool</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-display">{t('summary_briefing_heading')}</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl font-sans">
              Synthesize your medical history and generate tailored questions to ask during your upcoming consultation.
            </p>
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={handleGenerateBriefing}
            loading={generatingBriefing}
            className="bg-teal-500 hover:bg-teal-400 text-navy-950 font-bold border-0"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {generatingBriefing ? 'Generating Briefing...' : t('btn_generate_briefing')}
          </Button>
        </div>

        {/* Primary Concern Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
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
          <div className="space-y-4 pt-4 border-t border-white/10 animate-in fade-in">
            <h3 className="text-sm font-bold text-teal-300 flex items-center gap-2 font-display">
              <HelpCircle className="w-4 h-4" />
              Suggested Questions for Your Physician
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {briefing.suggested_questions_for_doctor?.map((q: string, idx: number) => (
                <div
                  key={idx}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs hover:bg-white/10 transition-colors"
                >
                  <p className="text-slate-100 leading-relaxed font-sans">{q}</p>
                  <button
                    onClick={() => copyToClipboard(q, idx)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 shrink-0 cursor-pointer"
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
