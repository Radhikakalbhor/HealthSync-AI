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
    {
      label: 'Settings',
      href: '/settings',
      icon: <Settings className="h-5 w-5 shrink-0" />,
    },
  ];

  return (
    <div className="h-screen sticky top-0 z-40">
      <AceternitySidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-6 py-4 bg-white border-r border-slate-200/90 shadow-xs">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {/* Brand Logo Header */}
            <div className="mb-4 px-1">
              <Link href="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-health-600 via-health-500 to-teal-500 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                {open && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col truncate"
                  >
                    <span className="font-extrabold text-base tracking-tight text-navy-950 font-display">
                      HealthSync<span className="text-health-500">.AI</span>
                    </span>
                  </motion.div>
                )}
              </Link>
            </div>

            {/* Quick Upload Button */}
            <div className="mb-3 px-0.5">
              <button
                type="button"
                onClick={() => {
                  if (onOpenUpload) onOpenUpload();
                  if (setMobileOpen) setMobileOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-xl bg-health-600 hover:bg-health-700 text-white font-bold text-xs py-2.5 px-3 transition-colors shadow-xs cursor-pointer",
                  !open && "justify-center px-2"
                )}
                title="Upload Medical Record"
              >
                <Upload className="w-4 h-4 shrink-0" />
                {open && <span className="truncate">Upload Record</span>}
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-col gap-1">
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
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-health-100 text-health-700 flex items-center justify-center font-bold text-xs shrink-0 border border-health-200">
                  {user?.full_name ? user.full_name[0] : user?.email ? user.email[0] : 'P'}
                </div>
                {open && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="truncate flex flex-col"
                  >
                    <span className="text-xs font-bold text-navy-950 truncate">
                      {user?.full_name || 'Alex Morgan'}
                    </span>
                    <span className="text-[10px] text-navy-500 truncate">
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
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
