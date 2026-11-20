'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, Lock, Mail, ArrowRight, AlertCircle, ShieldAlert, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, loginDemo } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-[#071D2B]">
      {/* Layered rich deep navy, dark teal and cyan gradients */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-gradient-to-tr from-[#071D2B] via-[#0B3D4A]/90 to-[#071D2B]" />

      {/* Decorative medical dot pattern */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(54, 214, 232, 0.3) 1.5px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Subtle animated ECG heartbeat line across the login screen */}
      <div className="absolute top-1/4 left-0 right-0 h-24 pointer-events-none opacity-25 overflow-hidden z-0">
        <svg viewBox="0 0 1000 100" className="w-full h-full text-teal-400 stroke-current fill-none">
          <path
            d="M0 50 L200 50 L220 20 L240 80 L260 10 L280 90 L295 40 L310 50 L500 50 L520 20 L540 80 L560 10 L580 90 L595 40 L610 50 L1000 50"
            strokeWidth="2"
            strokeLinecap="round"
            className="animate-ecg-line"
          />
        </svg>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-400 via-teal-500 to-cyan-500 flex items-center justify-center text-[#061826] shadow-lg shadow-teal-500/30 group-hover:scale-105 transition-transform duration-200">
            <Activity className="w-7 h-7 stroke-[2.5]" />
          </div>
          <span className="font-black text-2xl sm:text-3xl tracking-tight text-white font-display">
            HealthSync<span className="text-teal-400">.AI</span>
          </span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-display">
          Welcome to Clinical Portal
        </h1>
        <p className="mt-2 text-sm text-cyan-100/80">
          Or{' '}
          <Link href="/register" className="font-bold text-teal-400 hover:text-teal-300 underline-offset-4 hover:underline transition-colors">
            create a new secure account
          </Link>
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="rounded-3xl border border-white/20 bg-white/90 backdrop-blur-2xl shadow-2xl shadow-cyan-950/40 p-6 sm:p-8">
            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-rose-900">Authentication Error</p>
                  <p className="text-rose-800 leading-relaxed">{error}</p>
                  {error.toLowerCase().includes('not confirmed') && (
                    <p className="text-[11px] text-amber-800 bg-amber-50/90 p-2 rounded-lg border border-amber-200/60">
                      Please check your email inbox and click the verification link to activate your account before logging in.
                    </p>
                  )}
                  {(error.includes('SUPABASE_NOT_CONFIGURED') || error.includes('configured')) && (
                    <p className="text-[11px] text-rose-700">
                      Tip: Supabase credentials are not linked. You can use{' '}
                      <button
                        type="button"
                        onClick={loginDemo}
                        className="font-bold underline text-health-700 hover:text-health-800 cursor-pointer"
                      >
                        Instant Demo Mode
                      </button>{' '}
                      to test immediately.
                    </p>
                  )}
                </div>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-navy-700">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="patient@example.com"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-navy-700">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  className="w-full text-sm font-semibold shadow-md shadow-health-600/20"
                >
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </form>

            {/* Instant Demo Sandbox Shortcut */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <div className="text-center mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Instant Exploration
                </span>
              </div>
              <Button
                type="button"
                variant="demo"
                size="md"
                onClick={loginDemo}
                className="w-full justify-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-black shadow-md border-0"
              >
                <Zap className="w-4 h-4 fill-white text-white shrink-0" />
                <span>Instant Demo Access (Alex Morgan)</span>
              </Button>
            </div>
          </div>

        {/* Clinical Disclaimer */}
        <div className="mt-6 text-center flex items-center justify-center gap-1.5">
          <Badge variant="default" className="text-[11px] text-cyan-200 bg-white/10 border-white/20 backdrop-blur-md py-1 px-3">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 mr-1.5 shrink-0" />
            HealthSync AI does not provide medical diagnoses or prescriptions.
          </Badge>
        </div>
      </div>
    </div>
  );
}
