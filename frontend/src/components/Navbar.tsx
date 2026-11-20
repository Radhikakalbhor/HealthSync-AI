'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Activity, Menu, X, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loginDemo } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#071D2B]/95 backdrop-blur-md border-b border-[#0e3b48]/80 shadow-lg'
          : 'bg-transparent border-b-0'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Brand Logo matching Hero-poster.jpg */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#13B8AE] to-[#36D6E8] flex items-center justify-center text-[#071D2B] shadow-md shadow-[#13B8AE]/25 group-hover:scale-105 transition-transform duration-200">
              <Activity className="w-5 h-5 stroke-[2.5] animate-cardiac-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-[#36D6E8] transition-colors">
                HealthSync<span className="text-[#36D6E8]">.Ai</span>
              </span>
            </div>
          </Link>

          {/* Center Navigation Links (from Hero-poster.jpg) */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-300">
            <Link
              href="/"
              className="text-[#36D6E8] font-bold hover:text-[#36D6E8] transition-colors"
            >
              Home
            </Link>
            <a href="#platform" className="hover:text-[#36D6E8] transition-colors">
              Platform
            </a>
            <a href="#features" className="hover:text-[#36D6E8] transition-colors">
              Features
            </a>
            <a href="#workflow" className="hover:text-[#36D6E8] transition-colors">
              How It Works
            </a>
            <a href="#faq" className="hover:text-[#36D6E8] transition-colors">
              About
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button variant="primary" size="sm" className="bg-gradient-to-r from-[#13B8AE] to-[#36D6E8] hover:from-[#0da59c] hover:to-[#22b5c6] text-[#071D2B] font-extrabold border-0 rounded-full px-5">
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
                  className="bg-[#0B3D4A]/80 text-[#36D6E8] border border-[#13B8AE]/40 hover:bg-[#13B8AE]/20 font-bold rounded-full px-4"
                >
                  <Zap className="w-3.5 h-3.5 mr-1 fill-[#36D6E8]" />
                  Instant Demo
                </Button>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-slate-200 hover:text-white hover:bg-white/10 rounded-full px-4">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm" className="bg-gradient-to-r from-[#13B8AE] to-[#36D6E8] hover:from-[#0da59c] hover:to-[#22b5c6] text-[#071D2B] font-extrabold border-0 rounded-full px-5 shadow-md shadow-teal-500/20">
                    Get Started
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#0e3b48] bg-[#071D2B]/95 backdrop-blur-md px-4 pt-3 pb-6 space-y-4 shadow-xl">
          <nav className="flex flex-col gap-3 text-sm font-medium text-slate-200 border-b border-[#0e3b48] pb-3">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="text-[#36D6E8] font-bold">
              Home
            </Link>
            <a href="#platform" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#36D6E8]">
              Platform
            </a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#36D6E8]">
              Features
            </a>
            <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#36D6E8]">
              How It Works
            </a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#36D6E8]">
              About
            </a>
          </nav>

          <div className="flex flex-col gap-2.5">
            {user ? (
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="md" className="w-full bg-gradient-to-r from-[#13B8AE] to-[#36D6E8] text-[#071D2B] font-black border-0 rounded-full">
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
                  className="w-full bg-[#0B3D4A] text-[#36D6E8] border border-[#13B8AE]/30 rounded-full"
                >
                  <Zap className="w-4 h-4 mr-1 fill-[#36D6E8]" />
                  Instant Demo
                </Button>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="md" className="w-full text-slate-200 border border-slate-700/60 rounded-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="primary" size="md" className="w-full bg-gradient-to-r from-[#13B8AE] to-[#36D6E8] text-[#071D2B] font-bold border-0 rounded-full">
                      Get Started
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
