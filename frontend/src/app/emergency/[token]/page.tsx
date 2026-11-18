'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  HeartPulse,
  Phone,
  Droplet,
  AlertTriangle,
  Pill,
  ShieldAlert,
  Activity,
  User,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function PublicEmergencyResponderPage() {
  const params = useParams();
  const token = params?.token as string;

  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadEmergencyCard();
    }
  }, [token]);

  const loadEmergencyCard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPublicEmergencyCard(token);
      setCard(data);
    } catch (err: any) {
      setError(err.message || 'Emergency card unavailable or disabled.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 rounded-full border-4 border-rose-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase text-rose-400">Loading Emergency Medical Profile...</p>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-base font-bold text-white">Emergency Card Inactive</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || 'This emergency medical profile has been deactivated by the patient.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Top Emergency Responder Banner */}
        <div className="bg-rose-600 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg shadow-rose-900/50">
          <div className="flex items-center gap-3">
            <HeartPulse className="w-8 h-8 animate-pulse text-white" />
            <div>
              <h1 className="font-extrabold text-base tracking-wide uppercase">Emergency Medical Card</h1>
              <p className="text-[11px] text-rose-100 font-medium">First Responder & Paramedic View</p>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Live Badge
          </span>
        </div>

        {/* Primary Blood Group & Direct Call Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Blood Group</p>
              <div className="flex items-center gap-2 mt-1">
                <Droplet className="w-6 h-6 text-rose-500" />
                <span className="text-3xl font-black text-white">
                  {card.blood_group || 'Unknown'}
                </span>
              </div>
            </div>

            {card.emergency_contact_phone && (
              <a
                href={`tel:${card.emergency_contact_phone}`}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-900/40 transition-all"
              >
                <Phone className="w-4 h-4" />
                Call Contact
              </a>
            )}
          </div>

          {/* Emergency Contact Person */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Emergency Contact Person
            </p>
            <p className="text-base font-bold text-white">
              {card.emergency_contact_name || 'Not Specified'}
            </p>
            <p className="text-xs text-slate-400">
              Relation: <span className="text-teal-400 font-medium">{card.emergency_contact_relation || 'N/A'}</span> • Phone:{' '}
              <span className="text-white font-mono">{card.emergency_contact_phone || 'N/A'}</span>
            </p>
          </div>
        </div>

        {/* Known Allergies Card (HIGH PRIORITY) */}
        <div className="bg-slate-900 border border-rose-900/60 rounded-3xl p-6 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-xs font-bold uppercase tracking-wider">Known Allergies & Sensitivities</h2>
          </div>

          {card.allergies && card.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {card.allergies.map((allergy: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold"
                >
                  {allergy}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No drug or food allergies explicitly recorded.</p>
          )}
        </div>

        {/* Confirmed Current Medications */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-teal-400">
            <Pill className="w-5 h-5" />
            <h2 className="text-xs font-bold uppercase tracking-wider">Current Confirmed Medications</h2>
          </div>

          {card.confirmed_medications && card.confirmed_medications.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {card.confirmed_medications.map((med: string, idx: number) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
                  <span className="font-semibold text-slate-200">{med}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No confirmed active medications recorded.</p>
          )}
        </div>

        {/* Critical Clinical Notes */}
        {card.critical_notes && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-2">
            <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              Critical Medical Notes
            </p>
            <p className="text-xs text-slate-200 leading-relaxed bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              {card.critical_notes}
            </p>
          </div>
        )}

        {/* Legal Medical Disclaimer */}
        <div className="p-4 text-center">
          <p className="text-[10px] text-slate-500 leading-relaxed max-w-md mx-auto">
            {card.disclaimer}
          </p>
          <p className="text-[10px] text-slate-600 mt-2 font-mono">
            Powered by HealthSync AI Emergency Responder Protocol
          </p>
        </div>
      </div>
    </div>
  );
}
