'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, Lock, Mail, User, ArrowRight, AlertCircle, ShieldAlert, CheckCircle2, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const { register, loginDemo } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please provide email and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await register(email, password, fullName || undefined);
      if (result.confirmationRequired) {
        setRegisteredEmail(email);
        setIsSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  // Confirmation screen when email verification is required
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-health-50 via-white to-teal-50/40 pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-health-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-health-500/20 group-hover:scale-105 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-navy-950">
              HealthSync<span className="text-health-500">.AI</span>
            </span>
          </Link>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
          <Card className="shadow-xl shadow-slate-200/60 border-slate-200/90 backdrop-blur-sm bg-white/95 text-center">
            <CardContent className="pt-8 pb-8 px-6 sm:px-8">
              <div className="w-16 h-16 bg-teal-50 border border-teal-200/80 rounded-2xl flex items-center justify-center mx-auto mb-5 text-teal-600 shadow-sm">
                <Mail className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-navy-950 mb-2 font-display">
                Verify Your Email
              </h2>

              <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200/60 mb-6 text-left">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-teal-950 font-medium leading-relaxed">
                    Account created successfully! Please check your email and click the verification link to activate your account.
                  </p>
                </div>
                {registeredEmail && (
                  <div className="mt-3 pt-2.5 border-t border-teal-200/50 pl-7 text-xs text-teal-800">
                    <span>Verification link sent to: </span>
                    <span className="font-semibold text-teal-950 font-mono">{registeredEmail}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-navy-600 mb-6 leading-relaxed">
                Once you have clicked the link in your email, you will be able to sign in to your HealthSync AI patient portal with your credentials.
              </p>

              <Link href="/login" className="block w-full">
                <Button variant="primary" size="lg" className="w-full">
                  Return to Sign In
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs text-navy-500">
                  Didn&apos;t receive an email? Check your spam or junk folder.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 text-center flex items-center justify-center gap-1.5">
            <Badge variant="default" className="text-[11px] text-navy-600 bg-white/80 border-slate-200 py-1 px-3">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 mr-1.5 shrink-0" />
              HealthSync AI does not provide medical diagnoses or prescriptions.
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-health-50 via-white to-teal-50/40 pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-5 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-health-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-health-500/20 group-hover:scale-105 transition-transform duration-200">
            <Activity className="w-6 h-6" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-navy-950">
            HealthSync<span className="text-health-500">.AI</span>
          </span>
        </Link>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-navy-950 font-display">
          Create your patient account
        </h1>
        <p className="mt-2 text-sm text-navy-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-health-600 hover:text-health-700 underline-offset-4 hover:underline transition-colors">
            Sign in
          </Link>
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card className="shadow-xl shadow-slate-200/60 border-slate-200/90 backdrop-blur-sm bg-white/95">
          <CardContent className="pt-6 pb-6 px-6 sm:px-8">
            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-rose-900">Registration Notice</p>
                  <p className="text-rose-800 leading-relaxed">{error}</p>
                  {(error.includes('SUPABASE_NOT_CONFIGURED') || error.includes('configured')) && (
                    <p className="mt-1 text-[11px] text-rose-700">
                      Tip: Supabase credentials are not linked. You can explore immediately using{' '}
                      <button
                        type="button"
                        onClick={loginDemo}
                        className="font-bold underline text-health-700 hover:text-health-800 cursor-pointer"
                      >
                        Instant Demo Mode
                      </button>
                      !
                    </p>
                  )}
                </div>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="block text-xs font-bold uppercase tracking-wider text-navy-700">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-400">
                    <User className="w-4 h-4" />
                  </div>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="pl-10"
                  />
                </div>
              </div>

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
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-navy-700">
                  Password (min 8 characters)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-wider text-navy-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-navy-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Create Account
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Clinical Disclaimer */}
        <div className="mt-6 text-center flex items-center justify-center gap-1.5">
          <Badge variant="default" className="text-[11px] text-navy-600 bg-white/80 border-slate-200 py-1 px-3">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 mr-1.5 shrink-0" />
            HealthSync AI does not provide medical diagnoses or prescriptions.
          </Badge>
        </div>
      </div>
    </div>
  );
}
