'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Sidebar as AceternitySidebar,
  SidebarBody,
  SidebarLink,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Calendar,
  TrendingUp,
  Stethoscope,
  HeartPulse,
  Users,
  FileText,
  Bell,
  Bot,
  Settings,
  Upload,
  LogOut,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onOpenUpload?: () => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export function Sidebar({ onOpenUpload, mobileOpen, setMobileOpen }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const links = [
    {
      label: t('nav_dashboard'),
      href: '/dashboard',
      icon: <LayoutDashboard className="h-5 w-5 shrink-0" />,
    },
    {
      label: t('nav_timeline'),
      href: '/timeline',
      icon: <Calendar className="h-5 w-5 shrink-0" />,
    },
    {
      label: t('nav_analytics'),
      href: '/analytics',
      icon: <TrendingUp className="h-5 w-5 shrink-0" />,
    },
    {
      label: t('nav_summary'),
      href: '/summary',
      icon: <Stethoscope className="h-5 w-5 shrink-0" />,
    },
    {
      label: t('nav_emergency'),
      href: '/emergency',
      icon: <HeartPulse className="h-5 w-5 shrink-0" />,
    },
    {
      label: t('nav_family'),
      href: '/family',
      icon: <Users className="h-5 w-5 shrink-0" />,
    },
    {
      label: t('nav_documents'),
      href: '/documents',
      icon: <FileText className="h-5 w-5 shrink-0" />,
    },
    {
      label: t('nav_reminders'),
      href: '/reminders',
      icon: <Bell className="h-5 w-5 shrink-0" />,
    },
    {
      label: t('nav_assistant'),
      href: '/assistant',
      icon: <Bot className="h-5 w-5 shrink-0" />,
    },
  ];

  return (
    <div className="h-screen sticky top-0 z-40">
      <AceternitySidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-6 py-5 bg-gradient-to-b from-[#071D2B] via-[#0B3D4A] to-[#04121c] text-slate-100 border-r border-[#0e3b48] shadow-2xl relative">
          {/* Subtle medical ECG SVG line at the bottom of the sidebar */}
          <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none opacity-20 overflow-hidden">
            <svg viewBox="0 0 300 60" className="w-full h-full text-[#36D6E8] stroke-current fill-none" strokeWidth="1.5">
              <path d="M0 30 L50 30 L65 15 L75 45 L85 20 L95 35 L105 30 L180 30 L195 10 L205 50 L215 25 L225 35 L235 30 L300 30" />
            </svg>
          </div>

          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto relative z-10">
            {/* Brand Logo Header */}
            <div className="mb-5 px-1">
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#13B8AE] to-[#36D6E8] flex items-center justify-center text-[#071D2B] shadow-lg shadow-teal-500/25 shrink-0">
                  <Activity className="w-5 h-5 stroke-[2.5]" />
                </div>
                {open && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col truncate"
                  >
                    <span className="font-extrabold text-base tracking-tight text-white font-display flex items-center gap-1.5">
                      HealthSync<span className="text-[#36D6E8]">AI</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-[#13B8AE] font-semibold">
                      Clinical Intelligence
                    </span>
                  </motion.div>
                )}
              </Link>
            </div>

            {/* Quick Upload Button */}
            <div className="mb-4 px-0.5">
              <button
                type="button"
                onClick={() => {
                  if (onOpenUpload) onOpenUpload();
                  if (setMobileOpen) setMobileOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#13B8AE] to-[#36D6E8] hover:from-[#0da59c] hover:to-[#22b5c6] text-[#071D2B] font-extrabold text-xs py-2.5 px-3 transition-all shadow-md shadow-teal-500/20 cursor-pointer",
                  !open && "justify-center px-2"
                )}
                title="Upload Medical Record"
              >
                <Upload className="w-4 h-4 shrink-0 stroke-[2.5]" />
                {open && <span className="truncate">Upload Record</span>}
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-col gap-1.5">
              {links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== '/dashboard' && pathname.startsWith(link.href));

                return (
                  <SidebarLink
                    key={link.href}
                    link={link}
                    isActive={isActive}
                    onClick={() => {
                      if (setMobileOpen) setMobileOpen(false);
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* User Profile & Logout at Bottom */}
          <div className="pt-3 border-t border-[#0e3b48] flex flex-col gap-2 relative z-10">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-[#0B3D4A] text-[#36D6E8] flex items-center justify-center font-bold text-xs shrink-0 border border-[#13B8AE]/40">
                  {user?.full_name ? user.full_name[0] : user?.email ? user.email[0] : 'P'}
                </div>
                {open && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="truncate flex flex-col"
                  >
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {user?.full_name || 'Alex Morgan'}
                    </span>
                    <span className="text-[10px] text-[#36D6E8] truncate">
                      {user?.email || 'alex.morgan@healthsync.ai'}
                    </span>
                  </motion.div>
                )}
              </div>

              {open && (
                <button
                  type="button"
                  onClick={() => logout()}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </SidebarBody>
      </AceternitySidebar>
    </div>
  );
}
