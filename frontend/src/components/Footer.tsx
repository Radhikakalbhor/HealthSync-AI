import React from 'react';
import Link from 'next/link';
import { Activity, ShieldAlert, Heart, Lock, FileText } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-navy-900 text-navy-300 pt-16 pb-12 border-t border-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-health-500 flex items-center justify-center text-white shadow-md">
                <Activity className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-white tracking-tight">
                HealthSync<span className="text-health-400">.AI</span>
              </span>
            </div>
            <p className="text-navy-300 text-sm max-w-md leading-relaxed">
              Your Health. Connected. Intelligent. Organized.
              The personal medical record organizer powered by calibrated OCR, multimodal vision AI, and patient-first cryptographic security.
            </p>
            <div className="flex items-center gap-4 text-xs text-navy-400 pt-2">
              <span className="inline-flex items-center gap-1.5 text-teal-400">
                <Lock className="w-3.5 h-3.5" /> Supabase Row-Level Security
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 text-health-400">
                <ShieldAlert className="w-3.5 h-3.5" /> Zero-Hallucination Guardrails
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Patient Dashboard
                </Link>
              </li>
              <li>
                <Link href="/documents" className="hover:text-white transition-colors">
                  Medical Records
                </Link>
              </li>
              <li>
                <Link href="/prescriptions" className="hover:text-white transition-colors">
                  Prescription Tracker
                </Link>
              </li>
              <li>
                <Link href="/lab-reports" className="hover:text-white transition-colors">
                  Laboratory Reports
                </Link>
              </li>
            </ul>
          </div>

          {/* Clinical & Privacy */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Trust & Architecture
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="text-navy-400">Tesseract 5.4.0 Engine</span>
              </li>
              <li>
                <span className="text-navy-400">Google Gemini Multimodal</span>
              </li>
              <li>
                <span className="text-navy-400">PostgreSQL 15+ / RLS</span>
              </li>
              <li>
                <span className="text-navy-400">Private Bucket Encrypted</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Mandatory Medical Disclaimer Banner */}
        <div className="p-4 rounded-xl bg-navy-800/80 border border-navy-700/80 mb-8">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-navy-300 leading-relaxed">
              <strong className="text-amber-300 font-semibold uppercase tracking-wider">
                Critical Medical Disclaimer:{' '}
              </strong>
              HealthSync AI organizes, retrieves, and explains information from existing medical records. It{' '}
              <strong className="text-white font-medium underline underline-offset-2">
                NEVER diagnoses diseases, recommends treatments, or prescribes medications.
              </strong>{' '}
              Always consult a licensed medical physician or certified healthcare provider for clinical diagnosis, medical evaluation, or treatment decisions.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-navy-800 text-xs text-navy-400">
          <p>© {new Date().getFullYear()} HealthSync AI. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Engineered with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for patient safety.
          </p>
        </div>
      </div>
    </footer>
  );
}
