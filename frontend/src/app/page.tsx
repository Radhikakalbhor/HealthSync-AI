'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  FileText,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Upload,
  Pill,
  BarChart3,
  Bot,
  Lock,
  CheckCircle2,
  Activity,
  HeartPulse,
  QrCode,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Stethoscope,
  Database,
  Share2,
  Zap,
  Search,
  Clock,
  FolderLock,
  Calendar,
  Layers,
  Play,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';

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
        'HealthSync AI enforces defense-in-depth isolation via PostgreSQL Row-Level Security (RLS). Every document, medication schedule, and extracted analyte is cryptographically isolated to your authenticated account UUID. Private cloud storage buckets use short-lived, authenticated signed URLs. Your health data is never shared or used to train public LLMs.',
    },
    {
      question: 'Does HealthSync AI diagnose medical conditions or prescribe drugs?',
      answer:
        'No. HealthSync AI is strictly a personal medical record management, OCR extraction, and document organization platform. It NEVER diagnoses illnesses or provides medical advice. All extracted values highlight low-confidence items for patient review.',
    },
    {
      question: 'How does Emergency QR Sharing work if I am offline?',
      answer:
        'You can generate a secure, tokenized Emergency Medical Profile. Emergency paramedics or ER doctors can scan your QR code to instantly inspect critical data: blood type, severe allergies, active prescriptions, and emergency contacts without requiring a login.',
    },
    {
      question: 'What types of medical files can I upload?',
      answer:
        'You can upload digital PDF files, smartphone photos, and scanned records (JPEG, PNG). HealthSync AI uses digital text extraction and OCR combined with Google Gemini Vision for handwritten clinical prescriptions.',
    },
    {
      question: 'Can I track biomarker trends across different diagnostic laboratories?',
      answer:
        'Yes. Whether your blood tests come from Quest, LabCorp, or hospital clinics, HealthSync AI normalizes test names, measurement units, and reference ranges into longitudinal trend charts (HbA1c, Fasting Glucose, Lipid Panels) with automated normal/high/critical status flags.',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#EAF4F8] selection:bg-[#13B8AE]/30 selection:text-[#071D2B]">
      <main className="flex-1">
        {/* ========================================================= */}
        {/* 1. HERO SECTION: Matching Hero-poster.jpg Exactly        */}
        {/* ========================================================= */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#071D2B] via-[#0B3D4A] to-[#041824] text-white pb-16 md:pb-20 border-b border-[#0e3b48]">
          {/* Subtle medical cross symbols & grid background overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(54, 214, 232, 0.35) 1.5px, transparent 0)`,
              backgroundSize: '36px 36px',
            }}
          />

          {/* Glowing Ambient Cyan / Teal Light Orbs */}
          <div className="absolute top-10 right-1/4 w-[500px] h-[500px] rounded-full bg-[#13B8AE]/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 left-5 w-[400px] h-[400px] rounded-full bg-[#36D6E8]/15 blur-3xl pointer-events-none" />

          {/* Transparent seamless navbar */}
          <Navbar />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center">
              {/* Left Column (6 cols): Content & CTAs from Hero-poster.jpg */}
              <div className="lg:col-span-6 space-y-6 text-left z-10">
                {/* Main Headline from previous design */}
                <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-6xl font-black text-white tracking-tight leading-[1.08] font-display">
                  Your Health Records.
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#13B8AE] via-[#36D6E8] to-[#3289D8]">
                    Connected, Secure
                  </span>{' '}
                  & Always Accessible.
                </h1>

                {/* Subtitle from previous design */}
                <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-sans max-w-xl">
                  One intelligent platform to organize your prescriptions, laboratory reports and medical history. Access your health information whenever you need it.
                </p>

                {/* Action Buttons from previous design */}
                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <Link href="/register">
                    <button className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#13B8AE] to-[#36D6E8] hover:from-[#0da59c] hover:to-[#22b5c6] text-[#071D2B] font-black text-sm shadow-lg shadow-teal-500/25 transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-2">
                      Get Started Free
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </Link>

                  <button
                    onClick={loginDemo}
                    className="px-6 py-3.5 rounded-xl bg-[#0B3D4A] hover:bg-[#13B8AE]/20 text-[#36D6E8] border border-[#13B8AE]/40 font-bold text-sm transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4 fill-[#36D6E8] animate-cardiac-pulse" />
                    Explore Platform (Instant Demo)
                  </button>
                </div>

                {/* Trust Points from previous design */}
                <div className="pt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#13B8AE]" />
                    Zero-Hallucination OCR
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#13B8AE]" />
                    PostgreSQL Row-Level Security
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#13B8AE]" />
                    Offline Emergency QR Card
                  </span>
                </div>
              </div>

              {/* Right Column (6 cols): Doctor Graphic with Floating Cards and Synchronized ECG Waveform */}
              <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-end">
                <div className="relative w-full max-w-[620px] lg:scale-105 xl:scale-110 origin-center transition-transform duration-300">
                  {/* Concentric glowing cyan tech ring with synchronized heartbeat pulse */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#13B8AE]/25 via-[#36D6E8]/20 to-transparent blur-3xl pointer-events-none animate-heartbeat-glow" />

                  {/* Dedicated Animated ECG Waveform Ring behind floating cards */}
                  <div className="absolute inset-x-[-10%] top-[45%] h-20 pointer-events-none z-0 opacity-80 overflow-hidden">
                    <svg viewBox="0 0 700 80" preserveAspectRatio="none" className="w-full h-full fill-none">
                      <path
                        d="M 0 40 L 120 40 Q 135 32 150 40 L 165 40 L 175 46 L 190 8 L 205 60 L 215 40 L 235 40 Q 255 26 275 40 L 470 40 Q 485 32 500 40 L 515 40 L 525 46 L 540 8 L 555 60 L 565 40 L 585 40 Q 605 26 625 40 L 700 40"
                        stroke="#36D6E8"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="200 870"
                        className="animate-ecg-doctor animate-ecg-glow"
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="1070"
                          to="0"
                          dur="2.4s"
                          repeatCount="indefinite"
                        />
                      </path>
                    </svg>
                  </div>

                  {/* High Quality Doctor & Floating Medical Cards Graphic */}
                  <img
                    src="/hero-doctor-transparent.png"
                    alt="HealthSync AI - Digital Health Records Platform"
                    className="w-full h-auto object-contain drop-shadow-[0_12px_30px_rgba(7,29,43,0.85)] relative z-10 transition-transform duration-500 hover:scale-[1.03]"
                  />
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* POWERFUL FEATURES BAR: 6 Cards from Hero-poster.jpg       */}
            {/* ========================================================= */}
            <div className="mt-8 pt-4">
              {/* Glowing Continuous ECG Heartbeat Waveform Monitor Line directly above Powerful Features */}
              <div className="w-full h-16 sm:h-20 mb-4 relative overflow-hidden flex items-center justify-center">
                <svg viewBox="0 0 1400 80" preserveAspectRatio="none" className="w-full h-full fill-none">
                  <defs>
                    <linearGradient id="ecgFeatureGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#13B8AE" stopOpacity="0" />
                      <stop offset="25%" stopColor="#13B8AE" stopOpacity="0.4" />
                      <stop offset="50%" stopColor="#36D6E8" stopOpacity="0.8" />
                      <stop offset="85%" stopColor="#36D6E8" stopOpacity="1" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                    </linearGradient>
                    <filter id="ecgFeatureGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {/* Subtle static guide track */}
                  <path
                    d="M 0 40 L 100 40 Q 115 32 130 40 L 145 40 L 155 46 L 170 8 L 185 60 L 195 40 L 215 40 Q 235 26 255 40 L 450 40 Q 465 32 480 40 L 495 40 L 505 46 L 520 8 L 535 60 L 545 40 L 565 40 Q 585 26 605 40 L 800 40 Q 815 32 830 40 L 845 40 L 855 46 L 870 8 L 885 60 L 895 40 L 915 40 Q 935 26 955 40 L 1150 40 Q 1165 32 1180 40 L 1195 40 L 1205 46 L 1220 8 L 1235 60 L 1245 40 L 1265 40 Q 1285 26 1305 40 L 1400 40"
                    stroke="#13B8AE"
                    strokeWidth="1.5"
                    strokeOpacity="0.25"
                  />
                  {/* Continuous moving glowing pulse */}
                  <path
                    d="M 0 40 L 100 40 Q 115 32 130 40 L 145 40 L 155 46 L 170 8 L 185 60 L 195 40 L 215 40 Q 235 26 255 40 L 450 40 Q 465 32 480 40 L 495 40 L 505 46 L 520 8 L 535 60 L 545 40 L 565 40 Q 585 26 605 40 L 800 40 Q 815 32 830 40 L 845 40 L 855 46 L 870 8 L 885 60 L 895 40 L 915 40 Q 935 26 955 40 L 1150 40 Q 1165 32 1180 40 L 1195 40 L 1205 46 L 1220 8 L 1235 60 L 1245 40 L 1265 40 Q 1285 26 1305 40 L 1400 40"
                    stroke="url(#ecgFeatureGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#ecgFeatureGlow)"
                    strokeDasharray="260 1740"
                    className="animate-ecg-travel animate-ecg-glow"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="2000"
                      to="0"
                      dur="2.8s"
                      repeatCount="indefinite"
                    />
                  </path>
                </svg>
              </div>

              {/* Divider Heading */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-[1px] w-12 sm:w-28 bg-gradient-to-r from-transparent via-[#36D6E8]/60 to-[#13B8AE]" />
                <h2 className="text-xs sm:text-sm font-extrabold text-[#36D6E8] tracking-widest uppercase">
                  Powerful Features for Better Healthcare
                </h2>
                <div className="h-[1px] w-12 sm:w-28 bg-gradient-to-l from-transparent via-[#36D6E8]/60 to-[#13B8AE]" />
              </div>

              {/* 6 Feature Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
                {/* 1. Upload Documents */}
                <div className="p-4 rounded-2xl bg-[#0B3D4A]/60 border border-[#13B8AE]/30 hover:border-[#36D6E8] hover:bg-[#0B3D4A]/80 transition-all duration-200 text-center flex flex-col items-center justify-between group shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-[#13B8AE]/20 text-[#36D6E8] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Upload Documents</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 mt-1">Prescriptions • Reports</p>
                </div>

                {/* 2. OCR Extraction */}
                <div className="p-4 rounded-2xl bg-[#0B3D4A]/60 border border-[#13B8AE]/30 hover:border-[#36D6E8] hover:bg-[#0B3D4A]/80 transition-all duration-200 text-center flex flex-col items-center justify-between group shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-[#13B8AE]/20 text-[#36D6E8] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <FileSearch className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">OCR Extraction</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 mt-1">Smart Data Capture</p>
                </div>

                {/* 3. Organize Records */}
                <div className="p-4 rounded-2xl bg-[#0B3D4A]/60 border border-[#13B8AE]/30 hover:border-[#36D6E8] hover:bg-[#0B3D4A]/80 transition-all duration-200 text-center flex flex-col items-center justify-between group shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-[#13B8AE]/20 text-[#36D6E8] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Database className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Organize Records</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 mt-1">By Date & Category</p>
                </div>

                {/* 4. Search & Access */}
                <div className="p-4 rounded-2xl bg-[#0B3D4A]/60 border border-[#13B8AE]/30 hover:border-[#36D6E8] hover:bg-[#0B3D4A]/80 transition-all duration-200 text-center flex flex-col items-center justify-between group shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-[#13B8AE]/20 text-[#36D6E8] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Search className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Search & Access</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 mt-1">Find Records Easily</p>
                </div>

                {/* 5. Share Securely */}
                <div className="p-4 rounded-2xl bg-[#0B3D4A]/60 border border-[#13B8AE]/30 hover:border-[#36D6E8] hover:bg-[#0B3D4A]/80 transition-all duration-200 text-center flex flex-col items-center justify-between group shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-[#13B8AE]/20 text-[#36D6E8] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Share2 className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Share Securely</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 mt-1">With Your Doctor</p>
                </div>

                {/* 6. Track Medical History */}
                <div className="p-4 rounded-2xl bg-[#0B3D4A]/60 border border-[#13B8AE]/30 hover:border-[#36D6E8] hover:bg-[#0B3D4A]/80 transition-all duration-200 text-center flex flex-col items-center justify-between group shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-[#13B8AE]/20 text-[#36D6E8] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Clock className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Track History</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 mt-1">Chronological Timeline</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 2. OUR PLATFORM: Medical Innovation Overview             */}
        {/* ========================================================= */}
        <section id="platform" className="py-16 md:py-20 bg-[#EAF4F8] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-black text-[#13B8AE] uppercase tracking-widest">
                Our Platform
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#071D2B] mt-2 tracking-tight font-display">
                Engineered for Modern Clinical Document Intelligence
              </h2>
              <p className="mt-3 text-base text-slate-600 leading-relaxed font-sans">
                HealthSync AI bridges the gap between chaotic paper records and actionable medical insight using advanced OCR, calibrated confidence scoring, and strict patient data isolation.
              </p>
            </div>

            {/* Platform Feature Triad Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              <div className="p-7 rounded-3xl bg-white border border-[#d6e8f2] shadow-sm shadow-[#071D2B]/5 hover:shadow-xl hover:shadow-[#13B8AE]/10 hover:border-[#13B8AE] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="w-13 h-13 rounded-2xl bg-[#071D2B] text-[#36D6E8] flex items-center justify-center mb-5 shadow-md shadow-[#071D2B]/20">
                    <FileSearch className="w-6 h-6 stroke-[2]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#071D2B] font-display mb-2">Multimodal OCR & Vision</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Extracts structured clinical data from smartphone photos, lab PDFs, and doctor consultation notes with calibrated confidence scoring.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-[#13B8AE]">
                  <span>Dual-Engine Processing</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="p-7 rounded-3xl bg-white border border-[#d6e8f2] shadow-sm shadow-[#071D2B]/5 hover:shadow-xl hover:shadow-[#13B8AE]/10 hover:border-[#13B8AE] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="w-13 h-13 rounded-2xl bg-[#0B3D4A] text-[#13B8AE] flex items-center justify-center mb-5 shadow-md shadow-[#0B3D4A]/20">
                    <BarChart3 className="w-6 h-6 stroke-[2]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#071D2B] font-display mb-2">Biomarker Longitudinal Trends</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Charts biomarker history over time (Glucose, HbA1c, Cholesterol, Liver Enzymes) across multiple labs and consultation visits.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-[#13B8AE]">
                  <span>Automated Range Flagging</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="p-7 rounded-3xl bg-white border border-[#d6e8f2] shadow-sm shadow-[#071D2B]/5 hover:shadow-xl hover:shadow-[#13B8AE]/10 hover:border-[#13B8AE] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="w-13 h-13 rounded-2xl bg-[#071D2B] text-rose-400 flex items-center justify-center mb-5 shadow-md shadow-[#071D2B]/20">
                    <ShieldCheck className="w-6 h-6 stroke-[2]" />
                  </div>
                  <h3 className="text-lg font-bold text-[#071D2B] font-display mb-2">Defense-in-Depth Vault</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    PostgreSQL Row-Level Security ensures that each patient record is cryptographically isolated to that specific patient UUID.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-[#13B8AE]">
                  <span>Cryptographic Isolation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. CORE CAPABILITIES: Interactive Showcase Grid          */}
        {/* ========================================================= */}
        <section id="features" className="py-16 md:py-20 bg-white border-y border-[#d6e8f2] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-black text-[#13B8AE] uppercase tracking-widest">
                Core Capabilities
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#071D2B] mt-2 tracking-tight font-display">
                Everything You Need In One Personal Vault
              </h2>
              <p className="mt-3 text-base text-slate-600 leading-relaxed">
                Click any category below to preview how clinical documents are organized and analyzed.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Selector Tabs (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('prescription')}
                  className={`p-4 rounded-2xl text-left border transition-all duration-200 cursor-pointer ${
                    activeTab === 'prescription'
                      ? 'bg-[#071D2B] text-white border-[#13B8AE] shadow-lg shadow-[#071D2B]/15 ring-1 ring-[#13B8AE]/40'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-[#d6e8f2] hover:border-[#13B8AE]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'prescription' ? 'bg-[#13B8AE] text-[#071D2B]' : 'bg-blue-50 text-[#3289D8]'}`}>
                      <Pill className="w-5 h-5" />
                    </div>
                    <div>
                      <h3
                        style={{ color: activeTab === 'prescription' ? '#ffffff' : '#071D2B' }}
                        className="font-bold text-sm font-display"
                      >
                        Prescription Management
                      </h3>
                      <p
                        style={{ color: activeTab === 'prescription' ? '#94a3b8' : '#64748b' }}
                        className="text-xs mt-0.5"
                      >
                        Medication tracking, dosages & schedule
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('labs')}
                  className={`p-4 rounded-2xl text-left border transition-all duration-200 cursor-pointer ${
                    activeTab === 'labs'
                      ? 'bg-[#071D2B] text-white border-[#13B8AE] shadow-lg shadow-[#071D2B]/15 ring-1 ring-[#13B8AE]/40'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-[#d6e8f2] hover:border-[#13B8AE]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'labs' ? 'bg-[#13B8AE] text-[#071D2B]' : 'bg-purple-50 text-purple-700'}`}>
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3
                        style={{ color: activeTab === 'labs' ? '#ffffff' : '#071D2B' }}
                        className="font-bold text-sm font-display"
                      >
                        Diagnostic Lab Reports
                      </h3>
                      <p
                        style={{ color: activeTab === 'labs' ? '#94a3b8' : '#64748b' }}
                        className="text-xs mt-0.5"
                      >
                        Analyte ranges & longitudinal flags
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('emergency')}
                  className={`p-4 rounded-2xl text-left border transition-all duration-200 cursor-pointer ${
                    activeTab === 'emergency'
                      ? 'bg-[#071D2B] text-white border-[#13B8AE] shadow-lg shadow-[#071D2B]/15 ring-1 ring-[#13B8AE]/40'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-[#d6e8f2] hover:border-[#13B8AE]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'emergency' ? 'bg-[#13B8AE] text-[#071D2B]' : 'bg-rose-50 text-rose-600'}`}>
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h3
                        style={{ color: activeTab === 'emergency' ? '#ffffff' : '#071D2B' }}
                        className="font-bold text-sm font-display"
                      >
                        Emergency Health Card & QR
                      </h3>
                      <p
                        style={{ color: activeTab === 'emergency' ? '#94a3b8' : '#64748b' }}
                        className="text-xs mt-0.5"
                      >
                        Instant access for paramedics & ER
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('assistant')}
                  className={`p-4 rounded-2xl text-left border transition-all duration-200 cursor-pointer ${
                    activeTab === 'assistant'
                      ? 'bg-[#071D2B] text-white border-[#13B8AE] shadow-lg shadow-[#071D2B]/15 ring-1 ring-[#13B8AE]/40'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-[#d6e8f2] hover:border-[#13B8AE]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'assistant' ? 'bg-[#13B8AE] text-[#071D2B]' : 'bg-teal-50 text-[#13B8AE]'}`}>
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3
                        style={{ color: activeTab === 'assistant' ? '#ffffff' : '#071D2B' }}
                        className="font-bold text-sm font-display"
                      >
                        Patient-Isolated Assistant
                      </h3>
                      <p
                        style={{ color: activeTab === 'assistant' ? '#94a3b8' : '#64748b' }}
                        className="text-xs mt-0.5"
                      >
                        Ask natural questions with direct citations
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Right Display Card (8 cols) - Guaranteed high contrast on all text */}
              <div className="lg:col-span-8 bg-[#EAF4F8] rounded-3xl p-6 sm:p-8 border border-[#d6e8f2] shadow-sm transition-all duration-300">
                {activeTab === 'prescription' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#d6e8f2] gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#3289D8] flex items-center justify-center font-bold">
                          <Pill className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 style={{ color: '#071D2B' }} className="font-bold text-base">
                            Amoxicillin 500mg Prescription
                          </h4>
                          <p style={{ color: '#64748b' }} className="text-xs">
                            Dr. Sarah Jenkins • Verified Oct 28, 2026
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-[#13B8AE] border border-teal-200">
                        98% Match
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl bg-white border border-[#d6e8f2]">
                        <span style={{ color: '#64748b' }} className="text-[10px] font-bold uppercase tracking-wider block">Medication</span>
                        <h5 style={{ color: '#071D2B' }} className="font-bold text-base mt-1">Amoxicillin</h5>
                        <p style={{ color: '#64748b' }} className="text-xs mt-0.5">500 mg • Oral Capsule</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-[#d6e8f2]">
                        <span style={{ color: '#64748b' }} className="text-[10px] font-bold uppercase tracking-wider block">Schedule</span>
                        <h5 style={{ color: '#071D2B' }} className="font-bold text-base mt-1">3x Daily</h5>
                        <p style={{ color: '#64748b' }} className="text-xs mt-0.5">Every 8h with water</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-[#d6e8f2]">
                        <span style={{ color: '#64748b' }} className="text-[10px] font-bold uppercase tracking-wider block">Adherence</span>
                        <h5 className="font-bold text-emerald-700 text-base mt-1">94% Logged</h5>
                        <p style={{ color: '#64748b' }} className="text-xs mt-0.5">28 / 30 doses taken</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'labs' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#d6e8f2] gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 style={{ color: '#071D2B' }} className="font-bold text-base">
                            Comprehensive Metabolic Panel (CMP)
                          </h4>
                          <p style={{ color: '#64748b' }} className="text-xs">
                            Quest Diagnostics • Extracted automatically
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        1 Abnormal Value
                      </span>
                    </div>

                    <div className="overflow-x-auto bg-white rounded-2xl border border-[#d6e8f2]">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-slate-50 border-b border-[#d6e8f2]">
                          <tr>
                            <th style={{ color: '#071D2B' }} className="p-3 font-bold">Analyte</th>
                            <th style={{ color: '#071D2B' }} className="p-3 font-bold">Observed</th>
                            <th style={{ color: '#071D2B' }} className="p-3 font-bold">Ref Range</th>
                            <th style={{ color: '#071D2B' }} className="p-3 font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          <tr>
                            <td style={{ color: '#071D2B' }} className="p-3 font-bold">Fasting Glucose</td>
                            <td style={{ color: '#071D2B' }} className="p-3 font-mono font-bold">92 mg/dL</td>
                            <td style={{ color: '#64748b' }} className="p-3 font-mono">70 - 99 mg/dL</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">NORMAL</span></td>
                          </tr>
                          <tr>
                            <td style={{ color: '#071D2B' }} className="p-3 font-bold">HbA1c</td>
                            <td style={{ color: '#071D2B' }} className="p-3 font-mono font-bold">5.5 %</td>
                            <td style={{ color: '#64748b' }} className="p-3 font-mono">&lt; 5.7 %</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">OPTIMAL</span></td>
                          </tr>
                          <tr>
                            <td style={{ color: '#071D2B' }} className="p-3 font-bold">Total Cholesterol</td>
                            <td className="p-3 font-mono font-bold text-amber-900">208 mg/dL</td>
                            <td style={{ color: '#64748b' }} className="p-3 font-mono">&lt; 200 mg/dL</td>
                            <td className="p-3"><span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">HIGH</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'emergency' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#d6e8f2] gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 style={{ color: '#071D2B' }} className="font-bold text-base">
                            Emergency Health Card
                          </h4>
                          <p style={{ color: '#64748b' }} className="text-xs">
                            Offline emergency QR code token
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Token Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl bg-white border border-[#d6e8f2]">
                        <span style={{ color: '#64748b' }} className="text-[10px] font-bold uppercase tracking-wider block">Blood Type</span>
                        <h5 style={{ color: '#071D2B' }} className="font-black text-xl mt-1 font-mono">O Positive (O+)</h5>
                        <p style={{ color: '#64748b' }} className="text-xs mt-0.5">Universal Red Cells</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-[#d6e8f2]">
                        <span style={{ color: '#64748b' }} className="text-[10px] font-bold uppercase tracking-wider block">Critical Allergies</span>
                        <h5 className="font-bold text-rose-700 text-base mt-1">Penicillin, Sulfa</h5>
                        <p style={{ color: '#64748b' }} className="text-xs mt-0.5">Anaphylaxis risk</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-[#d6e8f2]">
                        <span style={{ color: '#64748b' }} className="text-[10px] font-bold uppercase tracking-wider block">Emergency Contact</span>
                        <h5 style={{ color: '#071D2B' }} className="font-bold text-base mt-1">Emma Morgan</h5>
                        <p style={{ color: '#64748b' }} className="text-xs mt-0.5 font-mono">+1 (555) 019-2831</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'assistant' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-white border border-[#d6e8f2]">
                      <span className="text-[11px] font-bold text-[#13B8AE] uppercase tracking-wider block">Patient Query</span>
                      <p style={{ color: '#071D2B' }} className="font-bold text-sm mt-1">
                        &quot;What was my fasting glucose level in my latest lab test?&quot;
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-teal-300 shadow-xs">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-[#13B8AE]" />
                        <span style={{ color: '#0B3D4A' }} className="text-xs font-bold uppercase tracking-wide">
                          HealthSync AI Clinical Assistant
                        </span>
                      </div>
                      <p style={{ color: '#071D2B' }} className="text-sm leading-relaxed">
                        Your fasting glucose was <strong className="text-emerald-700">92 mg/dL</strong> according to your Comprehensive Metabolic Panel performed on November 15, 2026. This is within the standard reference range of 70 - 99 mg/dL.
                      </p>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs" style={{ color: '#64748b' }}>
                        <FileText className="w-3.5 h-3.5 text-[#13B8AE]" />
                        <span>Source: Synthetic_Lab_Report_CMP.pdf (Page 1)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. HOW IT WORKS: Step-by-Step Clinical Ingestion Flow    */}
        {/* ========================================================= */}
        <section id="workflow" className="py-16 md:py-20 bg-[#EAF4F8]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-black text-[#13B8AE] uppercase tracking-widest">
                Workflow
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#071D2B] mt-2 tracking-tight font-display">
                How HealthSync AI Works
              </h2>
              <p className="mt-3 text-base text-slate-600 leading-relaxed font-sans">
                A streamlined four-step workflow from messy medical documents to structured, queryable clinical intelligence.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {/* Step 1 */}
              <div className="p-6 rounded-3xl bg-white border border-[#d6e8f2] shadow-sm hover:shadow-md hover:border-[#13B8AE] transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#071D2B] text-[#36D6E8] flex items-center justify-center font-black text-base shadow-sm">
                      1
                    </div>
                    <span className="text-[11px] font-bold text-[#13B8AE] uppercase tracking-wider">Step 01</span>
                  </div>
                  <h3 className="text-base font-bold text-[#071D2B] font-display">Upload Document</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Upload paper prescriptions, photos, or digital diagnostic lab PDFs securely.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-3xl bg-white border border-[#d6e8f2] shadow-sm hover:shadow-md hover:border-[#13B8AE] transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#0B3D4A] text-[#13B8AE] flex items-center justify-center font-black text-base shadow-sm">
                      2
                    </div>
                    <span className="text-[11px] font-bold text-[#13B8AE] uppercase tracking-wider">Step 02</span>
                  </div>
                  <h3 className="text-base font-bold text-[#071D2B] font-display">Extract & Classify</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    OCR and Multimodal AI parse clinical entities, dosages, and reference values.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-3xl bg-white border border-[#d6e8f2] shadow-sm hover:shadow-md hover:border-[#13B8AE] transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#071D2B] text-[#3289D8] flex items-center justify-center font-black text-base shadow-sm">
                      3
                    </div>
                    <span className="text-[11px] font-bold text-[#13B8AE] uppercase tracking-wider">Step 03</span>
                  </div>
                  <h3 className="text-base font-bold text-[#071D2B] font-display">Verify & Review</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Calibrated confidence scoring flags low-confidence fields for one-click verification.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-6 rounded-3xl bg-white border border-[#d6e8f2] shadow-sm hover:shadow-md hover:border-[#13B8AE] transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#0B3D4A] text-emerald-400 flex items-center justify-center font-black text-base shadow-sm">
                      4
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Step 04</span>
                  </div>
                  <h3 className="text-base font-bold text-[#071D2B] font-display">Access & Trends</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Explore chronological timelines, longitudinal charts, and emergency QR cards.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 5. SECURITY & PRIVACY: Defense-In-Depth Architecture     */}
        {/* ========================================================= */}
        <section id="security" className="py-16 md:py-20 bg-[#071D2B] text-white border-t border-[#0e3b48] relative overflow-hidden">
          {/* Subtle teal ambient lighting glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#13B8AE]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-black text-[#13B8AE] uppercase tracking-widest">
                Security & Defense-In-Depth
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 tracking-tight font-display">
                Your Health Data Is Strictly Isolated
              </h2>
              <p className="mt-3 text-base text-slate-300 leading-relaxed font-sans">
                Enterprise security controls ensuring private patient data is never co-mingled or used to train public AI models.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <div className="p-7 rounded-2xl bg-[#0B3D4A]/60 border border-[#0e3b48] hover:border-[#13B8AE]/50 transition-all duration-300">
                <ShieldCheck className="w-8 h-8 text-[#13B8AE] mb-4" />
                <h4 className="font-bold text-white text-base mb-2">Row-Level Security (RLS)</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every SQL transaction applies PostgreSQL RLS policies ensuring tenant isolation.
                </p>
              </div>

              <div className="p-7 rounded-2xl bg-[#0B3D4A]/60 border border-[#0e3b48] hover:border-[#13B8AE]/50 transition-all duration-300">
                <Lock className="w-8 h-8 text-[#36D6E8] mb-4" />
                <h4 className="font-bold text-white text-base mb-2">Private Signed Access</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Medical documents are saved in private buckets accessible only via authenticated time-limited signed URLs.
                </p>
              </div>

              <div className="p-7 rounded-2xl bg-[#0B3D4A]/60 border border-[#0e3b48] hover:border-[#13B8AE]/50 transition-all duration-300">
                <Activity className="w-8 h-8 text-rose-400 mb-4" />
                <h4 className="font-bold text-white text-base mb-2">Immutable Audit History</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every access and document verification creates an append-only audit record without storing raw PHI.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 6. CALL TO ACTION SECTION                                */}
        {/* ========================================================= */}
        <section className="py-16 md:py-20 bg-gradient-to-r from-[#071D2B] via-[#0B3D4A] to-[#071D2B] text-white text-center border-t border-[#0e3b48] relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#13B8AE_1px,transparent_1px)] [background-size:24px_24px]" />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight font-display">
              Ready to organize your complete medical history?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-xl mx-auto">
              Join thousands of patients digitizing their prescriptions and diagnostic records with clinical accuracy.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/register">
                <button className="px-8 py-3.5 rounded-full bg-gradient-to-r from-[#13B8AE] via-[#36D6E8] to-[#13B8AE] hover:from-[#0da59c] hover:to-[#22b5c6] text-[#071D2B] font-black text-sm shadow-xl shadow-teal-500/25 transition-all hover:-translate-y-0.5 cursor-pointer">
                  Create Free Account
                </button>
              </Link>
              <button
                onClick={loginDemo}
                className="px-8 py-3.5 rounded-full bg-[#0B3D4A] hover:bg-[#13B8AE]/20 text-[#36D6E8] border border-[#13B8AE]/40 font-bold text-sm transition-all hover:-translate-y-0.5 hover:border-[#13B8AE]/70 cursor-pointer"
              >
                Launch Instant Demo
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 7. FREQUENTLY ASKED QUESTIONS                            */}
        {/* ========================================================= */}
        <section id="faq" className="py-16 md:py-20 bg-white border-t border-[#d6e8f2]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-xs font-black text-[#13B8AE] uppercase tracking-widest">
                Support & Details
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#071D2B] mt-2 tracking-tight font-display">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = faqOpen === index;
                return (
                  <div
                    key={index}
                    className={`rounded-2xl border bg-white shadow-xs overflow-hidden transition-all duration-200 ${
                      isOpen ? 'border-[#13B8AE] ring-1 ring-[#13B8AE]/30' : 'border-[#d6e8f2] hover:border-[#13B8AE]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="group w-full flex items-center justify-between p-5 text-left cursor-pointer transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span
                        style={{ color: '#071D2B' }}
                        className="text-base sm:text-lg font-extrabold text-[#071D2B] text-slate-900 group-hover:text-[#13B8AE] pr-4 block transition-colors"
                      >
                        {faq.question}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-[#13B8AE] shrink-0 transition-transform" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#0B3D4A] group-hover:text-[#13B8AE] shrink-0 transition-colors" />
                      )}
                    </button>
                    {isOpen && (
                      <div
                        style={{ color: '#0f172a' }}
                        className="px-5 pb-5 pt-2 text-sm text-slate-900 leading-relaxed border-t border-[#d6e8f2] bg-[#EAF4F8]/60 font-medium"
                      >
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
