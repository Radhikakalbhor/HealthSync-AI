'use client';

import React from 'react';
import { Menu, Upload, ShieldAlert, Sparkles, Activity } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import LanguageSelector from '@/components/layout/LanguageSelector';

interface HeaderProps {
  title?: string;
  onOpenUpload?: () => void;
  onToggleMobile?: () => void;
}

export function Header({ title = 'Patient Dashboard', onOpenUpload, onToggleMobile }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Page Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobile}
            className="p-2 -ml-2 rounded-lg text-navy-600 hover:text-navy-900 hover:bg-slate-100 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-navy-950 tracking-tight">{title}</h1>
            <p className="text-xs text-navy-500 hidden sm:block">
              Welcome back, <span className="font-semibold text-navy-800">{user?.full_name || user?.email || 'Patient'}</span>
            </p>
          </div>
        </div>

        {/* Right: Disclaimer badge + Language Selector + Upload Action */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>HealthSync AI organizes & explains records; does not diagnose or prescribe.</span>
          </div>

          <LanguageSelector />

          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-health-600 hover:bg-health-700 rounded-xl shadow-sm hover:shadow transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload Record</span>
            <span className="sm:hidden">Upload</span>
          </button>
        </div>
      </div>
    </header>
  );
}
