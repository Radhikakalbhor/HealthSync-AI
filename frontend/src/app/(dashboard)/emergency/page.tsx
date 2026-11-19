'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  HeartPulse,
  Phone,
  Droplet,
  AlertCircle,
  Pill,
  Save,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  User,
  Plus,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EmergencyCardPage() {
  const { t } = useTranslation();
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form states
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [criticalNotes, setCriticalNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Tag lists
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergy, setNewAllergy] = useState('');
  const [medications, setMedications] = useState<string[]>([]);
  const [newMed, setNewMed] = useState('');

  useEffect(() => {
    loadCard();
  }, []);

  const loadCard = async () => {
    setLoading(true);
    try {
      const data = await api.getEmergencyCard();
      setCard(data);
      setContactName(data.emergency_contact_name || '');
      setContactPhone(data.emergency_contact_phone || '');
      setContactRelation(data.emergency_contact_relation || '');
      setBloodGroup(data.blood_group || '');
      setCriticalNotes(data.critical_notes || '');
      setIsActive(data.is_active ?? true);
      setAllergies(data.allergies || []);
      setMedications(data.confirmed_medications || []);
    } catch (err) {
      console.error('Failed to load emergency card:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateEmergencyCard({
        emergency_contact_name: contactName,
        emergency_contact_phone: contactPhone,
        emergency_contact_relation: contactRelation,
        blood_group: bloodGroup,
        allergies,
        confirmed_medications: medications,
        critical_notes: criticalNotes,
        is_active: isActive,
      });
      setCard(updated);
      alert('Emergency Health Card updated successfully!');
    } catch (err) {
      console.error('Failed to update emergency card:', err);
      alert('Failed to save emergency card settings.');
    } finally {
      setSaving(false);
    }
  };

  const addAllergy = () => {
    if (newAllergy.trim() && !allergies.includes(newAllergy.trim())) {
      setAllergies([...allergies, newAllergy.trim()]);
      setNewAllergy('');
    }
  };

  const removeAllergy = (item: string) => {
    setAllergies(allergies.filter((a) => a !== item));
  };

  const addMedication = () => {
    if (newMed.trim() && !medications.includes(newMed.trim())) {
      setMedications([...medications, newMed.trim()]);
      setNewMed('');
    }
  };

  const removeMedication = (item: string) => {
    setMedications(medications.filter((m) => m !== item));
  };

  const copyEmergencyLink = () => {
    if (!card?.emergency_token) return;
    const url = `${window.location.origin}/emergency/${card.emergency_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight flex items-center gap-2.5 font-display">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <HeartPulse className="w-5 h-5" />
          </div>
          {t('emergency_title')}
        </h1>
        <p className="text-sm text-navy-600 mt-1 max-w-2xl font-sans">{t('emergency_subtitle')}</p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-20 text-center text-sm text-navy-500 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin mb-3" />
            Loading emergency card data...
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form Configuration */}
          <div className="lg:col-span-2">
            <Card className="p-6 sm:p-8 shadow-sm">
              <form onSubmit={handleSave} className="space-y-6">
                <h2 className="text-base font-bold text-navy-950 border-b border-slate-100 pb-3 flex items-center gap-2 font-display">
                  <User className="w-4 h-4 text-health-600" />
                  Emergency Contact & Vitals
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                      {t('emergency_contact')}
                    </label>
                    <Input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Full name of emergency contact"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                      {t('emergency_relation')}
                    </label>
                    <Input
                      type="text"
                      value={contactRelation}
                      onChange={(e) => setContactRelation(e.target.value)}
                      placeholder="e.g. Spouse, Parent, Sibling"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                      {t('emergency_phone')}
                    </label>
                    <Input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                      {t('emergency_blood_group')}
                    </label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-navy-900 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">Unknown / Select Blood Group</option>
                      <option value="O+">O Positive (O+)</option>
                      <option value="O-">O Negative (O-)</option>
                      <option value="A+">A Positive (A+)</option>
                      <option value="A-">A Negative (A-)</option>
                      <option value="B+">B Positive (B+)</option>
                      <option value="B-">B Negative (B-)</option>
                      <option value="AB+">AB Positive (AB+)</option>
                      <option value="AB-">AB Negative (AB-)</option>
                    </select>
                  </div>
                </div>

                {/* Allergies Tag Input */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                    {t('emergency_allergies')}
                  </label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      type="text"
                      value={newAllergy}
                      onChange={(e) => setNewAllergy(e.target.value)}
                      placeholder="e.g. Penicillin, Peanuts, Sulfa"
                      className="flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addAllergy}
                      className="text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                    {allergies.map((allergy) => (
                      <span
                        key={allergy}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-1.5"
                      >
                        {allergy}
                        <button
                          type="button"
                          onClick={() => removeAllergy(allergy)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Confirmed Medications Tag Input */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                    {t('emergency_meds')}
                  </label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      type="text"
                      value={newMed}
                      onChange={(e) => setNewMed(e.target.value)}
                      placeholder="e.g. Metformin 500mg, Lisinopril 10mg"
                      className="flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addMedication}
                      className="text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                    {medications.map((med) => (
                      <span
                        key={med}
                        className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-medium flex items-center gap-1.5"
                      >
                        {med}
                        <button
                          type="button"
                          onClick={() => removeMedication(med)}
                          className="text-teal-500 hover:text-teal-700 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Critical Notes */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy-800">
                    {t('emergency_notes')}
                  </label>
                  <textarea
                    value={criticalNotes}
                    onChange={(e) => setCriticalNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. Has pacemaker implanted in 2024. Asthmatic, carries inhaler. Diabetic type 2."
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 text-navy-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="danger"
                    size="md"
                    loading={saving}
                    className="shadow-sm font-semibold"
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    {saving ? 'Saving...' : t('btn_save')}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Right Column: Physical QR Badge Card */}
          <div>
            <div className="bg-gradient-to-b from-navy-950 to-navy-900 text-white rounded-3xl p-6 shadow-xl border border-navy-800 space-y-6 text-center">
              <div className="flex items-center justify-center gap-2 text-rose-400">
                <HeartPulse className="w-6 h-6 animate-pulse" />
                <span className="font-bold text-sm tracking-wide uppercase font-display">Emergency Medical Badge</span>
              </div>

              {/* QR Image Display */}
              {card?.qr_code_data_url && (
                <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.qr_code_data_url}
                    alt="Emergency QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
              )}

              <p className="text-xs text-slate-300 font-sans">
                {t('emergency_scan_qr')}
              </p>

              {/* Blood group indicator */}
              {bloodGroup && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold font-mono">
                  <Droplet className="w-4 h-4" />
                  Blood Group: {bloodGroup}
                </div>
              )}

              {/* Public link copy action */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyEmergencyLink}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  {copied ? <Check className="w-4 h-4 mr-1.5 text-teal-400" /> : <Copy className="w-4 h-4 mr-1.5" />}
                  {copied ? t('status_copied') : t('btn_copy_link')}
                </Button>

                {card?.emergency_token && (
                  <Link
                    href={`/emergency/${card.emergency_token}`}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-1.5 py-1.5 text-xs text-teal-400 hover:text-teal-300 font-semibold transition-colors"
                  >
                    <span>Open Public Responder View</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
