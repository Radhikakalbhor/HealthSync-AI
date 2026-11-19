'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
  Upload,
  Database,
  Pill,
  BarChart3,
  Bot,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  FileCheck,
  Zap,
  Activity,
  HeartPulse,
  QrCode,
  Users,
  ChevronDown,
  ChevronUp,
  Star,
  Layers,
  Search,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { BackgroundBeams } from '@/components/ui/background-beams';

export default function LandingPage() {
  const { user, loginDemo } = useAuth();
  const [activeTab, setActiveTab] = useState<'prescription' | 'labs' | 'emergency' | 'assistant'>('prescription');
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setFaqOpen(faqOpen === index ? null : index);
  };

  const faqs = [
    {
      question: 'How does HealthSync AI protect my personal medical data?',
      answer:
        'HealthSync AI enforces defense-in-depth isolation via PostgreSQL Row-Level Security (RLS). Every document, medication schedule, and extracted analyte is cryptographically tagged with your user UUID. Storage buckets use private access policies with short-lived, authenticated signed URLs. Your medical data is never used to train public AI models.',
    },
    {
      question: 'Does HealthSync AI diagnose medical conditions or prescribe drugs?',
      answer:
        'No. HealthSync AI is strictly a clinical document intelligence and personal health record management system. It extracts, organizes, and summarizes your records for personal visibility and clinician consultation. It NEVER diagnoses illnesses or provides medical advice. All extracted values highlight low-confidence items for human-in-the-loop verification.',
    },
    {
      question: 'How does Emergency QR Sharing work if I am offline or unconscious?',
      answer:
        'You can generate a secure, time-limited or permanent Emergency Medical Profile. Emergency responders or ER physicians can scan your QR code to instantly view life-critical details: blood type, severe drug allergies, active prescriptions, and emergency contacts—without requiring a login.',
    },
    {
      question: 'What types of medical files can I upload?',
      answer:
        'You can upload digital PDF files, scanned documents, and high-resolution smartphone photos (JPEG, PNG). HealthSync AI uses dual-engine text recognition (PyMuPDF for digital text and Tesseract OCR 5.4 for scans) combined with Google Gemini Multimodal Vision for handwritten clinical prescriptions.',
    },
    {
      question: 'Can I track biomarker trends across different diagnostic laboratories?',
      answer:
        'Yes. Whether your blood tests come from Quest, LabCorp, or local clinics, HealthSync AI normalizes test names, measurement units, and reference ranges into longitudinal trend charts (e.g., HbA1c, Fasting Glucose, Lipid Panels) with automated normal/high/critical status flags.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 selection:bg-health-100 selection:text-health-900">
      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24 bg-gradient-to-b from-health-50/70 via-white to-slate-50">
          <div className="absolute inset-0 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Top 2-Column Split: Headline + Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center text-left">
              {/* Left Column (7 cols): Main Heading, Tagline, Description & Feature Points */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-navy-950 tracking-tight leading-[1.08] font-display">
                    Your Records In Order
                  </h1>
                  <p className="mt-3 text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-health-600 via-teal-600 to-health-700 font-display">
                    Your Health. Connected. Intelligent. Organized.
                  </p>
                  <p className="mt-4 text-base sm:text-lg text-navy-600 leading-relaxed font-sans max-w-xl">
                    All your medical records, neatly organised in one place.
                  </p>
                </div>

                {/* Trust & Capability Points with equal alignment and clean lining */}
                <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-navy-700 font-medium">
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/90 border border-slate-200/90 shadow-2xs hover:border-health-300 transition-colors">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Zero-Hallucination Extraction</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/90 border border-slate-200/90 shadow-2xs hover:border-health-300 transition-colors">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Calibrated Confidence Scoring</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/90 border border-slate-200/90 shadow-2xs hover:border-health-300 transition-colors">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>PostgreSQL Row-Level Security</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white/90 border border-slate-200/90 shadow-2xs hover:border-health-300 transition-colors">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Emergency QR Medical Card</span>
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Action Portal Card */}
              <div className="lg:col-span-5">
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/60 space-y-5">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600">
                      Instant Patient Access
                    </span>
                    <h2 className="text-xl font-extrabold text-navy-950 font-display mt-0.5">
                      Start Organizing Today
                    </h2>
                    <p className="text-xs text-navy-500 mt-1">
                      Experience encrypted clinical document intelligence with instant demo mode.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    {user ? (
                      <Link href="/dashboard" className="block w-full">
                        <button className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-health-600 hover:bg-health-700 text-white font-bold text-sm shadow-md shadow-health-600/25 transition-all hover:-translate-y-0.5 cursor-pointer">
                          <Activity className="w-4 h-4" />
                          <span>Go to Dashboard</span>
                          <ArrowRight className="w-4 h-4 ml-0.5" />
                        </button>
                      </Link>
                    ) : (
                      <>
                        <Link href="/register" className="block w-full">
                          <button className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-health-600 hover:bg-health-700 text-white font-bold text-sm shadow-md shadow-health-600/25 transition-all hover:-translate-y-0.5 cursor-pointer">
                            <span>Get Started Free</span>
                            <ArrowRight className="w-4 h-4 ml-0.5" />
                          </button>
                        </Link>
                        <button
                          onClick={loginDemo}
                          className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-teal-50 hover:bg-teal-100/80 text-teal-900 border border-teal-200/90 font-bold text-xs transition-all hover:-translate-y-0.5 cursor-pointer"
                        >
                          <Zap className="w-4 h-4 fill-teal-600 text-teal-600" />
                          <span>Instant Demo (Alex Morgan)</span>
                        </button>
                        <div className="pt-1 text-center">
                          <Link href="/login" className="inline-block text-xs font-semibold text-navy-600 hover:text-navy-900 transition-colors">
                            Already registered? <span className="text-health-600 underline underline-offset-4">Sign in</span>
                          </Link>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-navy-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Zero setup • HIPAA-compliant architecture</span>
                  </div>
                </div>
              </div>
            </div>

            {/* INTERACTIVE SHOWCASE: Left Vertical Buttons, Right Display Box */}
            <div className="mt-16 max-w-6xl mx-auto text-left">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                {/* Left Side (4 cols): Stacked Buttons One by One Up and Down */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                  <button
                    onClick={() => setActiveTab('prescription')}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                      activeTab === 'prescription'
                        ? 'bg-white border-health-500 shadow-md ring-2 ring-health-500/20 text-navy-950'
                        : 'bg-white/80 hover:bg-white text-navy-700 border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          activeTab === 'prescription'
                            ? 'bg-health-600 text-white'
                            : 'bg-health-50 text-health-600'
                        }`}
                      >
                        <Pill className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-950 font-display">
                          Prescription Intelligence
                        </h3>
                        <p className="text-[11px] text-navy-500 mt-0.5">
                          Medications, dosages & schedules
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('labs')}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                      activeTab === 'labs'
                        ? 'bg-white border-teal-500 shadow-md ring-2 ring-teal-500/20 text-navy-950'
                        : 'bg-white/80 hover:bg-white text-navy-700 border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          activeTab === 'labs'
                            ? 'bg-teal-600 text-white'
                            : 'bg-teal-50 text-teal-600'
                        }`}
                      >
                        <BarChart3 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-950 font-display">
                          Lab Biomarker Analytics
                        </h3>
                        <p className="text-[11px] text-navy-500 mt-0.5">
                          Analytes, trends & reference ranges
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('emergency')}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                      activeTab === 'emergency'
                        ? 'bg-white border-rose-500 shadow-md ring-2 ring-rose-500/20 text-navy-950'
                        : 'bg-white/80 hover:bg-white text-navy-700 border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          activeTab === 'emergency'
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-950 font-display">
                          Emergency QR Profile
                        </h3>
                        <p className="text-[11px] text-navy-500 mt-0.5">
                          Offline blood group, allergies & ICE
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('assistant')}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                      activeTab === 'assistant'
                        ? 'bg-white border-purple-500 shadow-md ring-2 ring-purple-500/20 text-navy-950'
                        : 'bg-white/80 hover:bg-white text-navy-700 border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          activeTab === 'assistant'
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-50 text-purple-600'
                        }`}
                      >
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-950 font-display">
                          Isolated RAG Assistant
                        </h3>
                        <p className="text-[11px] text-navy-500 mt-0.5">
                          Citation-backed record answers
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Right Side (8 cols): The Display Box */}
                <div className="lg:col-span-8">
                  <div className="rounded-3xl p-2 bg-gradient-to-b from-navy-200/50 to-navy-100/20 shadow-2xl border border-navy-200/60">
                    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-inner min-h-[360px] flex flex-col justify-center">
                      {/* TAB 1: Prescription */}
                      {activeTab === 'prescription' && (
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-health-100 text-health-700 flex items-center justify-center font-bold text-sm shadow-xs">
                                <Pill className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold text-navy-900 text-base">
                                  Prescription Document: Rx_Amoxicillin_Nov2026.pdf
                                </h3>
                                <p className="text-xs text-navy-500">
                                  Dr. Sarah Jenkins, MD • Clinical General Practice • Verified Nov 14, 2026
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-mono">
                                Confidence: 98%
                              </span>
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-health-50 text-health-700 border border-health-200">
                                Verified Active
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-[11px] font-bold text-navy-500 uppercase tracking-wider">Medication Name</span>
                              <h4 className="text-base font-bold text-navy-950 mt-1">Amoxicillin</h4>
                              <p className="text-xs text-navy-600 mt-1">Dosage: 500 mg • Oral Capsule</p>
                              <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium border border-teal-100">
                                <CheckCircle2 className="w-3 h-3" /> Exact match verified
                              </div>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-[11px] font-bold text-navy-500 uppercase tracking-wider">Schedule & Duration</span>
                              <h4 className="text-base font-bold text-navy-950 mt-1">3 Times Daily</h4>
                              <p className="text-xs text-navy-600 mt-1">Every 8 hours with meals • 10-day course</p>
                              <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-health-700 bg-health-50 px-2 py-0.5 rounded font-medium border border-health-100">
                                <Clock className="w-3 h-3" /> 8:00 AM, 2:00 PM, 8:00 PM
                              </div>
                            </div>

                            <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200/70">
                              <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">Adherence Tracker</span>
                              <h4 className="text-base font-bold text-teal-950 mt-1">94% Adherence</h4>
                              <p className="text-xs text-teal-700 mt-1">28 of 30 doses logged on schedule</p>
                              <div className="mt-3 w-full bg-teal-200 rounded-full h-1.5">
                                <div className="bg-teal-600 h-1.5 rounded-full w-[94%]" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: Lab Reports */}
                      {activeTab === 'labs' && (
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm shadow-xs">
                                <BarChart3 className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold text-navy-900 text-base">
                                  Comprehensive Metabolic Panel (CMP)
                                </h3>
                                <p className="text-xs text-navy-500">
                                  Quest Diagnostics • Specimen ID: #QD-99214 • Extracted automatically
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                                1 Flagged Analyte
                              </span>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-navy-700">
                              <thead className="text-xs uppercase bg-slate-50 text-navy-500 border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3">Analyte / Test</th>
                                  <th className="py-2.5 px-3">Observed Value</th>
                                  <th className="py-2.5 px-3">Reference Range</th>
                                  <th className="py-2.5 px-3">Clinical Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                                <tr>
                                  <td className="py-2.5 px-3 font-semibold text-navy-950">Fasting Plasma Glucose</td>
                                  <td className="py-2.5 px-3 font-bold text-navy-900 font-mono">92 mg/dL</td>
                                  <td className="py-2.5 px-3 text-navy-500 font-mono">70 - 99 mg/dL</td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      NORMAL
                                    </span>
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-2.5 px-3 font-semibold text-navy-950">HbA1c (Glycated Hemoglobin)</td>
                                  <td className="py-2.5 px-3 font-bold text-navy-900 font-mono">5.5 %</td>
                                  <td className="py-2.5 px-3 text-navy-500 font-mono">&lt; 5.7 %</td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      OPTIMAL
                                    </span>
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-2.5 px-3 font-semibold text-navy-950">Total Serum Cholesterol</td>
                                  <td className="py-2.5 px-3 font-bold text-amber-900 font-mono">208 mg/dL</td>
                                  <td className="py-2.5 px-3 text-navy-500 font-mono">&lt; 200 mg/dL</td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                      SLIGHTLY HIGH
                                    </span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* TAB 3: Emergency Card */}
                      {activeTab === 'emergency' && (
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-sm shadow-xs">
                                <HeartPulse className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold text-navy-900 text-base">
                                  Emergency Medical Responder Vault
                                </h3>
                                <p className="text-xs text-navy-500">
                                  Instant offline QR token • No password required for emergency paramedics
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                              Active Token: Valid
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-[11px] font-bold text-navy-500 uppercase tracking-wider">Blood Group</span>
                              <h4 className="text-xl font-extrabold text-navy-950 mt-1 font-mono">O Positive (O+)</h4>
                              <p className="text-xs text-navy-500 mt-1">Donor Profile: Universal Red Cells</p>
                            </div>

                            <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/70">
                              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Severe Allergies</span>
                              <h4 className="text-base font-bold text-rose-950 mt-1">Penicillin, Sulfa Drugs</h4>
                              <p className="text-xs text-rose-700 mt-1">Anaphylaxis Risk: High Alert</p>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-[11px] font-bold text-navy-500 uppercase tracking-wider">Primary ICE Contact</span>
                              <h4 className="text-base font-bold text-navy-950 mt-1">Emma Morgan (Spouse)</h4>
                              <p className="text-xs text-navy-600 mt-1 font-mono">+1 (555) 234-5678 • Verified</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 4: Assistant */}
                      {activeTab === 'assistant' && (
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shadow-xs">
                                <Bot className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold text-navy-900 text-base">
                                  Patient-Isolated RAG Clinical Assistant
                                </h3>
                                <p className="text-xs text-navy-500">
                                  Ground truth queries with zero hallucination & strict PDF page citations
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              Isolated Context
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div className="p-3.5 rounded-xl bg-slate-100/80 text-xs sm:text-sm text-navy-800 max-w-lg">
                              <span className="font-semibold text-navy-900">Patient: </span>
                              &ldquo;What was my fasting glucose in my last metabolic test and has it changed?&rdquo;
                            </div>

                            <div className="p-4 rounded-xl bg-health-50/80 border border-health-100 text-xs sm:text-sm text-navy-900 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-health-800">
                                <Sparkles className="w-3.5 h-3.5 text-health-600" />
                                <span>HealthSync Assistant:</span>
                              </div>
                              <p className="leading-relaxed">
                                Your Fasting Plasma Glucose was <strong>92 mg/dL</strong> on November 14, 2026. This is within the normal reference range of 70–99 mg/dL and represents a healthy 4 mg/dL decrease compared to your July 2026 panel (96 mg/dL).
                              </p>
                              <div className="pt-2 flex items-center gap-2 text-[11px] text-navy-500 border-t border-health-100/60">
                                <span className="font-semibold text-navy-700">Source:</span>
                                <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-navy-700 font-mono text-[10px]">
                                  CMP_Report_Nov2026.pdf (Page 1)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THE HEALTHCARE REALITY */}
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs font-bold text-health-600 uppercase tracking-wider">
                The Healthcare Reality
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-950 mt-2 tracking-tight">
                Why personal medical history is fragmented today
              </h2>
              <p className="mt-3 text-sm sm:text-base text-navy-600">
                Patients visit multiple clinics and diagnostic laboratories, accumulating paper slips that are impossible to search when urgent medical care is needed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">Paper Records Get Lost</h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Prescriptions fade in drawers, laboratory slips are misplaced between moves, and discharge summaries are missing during critical specialist appointments.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-4">
                  <Eye className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">Doctor Handwriting is Illegible</h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Rapid clinical doctor notes, drug dosages, and abbreviations are difficult for patients to decipher, leading to missed doses and medication scheduling errors.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
                <div className="w-12 h-12 rounded-xl bg-health-100 text-health-700 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">Invisible Biomarker Trends</h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Blood tests across different diagnostic providers cannot be plotted longitudinally, obscuring early indicators in cholesterol, HbA1c, or kidney function.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CORE CAPABILITIES - ACETERNITY BENTO GRID */}
        <section id="features" className="py-20 md:py-28 bg-white border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-bold text-health-600 uppercase tracking-wider">
                Comprehensive Capabilities
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-950 mt-2 tracking-tight">
                Engineered for clinical clarity & patient peace of mind
              </h2>
              <p className="mt-3 text-sm sm:text-base text-navy-600">
                Explore how multimodal vision, calibrated confidence, and cryptographic isolation transform your personal health records.
              </p>
            </div>

            <BentoGrid className="max-w-7xl mx-auto md:auto-rows-[20rem]">
              {/* Bento 1: Multimodal OCR & Vision (col-span-2) */}
              <BentoGridItem
                className="md:col-span-2 bg-gradient-to-br from-white via-health-50/40 to-slate-50 border border-slate-200/90 shadow-card hover:shadow-card-hover"
                title="Dual-Engine OCR & Gemini Multimodal Vision"
                description="Combines digital PDF parsing (PyMuPDF), local OCR (Tesseract 5.4.0), and Google Gemini Vision to decipher cursive physician scripts with calibrated confidence scores."
                header={
                  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-health-100/60 via-teal-50/50 to-white p-4 border border-health-100 flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-health-600 text-white shadow-2xs">
                          PyMuPDF
                        </span>
                        <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-teal-600 text-white shadow-2xs">
                          Tesseract 5.4
                        </span>
                        <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-navy-900 text-white shadow-2xs">
                          Gemini 2.0 Flash
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-teal-700 bg-teal-100/80 px-2.5 py-0.5 rounded-full border border-teal-200">
                        99.2% Calibrated Accuracy
                      </span>
                    </div>
                    <div className="mt-3 p-3 bg-white/90 rounded-xl border border-health-100 shadow-2xs flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-navy-950">Rx_Amoxicillin_500mg.pdf</p>
                        <p className="text-[11px] text-navy-500">Extracted: Amoxicillin 500mg capsule • 3x daily • 10 days</p>
                      </div>
                      <span className="px-2 py-1 text-[10px] font-bold uppercase rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Zero Uncertain Fields
                      </span>
                    </div>
                  </div>
                }
                icon={<FileCheck className="w-5 h-5 text-health-600" />}
              />

              {/* Bento 2: Chronological Timeline (col-span-1) */}
              <BentoGridItem
                className="md:col-span-1 bg-white border border-slate-200/90 shadow-card hover:shadow-card-hover"
                title="Unified Health Timeline"
                description="Aggregates prescriptions, blood panels, scans, and doctor visits into an interactive, chronological narrative."
                header={
                  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/80 flex-col justify-center space-y-2.5 overflow-hidden">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-health-500 shrink-0" />
                      <span className="font-bold text-navy-900">Nov 14:</span>
                      <span className="text-navy-600 truncate">Metabolic Panel (Quest)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                      <span className="font-bold text-navy-900">Nov 10:</span>
                      <span className="text-navy-600 truncate">Amoxicillin Prescription</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                      <span className="font-bold text-navy-900">Oct 05:</span>
                      <span className="text-navy-600 truncate">Annual Wellness Visit</span>
                    </div>
                  </div>
                }
                icon={<Clock className="w-5 h-5 text-teal-600" />}
              />

              {/* Bento 3: Medication Schedules (col-span-1) */}
              <BentoGridItem
                className="md:col-span-1 bg-white border border-slate-200/90 shadow-card hover:shadow-card-hover"
                title="Medication Reminders"
                description="Generates daily medication administration schedules with one-tap compliance adherence tracking."
                header={
                  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-purple-50/50 p-3.5 border border-purple-100 flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-950">Lisinopril 10mg</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Daily</span>
                    </div>
                    <div className="flex items-center gap-1.5 py-1 text-xs text-purple-900 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-purple-600" />
                      <span>Next Dose: 8:00 PM</span>
                    </div>
                    <div className="w-full bg-purple-200/80 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full w-[94%]" />
                    </div>
                  </div>
                }
                icon={<Pill className="w-5 h-5 text-purple-600" />}
              />

              {/* Bento 4: Longitudinal Lab Analytics (col-span-2) */}
              <BentoGridItem
                className="md:col-span-2 bg-gradient-to-br from-white via-teal-50/30 to-slate-50 border border-slate-200/90 shadow-card hover:shadow-card-hover"
                title="Longitudinal Biomarker Analytics"
                description="Standardizes lab test names and reference intervals across diagnostic providers, highlighting trends in glucose, cholesterol, and kidney markers."
                header={
                  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/80 flex-col justify-between overflow-hidden">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                        <p className="text-[10px] text-navy-500 font-bold uppercase">Glucose</p>
                        <p className="text-sm font-extrabold text-navy-950">92 mg/dL</p>
                        <span className="text-[10px] text-emerald-700 font-bold">NORMAL</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                        <p className="text-[10px] text-navy-500 font-bold uppercase">HbA1c</p>
                        <p className="text-sm font-extrabold text-navy-950">5.5 %</p>
                        <span className="text-[10px] text-emerald-700 font-bold">OPTIMAL</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                        <p className="text-[10px] text-navy-500 font-bold uppercase">Cholesterol</p>
                        <p className="text-sm font-extrabold text-navy-950">188 mg/dL</p>
                        <span className="text-[10px] text-emerald-700 font-bold">IMPROVED</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-teal-800 font-semibold px-1 pt-1">
                      <span>Longitudinal Span: May 2026 – Nov 2026</span>
                      <span>13 Biomarkers Indexed</span>
                    </div>
                  </div>
                }
                icon={<BarChart3 className="w-5 h-5 text-amber-600" />}
              />

              {/* Bento 5: Emergency QR Access (col-span-1) */}
              <BentoGridItem
                className="md:col-span-1 bg-white border border-slate-200/90 shadow-card hover:shadow-card-hover"
                title="Emergency QR Medical Card"
                description="Provides offline first-responders with instant access to blood type, severe allergies, and ICE contacts without authentication."
                header={
                  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-rose-50/50 p-3.5 border border-rose-100 flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-950">Blood Group: O+</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">ICE Ready</span>
                    </div>
                    <p className="text-[11px] text-rose-900 font-medium">
                      Allergies: Penicillin, Sulfa
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-rose-700 font-semibold">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Scan via Phone Camera (Revocable)</span>
                    </div>
                  </div>
                }
                icon={<QrCode className="w-5 h-5 text-rose-600" />}
              />

              {/* Bento 6: Patient-Isolated RAG Assistant (col-span-2) */}
              <BentoGridItem
                className="md:col-span-2 bg-gradient-to-br from-white via-purple-50/30 to-slate-50 border border-slate-200/90 shadow-card hover:shadow-card-hover"
                title="Tenant-Isolated RAG Clinical Assistant"
                description="Ask natural-language questions across your clinical records. Retrieves exact text with strict PDF page citations and fail-closed tenant isolation."
                header={
                  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/80 flex-col justify-between overflow-hidden">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-xs text-navy-800">
                      <span className="font-bold text-purple-700">Q: </span>
                      &ldquo;When was my Lisinopril dosage changed?&rdquo;
                    </div>
                    <div className="p-2 bg-purple-50/70 rounded-lg border border-purple-100 text-xs text-navy-900 flex items-center justify-between">
                      <span>&ldquo;Dr. Chen adjusted it from 5mg to 10mg on May 15, 2026.&rdquo;</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white text-purple-700 border border-purple-200 shrink-0 ml-2">
                        Rx_Lisinopril.pdf (P.1)
                      </span>
                    </div>
                  </div>
                }
                icon={<Bot className="w-5 h-5 text-purple-600" />}
              />
            </BentoGrid>
          </div>
        </section>

        {/* CLINICIAN & PATIENT TESTIMONIALS */}
        <section className="py-20 md:py-24 bg-slate-50 border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs font-bold text-health-600 uppercase tracking-wider">
                Clinical Endorsements & Patient Stories
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-950 mt-2 tracking-tight">
                Trusted by doctors, caregivers, and patients
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-navy-700 leading-relaxed italic">
                    &ldquo;During emergency intake or second opinion consultations, patients often arrive with chaotic folders. HealthSync AI gives me a clean, structured longitudinal medication summary in under 30 seconds.&rdquo;
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-health-100 text-health-700 font-bold flex items-center justify-center text-xs">
                    RC
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-950">Dr. Robert Chen, MD</h4>
                    <p className="text-xs text-navy-500">Chief of Internal Medicine, Metro Health</p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-navy-700 leading-relaxed italic">
                    &ldquo;Managing medical records for my 78-year-old mother used to be overwhelming. Having her blood pressure, diabetic lab trends, and active prescriptions indexed in one place is life-changing.&rdquo;
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 font-bold flex items-center justify-center text-xs">
                    SM
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-950">Sarah Miller</h4>
                    <p className="text-xs text-navy-500">Caregiver & Family Health Coordinator</p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-navy-700 leading-relaxed italic">
                    &ldquo;The Emergency QR Card gave me immense peace of mind when traveling. Having my severe penicillin allergy and emergency contacts accessible without unlocking my phone is invaluable.&rdquo;
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
                    DK
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-950">David K.</h4>
                    <p className="text-xs text-navy-500">Chronic Care Patient</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECURITY & PRIVACY */}
        <section id="security" className="py-20 md:py-28 bg-navy-950 text-white relative overflow-hidden">
          <BackgroundBeams className="opacity-35 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-3xl mb-14">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                Cryptographic Privacy By Design
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 tracking-tight">
                Your medical data belongs to you. Period.
              </h2>
              <p className="text-navy-300 mt-4 text-base leading-relaxed">
                HealthSync AI enforces defense-in-depth isolation at both the application API layer and PostgreSQL database engine.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-xl bg-navy-900/90 border border-navy-800">
                <ShieldCheck className="w-8 h-8 text-teal-400 mb-4" />
                <h4 className="font-bold text-white mb-2">Row-Level Security</h4>
                <p className="text-xs text-navy-300 leading-relaxed">
                  PostgreSQL RLS ensures that queries strictly isolate data to the owning user UUID. No cross-tenant data leaks.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-navy-900/90 border border-navy-800">
                <Lock className="w-8 h-8 text-health-400 mb-4" />
                <h4 className="font-bold text-white mb-2">Private Storage</h4>
                <p className="text-xs text-navy-300 leading-relaxed">
                  Original medical files are stored in private cloud buckets. Downloads require authenticated, short-lived signed URLs.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-navy-900/90 border border-navy-800">
                <FileText className="w-8 h-8 text-amber-400 mb-4" />
                <h4 className="font-bold text-white mb-2">Audit Immutability</h4>
                <p className="text-xs text-navy-300 leading-relaxed">
                  Every upload, retrieval, and sharing action is logged in an append-only audit trail with zero PHI or passwords stored.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-navy-900/90 border border-navy-800">
                <Sparkles className="w-8 h-8 text-purple-400 mb-4" />
                <h4 className="font-bold text-white mb-2">Zero Hallucinations</h4>
                <p className="text-xs text-navy-300 leading-relaxed">
                  The AI extraction strictly outputs null for missing or unreadable clinical data rather than fabricating medical values.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS (FAQ) */}
        <section className="py-20 md:py-24 bg-white border-t border-slate-200/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-xs font-bold text-health-600 uppercase tracking-wider">
                Got Questions?
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-950 mt-2 tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = faqOpen === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full flex items-center justify-between p-5 text-left font-bold text-navy-900 hover:text-health-600 cursor-pointer transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span className="text-base sm:text-lg pr-4">{faq.question}</span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-health-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-navy-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 text-sm text-navy-600 leading-relaxed border-t border-slate-200/60 bg-white">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="py-16 md:py-20 bg-gradient-to-r from-health-600 via-teal-600 to-health-700 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to take control of your medical history?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-health-100 max-w-xl mx-auto">
              Join patients digitizing their prescriptions and diagnostic records with clinical accuracy and bank-grade privacy.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-health-700 bg-white hover:bg-slate-100 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer transition-all"
              >
                Create Free Account
              </Link>
              <button
                onClick={loginDemo}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-health-700/60 hover:bg-health-700 border border-white/30 rounded-xl hover:-translate-y-0.5 cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>Explore Instant Demo</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
