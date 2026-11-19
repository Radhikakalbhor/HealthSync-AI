import React from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-navy-950 text-navy-400 py-8 border-t border-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-health-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-lg text-white tracking-tight">
              HealthSync<span className="text-health-400">.AI</span>
            </span>
          </div>
          <p className="text-xs text-navy-400">
            © {new Date().getFullYear()} HealthSync AI. All rights reserved.
          </p>
        </div>
        <p className="mt-4 text-center text-[11px] text-navy-500 leading-relaxed border-t border-navy-900/60 pt-4">
          HealthSync AI is a personal health record organizer. It does not provide medical advice, diagnosis, or treatment.
        </p>
      </div>
    </footer>
  );
}
