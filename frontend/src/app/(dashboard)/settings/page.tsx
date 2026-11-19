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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { user, token, logout } = useAuth();

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight font-display">
          Patient Profile & Security
        </h1>
        <p className="text-xs sm:text-sm text-navy-500 mt-1 font-sans">
          Manage your account credentials, security preferences, and data privacy
        </p>
      </div>

      {/* Patient Profile Card */}
      <Card className="p-6 space-y-6 shadow-sm">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2 font-display">
          <User className="w-4 h-4 text-health-600" />
          <span>Patient Identity</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">
              Full Name
            </span>
            <p className="text-sm font-bold text-navy-900 mt-1 font-display">
              {user?.full_name || 'Patient'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">
              Registered Email
            </span>
            <p className="text-sm font-bold text-navy-900 mt-1 font-sans">{user?.email || 'patient@example.com'}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">
              Patient UUID
            </span>
            <p className="text-xs font-mono font-medium text-navy-600 mt-1 truncate">
              {user?.id || 'demo-user-id'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-navy-400 uppercase tracking-wider block">
              Account Registration
            </span>
            <p className="text-sm font-medium text-navy-800 mt-1 font-mono">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}
            </p>
          </div>
        </div>
      </Card>

      {/* Data Protection & Row-Level Security */}
      <Card className="p-6 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2 font-display">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Security & Row-Level Isolation</span>
        </h2>

        <div className="space-y-3 text-xs text-navy-700">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-teal-50/70 border border-teal-200/80">
            <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-teal-950">PostgreSQL Row-Level Security (RLS) Active</p>
              <p className="text-teal-800 text-[11px] mt-0.5 leading-relaxed font-sans">
                Every query to your medical documents, prescriptions, and lab tests enforces <code className="bg-white/80 px-1 py-0.5 rounded font-mono">auth.uid() = user_id</code>. No other user or tenant can view your data.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <Server className="w-4 h-4 text-health-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-navy-900">Private Cloud Storage</p>
              <p className="text-navy-600 text-[11px] mt-0.5 leading-relaxed font-sans">
                Original document files are saved in private buckets. File downloads require short-lived cryptographic signed URLs generated on-demand.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <FileText className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-navy-900">Immutable Audit Trail</p>
              <p className="text-navy-600 text-[11px] mt-0.5 leading-relaxed font-sans">
                All document uploads, downloads, views, and sharing authorizations are logged in an append-only audit log with Protected Health Information (PHI) sanitized.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Session Management */}
      <Card className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-navy-900 font-display">Active Authentication Session</h2>
          <p className="text-xs text-navy-500 mt-0.5 font-sans">
            Logged in via secure Supabase JWT Bearer token authentication
          </p>
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={() => logout()}
          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 hover:text-rose-800 font-semibold"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Sign Out of Account
        </Button>
      </Card>

      {/* Medical Disclaimer */}
      <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5 shadow-sm">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          HealthSync AI is a medical record organization and extraction tool. It never provides diagnoses or clinical advice. Consult a healthcare provider for medical needs.
        </p>
      </div>
    </div>
  );
}
