'use client';

import React from 'react';
import { Menu, Upload, ShieldAlert, Sparkles, Activity } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import LanguageSelector from '@/components/layout/LanguageSelector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  title?: string;
  onOpenUpload?: () => void;
  onToggleMobile?: () => void;
}

export function Header({ title = 'Patient Dashboard', onOpenUpload, onToggleMobile }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#d6e8f2] shadow-xs px-4 sm:px-6 lg:px-8 py-3.5 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Page Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobile}
            className="p-2 -ml-2 rounded-xl text-[#0B3D4A] hover:text-[#071D2B] hover:bg-slate-100 cursor-pointer transition-colors md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#071D2B] tracking-tight leading-snug">
              {title}
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              Welcome back, <span className="font-bold text-[#0B3D4A]">{user?.full_name || user?.email || 'Patient'}</span>
            </p>
          </div>
        </div>

        {/* Right: Language Selector + Upload Action */}
        <div className="flex items-center gap-3">
          <LanguageSelector />

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenUpload}
            className="shadow-sm hover:shadow-md bg-gradient-to-r from-[#13B8AE] to-[#0B3D4A] hover:from-[#0da59c] hover:to-[#071D2B] text-white border-0 font-bold"
          >
            <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">Upload Record</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
