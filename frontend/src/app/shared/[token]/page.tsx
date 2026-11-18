'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  FileText,
  Clock,
  AlertCircle,
  Activity,
  Calendar,
  Pill,
  BarChart3,
  Stethoscope,
} from 'lucide-react';
import { api } from '@/lib/api';

interface SharedDoc {
  document_id: string;
  filename: string;
  document_type: string;
  date?: string | null;
  summary: string;
  extracted_data?: any;
}

export default function PublicSharedViewPage() {
  const params = useParams();
  const token = params?.token as string;

  const [shareData, setShareData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadShare();
    }
  }, [token]);

  const loadShare = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPublicShare(token);
      setShareData(data);
    } catch (err: any) {
      setError(err.message || 'Shared link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-full border-2 border-health-500 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-semibold text-navy-800">Verifying secure clinical share token...</p>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-base font-bold text-navy-950">Shared Record Unavailable</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'This temporary medical access link may have expired or been revoked by the patient.'}
          </p>
          <div className="pt-2">
            <span className="text-[11px] text-slate-400">HealthSync AI Secure Medical Gateway</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-health-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base text-navy-900">HealthSync.AI</span>
              <span className="block text-[10px] text-teal-600 font-semibold uppercase tracking-wider">
                Patient-Authorized Clinical Share
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Expires: {new Date(shareData.expires_at).toLocaleString()}</span>
          </div>
        </div>

        {/* Recipient Notice */}
        {shareData.recipient_label && (
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-xs text-teal-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>
                Authorized for: <strong>{shareData.recipient_label}</strong>
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-teal-700 bg-white px-2 py-0.5 rounded-md">
              Read-Only
            </span>
          </div>
        )}

        {/* Medical Disclaimer */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 text-xs text-slate-500">
          <p className="leading-relaxed">{shareData.disclaimer}</p>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-navy-950 uppercase tracking-wider">
            Permitted Medical Records ({shareData.documents?.length || 0})
          </h2>

          <div className="space-y-4">
            {shareData.documents?.map((doc: SharedDoc) => (
              <div
                key={doc.document_id}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-health-600" />
                    <div>
                      <h3 className="text-sm font-bold text-navy-950">{doc.filename}</h3>
                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                        {doc.document_type.replace('_', ' ')} • {doc.date || 'Date Unspecified'}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                    Verified
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{doc.summary}</p>

                {/* Structured Extraction details if present */}
                {doc.extracted_data && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 text-xs">
                    <p className="font-semibold text-navy-900 text-[11px] uppercase tracking-wider">
                      Structured Clinical Information
                    </p>

                    {/* Medications */}
                    {doc.extracted_data.medications && doc.extracted_data.medications.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="font-medium text-slate-600 flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5 text-teal-600" />
                          Prescribed Medications:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {doc.extracted_data.medications.map((m: any, idx: number) => (
                            <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200">
                              <p className="font-bold text-navy-950">{m.name} {m.dosage}</p>
                              <p className="text-[11px] text-slate-500">{m.frequency} {m.instructions ? `• ${m.instructions}` : ''}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lab results */}
                    {doc.extracted_data.results && doc.extracted_data.results.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="font-medium text-slate-600 flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-health-600" />
                          Laboratory Results:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {doc.extracted_data.results.map((r: any, idx: number) => (
                            <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                              <div>
                                <p className="font-bold text-navy-950">{r.test_name}</p>
                                <p className="text-[10px] text-slate-400">Ref: {r.reference_range || 'N/A'}</p>
                              </div>
                              <span className="font-bold text-sm text-navy-900">{r.value} {r.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
