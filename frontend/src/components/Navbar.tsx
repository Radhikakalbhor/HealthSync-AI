'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, ShieldCheck, Menu, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loginDemo } = useAuth();

  return (
    <header className="sticky top-0 z-50 glass border-b border-navy-100 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-health-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-health-500/20 group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-navy-900 group-hover:text-health-600 transition-colors">
                HealthSync<span className="text-health-500">.AI</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded ml-2 border border-teal-200">
                PATIENT PORTAL
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-navy-600">
            <Link href="#features" className="hover:text-health-600 transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="hover:text-health-600 transition-colors">
              How It Works
            </Link>
            <Link href="#security" className="hover:text-health-600 transition-colors">
              Security & Privacy
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-health-600 hover:bg-health-700 rounded-lg shadow-sm hover:shadow transition-all"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <button
                  onClick={loginDemo}
                  className="px-3.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
                  title="Explore instantly without registering"
                >
                  ⚡ Instant Demo
                </button>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-navy-700 hover:text-navy-900 hover:bg-navy-50 rounded-lg transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-health-600 hover:bg-health-700 rounded-lg shadow-sm hover:shadow transition-all"
                >
                  Get Started
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-navy-600 hover:text-navy-900 hover:bg-navy-50"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-navy-100 bg-white px-4 pt-2 pb-6 space-y-3">
          <Link
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-navy-700 hover:bg-navy-50 rounded-lg"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-navy-700 hover:bg-navy-50 rounded-lg"
          >
            How It Works
          </Link>
          <Link
            href="#security"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-medium text-navy-700 hover:bg-navy-50 rounded-lg"
          >
            Security & Privacy
          </Link>
          <div className="pt-3 border-t border-navy-100 flex flex-col gap-2">
            {user ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2 text-sm font-medium text-white bg-health-600 rounded-lg"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    loginDemo();
                  }}
                  className="w-full text-center px-4 py-2 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg"
                >
                  ⚡ Instant Demo
                </button>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 text-sm font-medium text-navy-700 bg-navy-50 rounded-lg"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 text-sm font-medium text-white bg-health-600 rounded-lg"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
