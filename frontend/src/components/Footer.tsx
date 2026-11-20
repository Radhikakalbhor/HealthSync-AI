import React from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#04121c] text-slate-400 py-12 border-t border-[#0e3b48] relative overflow-hidden">
      {/* Decorative subtle medical grid overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(54, 214, 232, 0.3) 1.5px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#13B8AE] to-[#36D6E8] flex items-center justify-center text-[#071D2B] shadow-md shadow-teal-500/20">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-xl text-white tracking-tight">
              HealthSync<span className="text-[#36D6E8]">.AI</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <Link href="/" className="hover:text-[#36D6E8] transition-colors">Platform</Link>
            <Link href="/dashboard" className="hover:text-[#36D6E8] transition-colors">Patient Portal</Link>
            <Link href="/login" className="hover:text-[#36D6E8] transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-[#36D6E8] transition-colors">Register Vault</Link>
          </div>

          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} HealthSync.AI. All rights reserved.
          </p>
        </div>
        <p className="mt-8 text-center text-[11px] text-slate-500 leading-relaxed border-t border-[#0e3b48]/60 pt-6">
          HealthSync AI is an intelligent clinical document organization & patient vault platform. It does not provide medical diagnoses or prescriptions.
        </p>
      </div>
    </footer>
  );
}
