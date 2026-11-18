'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  LayoutDashboard,
  FileText,
  Pill,
  BarChart3,
  Settings,
  LogOut,
  Upload,
  ShieldCheck,
  Sparkles,
  Bell,
  Bot,
  Calendar,
  TrendingUp,
  Stethoscope,
  HeartPulse,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';

interface SidebarProps {
  onOpenUpload?: () => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export function Sidebar({ onOpenUpload, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const navItems = [
    { label: t('nav_dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { label: t('nav_timeline'), href: '/timeline', icon: Calendar },
    { label: t('nav_analytics'), href: '/analytics', icon: TrendingUp },
    { label: t('nav_summary'), href: '/summary', icon: Stethoscope },
    { label: t('nav_emergency'), href: '/emergency', icon: HeartPulse },
    { label: t('nav_family'), href: '/family', icon: Users },
    { label: t('nav_documents'), href: '/documents', icon: FileText },
    { label: t('nav_reminders'), href: '/reminders', icon: Bell },
    { label: t('nav_assistant'), href: '/assistant', icon: Bot },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleNavClick = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen && setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 z-50 h-screen w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-health-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-health-500/20">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-navy-900">
                  HealthSync<span className="text-health-500">.AI</span>
                </span>
                <span className="block text-[10px] text-teal-600 font-semibold uppercase tracking-wider">
                  Patient Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Action: Upload */}
          <div className="px-4 py-4">
            <button
              onClick={() => {
                if (onOpenUpload) onOpenUpload();
                if (setMobileOpen) setMobileOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-health-600 hover:bg-health-700 shadow-sm hover:shadow transition-all"
            >
              <Upload className="w-4 h-4" />
              Upload Medical Record
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-health-50 text-health-700 font-semibold shadow-xs'
                      : 'text-navy-600 hover:bg-slate-50 hover:text-navy-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-health-600' : 'text-navy-400 group-hover:text-navy-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* AI Assistant Callout */}
          <div className="p-3.5 mx-3 my-2 rounded-xl bg-gradient-to-br from-health-50 to-teal-50/50 border border-health-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-health-800">
                <Sparkles className="w-3.5 h-3.5 text-health-600" />
                <span>AI Assistant Active</span>
              </div>
              <Link href="/assistant" className="text-[10px] font-bold text-health-600 hover:underline">
                Chat →
              </Link>
            </div>
            <p className="text-[11px] text-navy-600 mt-1 leading-relaxed">
              Ask questions about your health records with verified citations.
            </p>
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-health-100 text-health-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {user?.full_name ? user.full_name[0] : user?.email ? user.email[0] : 'P'}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-navy-900 truncate">
                  {user?.full_name || 'Patient'}
                </p>
                <p className="text-[11px] text-navy-500 truncate">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 rounded-lg text-navy-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
