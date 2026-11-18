'use client';

import React from 'react';
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
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/auth-context';

export default function LandingPage() {
  const { user, loginDemo } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 bg-gradient-to-b from-health-50/60 via-white to-slate-50">
          <div className="absolute inset-0 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-health-100/80 border border-health-200 text-health-800 text-xs font-semibold mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-health-600" />
              <span>Next-Gen Personal Health Document Assistant</span>
              <span className="w-1.5 h-1.5 rounded-full bg-health-500 animate-pulse" />
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl font-extrabold text-navy-950 tracking-tight max-w-4xl mx-auto leading-[1.15]">
              Your Health.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-health-600 to-teal-500">
                Connected. Intelligent.
              </span>{' '}
              Organized.
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-lg sm:text-xl text-navy-600 max-w-2xl mx-auto leading-relaxed">
              Eliminate the chaos of scattered paper prescriptions, cryptic lab reports, and fragmented clinic visits. HealthSync AI structures your complete medical history into an intelligent, chronological timeline with calibrated OCR and multimodal vision.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              {user ? (
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold text-white bg-health-600 hover:bg-health-700 rounded-xl shadow-lg shadow-health-600/25 hover:shadow-health-600/40 transition-all"
                >
                  Open Patient Dashboard
                  <ArrowRight className="w-5 h-5" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold text-white bg-health-600 hover:bg-health-700 rounded-xl shadow-lg shadow-health-600/25 hover:shadow-health-600/40 transition-all"
                  >
                    Get Started Free
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={loginDemo}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-navy-700 bg-white hover:bg-navy-50 border border-navy-200 rounded-xl shadow-sm hover:shadow transition-all"
                  >
                    <span>⚡ Try Live Demo</span>
                  </button>
                </>
              )}
            </div>

            {/* Micro Highlights */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-navy-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                Zero-Hallucination Extraction
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                Calibrated OCR Confidence Scoring
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                PostgreSQL Row-Level Security
              </span>
            </div>

            {/* Preview Mockup Card */}
            <div className="mt-12 max-w-5xl mx-auto rounded-2xl p-2 bg-gradient-to-b from-navy-200/50 to-navy-100/20 shadow-2xl border border-navy-200/60">
              <div className="bg-white rounded-xl p-6 sm:p-8 text-left shadow-inner">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-navy-100 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-health-100 text-health-700 flex items-center justify-center font-bold text-sm">
                      RX
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy-900 text-base">
                        Recent Document: Prescription_Nov2026.pdf
                      </h3>
                      <p className="text-xs text-navy-500">
                        Processed via PyMuPDF + Gemini Vision • Confidence: 96%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                      Verified Prescription
                    </span>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-navy-100 text-navy-700">
                      Dr. Sarah Smith, MD
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <p className="text-xs font-medium text-navy-400 uppercase">Medication</p>
                    <p className="text-base font-bold text-navy-900 mt-1">Amoxicillin</p>
                    <p className="text-xs text-navy-600 mt-0.5">500mg • Three times daily</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <p className="text-xs font-medium text-navy-400 uppercase">Lab Analyte</p>
                    <p className="text-base font-bold text-navy-900 mt-1">HbA1c</p>
                    <p className="text-xs text-navy-600 mt-0.5">5.6% • Reference: &lt; 5.7% (Normal)</p>
                  </div>
                  <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200/80">
                    <p className="text-xs font-medium text-teal-700 uppercase">Human-In-The-Loop</p>
                    <p className="text-base font-bold text-teal-900 mt-1">Ready for Review</p>
                    <p className="text-xs text-teal-700 mt-0.5">Zero uncertain fields detected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THE PROBLEM WE SOLVE */}
        <section className="py-16 md:py-24 bg-white border-y border-navy-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-xs font-bold text-health-600 uppercase tracking-wider mb-2">
                The Healthcare Reality
              </h2>
              <p className="text-3xl font-extrabold text-navy-950 sm:text-4xl tracking-tight">
                Why managing personal health records is broken today
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">
                  Paper Records Get Lost
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Prescriptions fade in drawers, laboratory slips are misplaced between moves, and discharge summaries are unavailable when visiting a new clinic or specialist.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-4">
                  <Eye className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">
                  Handwriting is Illegible
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Doctor scripts, dosages, and diagnostic abbreviations are difficult for patients to read, creating uncertainty about medication instructions and schedules.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-health-100 text-health-700 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">
                  No Longitudinal Trends
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Blood tests from three different diagnostic centers cannot be easily compared over time, leaving patients and doctors without long-term biomarker visibility.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CORE FEATURES SECTION */}
        <section id="features" className="py-20 md:py-28 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-xs font-bold text-health-600 uppercase tracking-wider mb-2">
                Comprehensive Capabilities
              </h2>
              <p className="text-3xl font-extrabold text-navy-950 sm:text-4xl tracking-tight">
                Engineered for clinical clarity and patient peace of mind
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="p-6 rounded-2xl bg-white border border-navy-100 shadow-card hover:shadow-card-hover transition-all">
                <div className="w-12 h-12 rounded-xl bg-health-50 text-health-600 flex items-center justify-center mb-5">
                  <FileCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">
                  AI-Powered Extraction
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Combines high-fidelity PyMuPDF digital parsing, Tesseract 5.4.0 local OCR, and multimodal Google Gemini Vision to decipher printed and handwritten clinical records.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-2xl bg-white border border-navy-100 shadow-card hover:shadow-card-hover transition-all">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-5">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">
                  Unified Chronological Timeline
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Every uploaded prescription, blood test, radiology report, and consultation summary is automatically organized into a searchable, filterable personal history.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-2xl bg-white border border-navy-100 shadow-card hover:shadow-card-hover transition-all">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-5">
                  <Pill className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">
                  Prescription Management
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Extracts active medications, dosages, administration frequencies, durations, and instructions into clean structured cards linked back to the original source document.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-2xl bg-white border border-navy-100 shadow-card hover:shadow-card-hover transition-all">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">
                  Laboratory Reports & Flags
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Captures test names, observed values, measurement units, and reference ranges. Flags abnormal levels (High/Low/Critical) strictly as specified by the laboratory.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-6 rounded-2xl bg-white border border-navy-100 shadow-card hover:shadow-card-hover transition-all">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">
                  AI Medical Assistant <span className="text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full ml-1 border border-teal-200">ACTIVE</span>
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Query your medical records in plain language: &ldquo;What was my cholesterol last July?&rdquo; or &ldquo;When did Dr. Smith change my prescription dosage?&rdquo;
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-6 rounded-2xl bg-white border border-navy-100 shadow-card hover:shadow-card-hover transition-all">
                <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-5">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">
                  Private Cloud Storage
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Documents are stored in private Supabase Storage buckets sandboxed by user UUID. Direct public access is disabled; downloads require short-lived signed URLs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-20 md:py-28 bg-white border-t border-navy-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-xs font-bold text-health-600 uppercase tracking-wider mb-2">
                Simple 3-Step Process
              </h2>
              <p className="text-3xl font-extrabold text-navy-950 sm:text-4xl tracking-tight">
                How HealthSync AI organizes your records
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Step 1 */}
              <div className="relative p-8 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-10 h-10 rounded-full bg-health-600 text-white font-bold flex items-center justify-center mb-6 shadow-md shadow-health-600/30">
                  1
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-3">
                  Upload Any Record
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Upload PDF documents, scanned reports, or photos of prescriptions from your smartphone. Magic-byte verification ensures safe file ingestion.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative p-8 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-10 h-10 rounded-full bg-health-600 text-white font-bold flex items-center justify-center mb-6 shadow-md shadow-health-600/30">
                  2
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-3">
                  AI Extraction & Review
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  The pipeline renders high-resolution text, extracts medication schedules and lab tables, computes calibrated confidence scores, and flags ambiguous fields for review.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative p-8 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-10 h-10 rounded-full bg-health-600 text-white font-bold flex items-center justify-center mb-6 shadow-md shadow-health-600/30">
                  3
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-3">
                  Organized Health Timeline
                </h3>
                <p className="text-sm text-navy-600 leading-relaxed">
                  Access your structured prescriptions, trend your diagnostic lab reports over time, and securely share verified documents with consulting physicians.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECURITY & PRIVACY */}
        <section id="security" className="py-20 md:py-28 bg-navy-950 text-white relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-3xl mb-14">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                Cryptographic Privacy By Design
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 tracking-tight">
                Your medical data belongs to you. Period.
              </h2>
              <p className="text-navy-300 mt-4 text-base leading-relaxed">
                HealthSync AI enforces defense-in-depth security at both the application API layer and PostgreSQL database engine.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-xl bg-navy-900/90 border border-navy-800">
                <ShieldCheck className="w-8 h-8 text-teal-400 mb-4" />
                <h4 className="font-bold text-white mb-2">Row-Level Security</h4>
                <p className="text-xs text-navy-300 leading-relaxed">
                  PostgreSQL RLS ensures that queries strictly isolate data to the owning user ID. No cross-tenant data leaks.
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
                <h4 className="font-bold text-white mb-2">No Hallucinations</h4>
                <p className="text-xs text-navy-300 leading-relaxed">
                  The AI extraction strictly outputs null for missing or unreadable clinical data rather than fabricating medical values.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="py-16 md:py-20 bg-gradient-to-r from-health-600 to-teal-600 text-white text-center">
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
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-health-700 bg-white hover:bg-slate-100 rounded-xl shadow-lg transition-all"
              >
                Create Free Account
              </Link>
              <button
                onClick={loginDemo}
                className="w-full sm:w-auto px-6 py-3.5 text-base font-semibold text-white bg-health-700/60 hover:bg-health-700 border border-white/30 rounded-xl transition-all"
              >
                ⚡ Explore Instant Demo
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
