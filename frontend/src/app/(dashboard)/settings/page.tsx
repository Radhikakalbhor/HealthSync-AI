'use client';

import React from 'react';
import {
  User,
  ShieldCheck,
  Lock,
  LogOut,
  Mail,
  Calendar,
  Key,
  ShieldAlert,
  Server,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function SettingsPage() {
  const { user, token, logout } = useAuth();

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-navy-950">Patient Profile & Security</h2>
        <p className="text-xs sm:text-sm text-navy-500 mt-0.5">
          Manage your account credentials, security preferences, and data privacy
        </p>
      </div>

      {/* Patient Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-6">
        <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-health-600" />
          <span>Patient Identity</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wider block">
              Full Name
            </span>
            <p className="text-sm font-bold text-navy-900 mt-1">
              {user?.full_name || 'Patient'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wider block">
              Registered Email
            </span>
            <p className="text-sm font-bold text-navy-900 mt-1">{user?.email || 'patient@example.com'}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wider block">
              Patient UUID
            </span>
            <p className="text-xs font-mono font-medium text-navy-600 mt-1 truncate">
              {user?.id || 'demo-user-id'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wider block">
              Account Registration
            </span>
            <p className="text-sm font-medium text-navy-800 mt-1">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
            </p>
          </div>
        </div>
      </div>

      {/* Data Protection & Row-Level Security */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Security & Row-Level Isolation</span>
        </h3>

        <div className="space-y-3 text-xs text-navy-700">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-teal-50/70 border border-teal-200/80">
            <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-teal-950">PostgreSQL Row-Level Security (RLS) Active</p>
              <p className="text-teal-800 text-[11px] mt-0.5">
                Every query to your medical documents, prescriptions, and lab tests enforces <code>auth.uid() = user_id</code>. No other user or tenant can view your data.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <Server className="w-4 h-4 text-health-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-navy-900">Private Cloud Storage</p>
              <p className="text-navy-600 text-[11px] mt-0.5">
                Original document files are saved in private buckets. File downloads require short-lived cryptographic signed URLs generated on-demand.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <FileText className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-navy-900">Immutable Audit Trail</p>
              <p className="text-navy-600 text-[11px] mt-0.5">
                All document uploads, downloads, views, and sharing authorizations are logged in an append-only audit log with Protected Health Information (PHI) sanitized.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Session Management */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-navy-900">Active Authentication Session</h3>
          <p className="text-xs text-navy-500 mt-0.5">
            Logged in via secure Supabase JWT Bearer token authentication
          </p>
        </div>

        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out of Account
        </button>
      </div>

      {/* Medical Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          HealthSync AI is a medical record organization and extraction tool. It never provides diagnoses or clinical advice. Consult a healthcare provider for medical needs.
        </p>
      </div>
    </div>
  );
}
