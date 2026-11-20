'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { UploadModal } from '@/components/documents/UploadModal';
import { Activity } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !token && !user) {
      router.push('/login');
    }
  }, [isLoading, token, user, router]);

  // Derive title from pathname
  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Patient Dashboard';
    if (pathname.startsWith('/timeline')) return 'Unified Medical Timeline';
    if (pathname.startsWith('/analytics')) return 'Biomarker Health Trends';
    if (pathname.startsWith('/summary')) return 'Doctor Visit Summary & Briefing';
    if (pathname.startsWith('/emergency')) return 'Emergency Health Card';
    if (pathname.startsWith('/family')) return 'Family Member Profiles';
    if (pathname.startsWith('/documents') && pathname.includes('/review')) return 'Document Clinical Review';
    if (pathname.startsWith('/documents')) return 'Medical Records & Documents';
    if (pathname.startsWith('/prescriptions')) return 'Prescription & Medication Tracker';
    if (pathname.startsWith('/lab-reports')) return 'Diagnostic & Laboratory Reports';
    if (pathname.startsWith('/reminders')) return 'Smart Medication Reminders';
    if (pathname.startsWith('/assistant')) return 'AI Medical Records Assistant';
    if (pathname.startsWith('/settings')) return 'Settings & Security';
    return 'HealthSync AI';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-health-600 to-teal-500 flex items-center justify-center text-white shadow-lg animate-pulse mb-4">
          <Activity className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-navy-800">Loading HealthSync AI...</p>
        <p className="text-xs text-navy-400 mt-1">Connecting to secure medical vault</p>
      </div>
    );
  }

  if (!token && !user) {
    return null;
  }

  return (
    <div className="h-screen bg-[#EAF4F8] flex overflow-hidden relative">
      {/* Background medical ambient gradient - soft blue and teal layered lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-br from-[#EAF4F8] via-[#e2f0f7] to-[#d6ebf4]" />

      {/* Subtle medical cross pattern grid overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(19, 184, 174, 0.18) 1.5px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />
      
      {/* Decorative ambient medical glowing orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[550px] h-[550px] rounded-full bg-teal-400/10 blur-3xl pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-cyan-400/10 blur-3xl pointer-events-none z-0" />

      {/* Sidebar Navigation - Fixed & Non-scrolling */}
      <div className="h-screen shrink-0 z-40">
        <Sidebar
          onOpenUpload={() => setUploadModalOpen(true)}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
      </div>

      {/* Main Content Area - Independently scrollable */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-y-auto relative z-10">
        <Header
          title={getPageTitle()}
          onOpenUpload={() => setUploadModalOpen(true)}
          onToggleMobile={() => setMobileOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Upload Modal */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={() => {
          // Trigger refresh event or state reload
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('healthsync-record-uploaded'));
          }
        }}
      />
    </div>
  );
}
