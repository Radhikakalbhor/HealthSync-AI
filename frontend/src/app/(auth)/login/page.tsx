'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, Lock, Mail, ArrowRight, AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

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
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-gradient-to-tr from-health-50 via-white to-teal-50/40 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-6 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-health-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-health-500/20 group-hover:scale-105 transition-transform">
            <Activity className="w-6 h-6" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-navy-950">
            HealthSync<span className="text-health-500">.AI</span>
          </span>
        </Link>

        <h2 className="text-center text-2xl sm:text-3xl font-bold tracking-tight text-navy-950">
          Sign in to your patient portal
        </h2>
        <p className="mt-2 text-center text-sm text-navy-600">
          Or{' '}
          <Link href="/register" className="font-medium text-health-600 hover:text-health-500">
            create a new secure account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Authentication Error</p>
                <p className="mt-0.5">{error}</p>
                {error.toLowerCase().includes('not confirmed') ? (
                  <p className="mt-1.5 text-[11px] text-amber-800 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60">
                    Please check your email inbox and click the verification link to activate your account before logging in.
                  </p>
                ) : null}
                {error.includes('SUPABASE_NOT_CONFIGURED') || error.includes('configured') ? (
                  <p className="mt-1 text-[11px] text-rose-700">
                    Tip: Supabase credentials are not yet linked to the backend. You can use the{' '}
                    <button
                      type="button"
                      onClick={loginDemo}
                      className="font-bold underline cursor-pointer text-health-700"
                    >
                      Instant Demo Mode
                    </button>{' '}
                    to test the portal immediately!
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-navy-700">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-500 focus:border-health-500 text-navy-900 placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-navy-700">
                Password
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-500 focus:border-health-500 text-navy-900 placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-health-600 hover:bg-health-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-health-500 disabled:opacity-60 transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Access Divider */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500 font-medium">Or explore right now</span>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={loginDemo}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-teal-200 rounded-xl text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Instant Demo Access (No Setup Required)
              </button>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 text-center text-xs text-navy-500 flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>HealthSync AI does not provide medical diagnoses or prescriptions.</span>
        </div>
      </div>
    </div>
  );
}
