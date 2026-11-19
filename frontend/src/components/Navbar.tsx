'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, Menu, X, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loginDemo } = useAuth();

  return (
    <header className="sticky top-0 z-50 glass border-b border-slate-200/80 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-health-600 via-health-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-health-500/20 group-hover:scale-105 transition-transform duration-200">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-navy-950 group-hover:text-health-600 transition-colors">
                HealthSync<span className="text-health-500">.AI</span>
              </span>
            </div>
          </Link>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button variant="primary" size="sm">
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Button
                  variant="demo"
                  size="sm"
                  onClick={loginDemo}
                  title="Explore instantly without registering"
                >
                  <Zap className="w-3.5 h-3.5 fill-teal-600 text-teal-600" />
                  <span>Instant Demo</span>
                </Button>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    Get Started Free
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-navy-600 hover:text-navy-950 hover:bg-slate-100 cursor-pointer transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 pt-3 pb-6 space-y-3 shadow-xl">
          <div className="flex flex-col gap-2.5">
            {user ? (
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="md" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Button
                  variant="demo"
                  size="md"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    loginDemo();
                  }}
                  className="w-full"
                >
                  <Zap className="w-4 h-4 fill-teal-600 text-teal-600" />
                  Instant Demo Access
                </Button>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" size="md" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="primary" size="md" className="w-full">
                      Get Started Free
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
