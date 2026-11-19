'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Pill,
  Trash2,
  Power,
  BarChart3,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { api } from '@/lib/api';
import {
  MedicationReminder,
  MedicationSchedule,
  AdherenceStats,
  FrequencyType,
} from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RemindersPage() {
  const [todayReminders, setTodayReminders] = useState<MedicationReminder[]>([]);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [adherence, setAdherence] = useState<AdherenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');

  // New schedule form state
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>('ONCE_DAILY');
  const [reminderTimes, setReminderTimes] = useState<string>('09:00');
  const [instructions, setInstructions] = useState('');
  const [userConfirmed, setUserConfirmed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rems, scheds, stats] = await Promise.all([
        api.getTodayReminders(),
        api.listSchedules(),
        api.getAdherenceStats(7),
      ]);
      setTodayReminders(rems || []);
      setSchedules(scheds || []);
      setAdherence(stats || null);
    } catch {
      // Fallback empty states
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleRequestNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        new Notification('HealthSync AI Reminders Active', {
          body: 'You will receive scheduled dosage reminders directly in your browser.',
        });
      }
    }
  };

  const handleLogAction = async (reminderId: string, action: 'TAKEN' | 'SKIPPED') => {
    try {
      await api.logDoseAction(reminderId, action);
      fetchData();
    } catch (err: any) {
      alert(`Could not update dose: ${err?.message || 'Error'}`);
    }
  };

  const handleToggleSchedule = async (schedule: MedicationSchedule) => {
    try {
      await api.updateSchedule(schedule.id, { is_active: !schedule.is_active });
      fetchData();
    } catch (err: any) {
      alert(`Could not toggle schedule: ${err?.message || 'Error'}`);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this medication schedule?')) return;
    try {
      await api.deleteSchedule(scheduleId);
      fetchData();
    } catch (err: any) {
      alert(`Could not delete schedule: ${err?.message || 'Error'}`);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) {
      alert('Medication name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const timesArray = reminderTimes
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await api.createSchedule({
        medication_name: medName.trim(),
        dosage: dosage.trim() || undefined,
        frequency,
        reminder_times: timesArray.length > 0 ? timesArray : ['09:00'],
        timezone: 'UTC',
        instructions: instructions.trim() || undefined,
        user_confirmed: userConfirmed,
      });

      setModalOpen(false);
      setMedName('');
      setDosage('');
      setInstructions('');
      fetchData();
    } catch (err: any) {
      alert(`Error creating schedule: ${err?.message || 'Validation error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight font-display">
            Smart Medication Reminders
          </h1>
          <p className="text-xs sm:text-sm text-navy-500 mt-1 font-sans">
            Prescription-synchronized dose tracking, daily schedules, and weekly adherence
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {notificationPermission !== 'granted' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestNotifications}
              className="text-teal-800 bg-teal-50 hover:bg-teal-100 border-teal-200"
            >
              <Bell className="w-3.5 h-3.5 mr-1 text-teal-600" />
              Enable Browser Alerts
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            onClick={() => setModalOpen(true)}
            className="shadow-md shadow-health-600/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Reminder Schedule
          </Button>
        </div>
      </div>

      {/* Main Grid: Today's Reminders & Weekly Adherence Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Today's Medication Doses */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy-900 flex items-center gap-2 font-display">
              <Calendar className="w-4 h-4 text-health-600" />
              <span>Today&apos;s Dosage Schedule</span>
            </h2>
            <span className="text-xs text-navy-400 font-semibold font-mono">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="w-7 h-7 border-2 border-health-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-navy-500">Checking scheduled doses...</p>
              </CardContent>
            </Card>
          ) : todayReminders.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-navy-900 font-display">No pending doses for today</h3>
                <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto">
                  All medications are logged, or no active confirmed reminder schedules are active.
                </p>
                <div className="mt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setModalOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Schedule Medication
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {todayReminders.map((dose) => {
                const doseTime = new Date(dose.scheduled_for).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isTaken = dose.status === 'TAKEN';
                const isSkipped = dose.status === 'SKIPPED';

                return (
                  <Card
                    key={dose.id}
                    className={`p-4 sm:p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isTaken
                        ? 'bg-teal-50/50 border-teal-200'
                        : isSkipped
                        ? 'bg-slate-50 border-slate-200 opacity-70'
                        : 'hover:border-health-300'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                          isTaken
                            ? 'bg-teal-100 text-teal-700'
                            : isSkipped
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-health-50 text-health-600'
                        }`}
                      >
                        <Pill className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-navy-950 text-sm font-display">{dose.medication_name}</h3>
                          {dose.dosage && (
                            <Badge variant="default" className="text-[10px] font-mono">
                              {dose.dosage}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-navy-500 mt-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">Scheduled for {doseTime}</span>
                          {dose.instructions && (
                            <>
                              <span>•</span>
                              <span className="italic truncate max-w-xs">{dose.instructions}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isTaken ? (
                        <Badge variant="verified" className="text-xs py-1 px-3 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Dose Taken
                        </Badge>
                      ) : isSkipped ? (
                        <Badge variant="default" className="text-xs py-1 px-3 flex items-center gap-1 font-bold">
                          <XCircle className="w-3.5 h-3.5" />
                          Skipped
                        </Badge>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleLogAction(dose.id, 'TAKEN')}
                            className="bg-teal-600 hover:bg-teal-500 text-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Mark Taken
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLogAction(dose.id, 'SKIPPED')}
                            className="text-xs text-slate-600 hover:bg-slate-100"
                          >
                            Skip
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Weekly Adherence Statistics & Chart */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider font-display">
                  Weekly Adherence
                </h3>
              </div>
              <span
                className={`text-sm font-extrabold font-mono ${
                  adherence?.adherence_percentage !== null &&
                  adherence?.adherence_percentage !== undefined &&
                  (adherence?.total_scheduled ?? 0) > 0
                    ? 'text-teal-700'
                    : 'text-slate-500 font-medium text-xs'
                }`}
              >
                {adherence?.adherence_percentage !== null &&
                adherence?.adherence_percentage !== undefined &&
                (adherence?.total_scheduled ?? 0) > 0
                  ? `${adherence.adherence_percentage}%`
                  : 'No adherence data'}
              </span>
            </div>

            {/* Adherence Chart */}
            {adherence && (adherence.total_scheduled ?? 0) > 0 && adherence.daily_breakdown.length > 0 ? (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={adherence.daily_breakdown} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(d).toLocaleDateString([], { weekday: 'narrow' })}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} doses`, name === 'taken' ? 'Taken' : 'Scheduled']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '11px', border: '1px solid #1e293b' }}
                    />
                    <Bar dataKey="taken" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center text-xs text-navy-400 text-center px-4">
                No adherence data available yet. Adherence calculates automatically as doses are scheduled.
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-center text-xs mt-3">
              <div>
                <p className="font-bold text-navy-900 font-mono">{adherence?.total_scheduled ?? 0}</p>
                <p className="text-[10px] text-navy-400 uppercase mt-0.5 font-bold">Scheduled</p>
              </div>
              <div>
                <p className="font-bold text-teal-700 font-mono">{adherence?.total_taken ?? 0}</p>
                <p className="text-[10px] text-navy-400 uppercase mt-0.5 font-bold">Taken</p>
              </div>
              <div>
                <p className="font-bold text-amber-700 font-mono">{adherence?.total_skipped ?? 0}</p>
                <p className="text-[10px] text-navy-400 uppercase mt-0.5 font-bold">Skipped</p>
              </div>
            </div>
          </Card>

          {/* Safety Rule Card */}
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 shadow-sm">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Critical Medication Safety:</strong> If you miss a dose,{' '}
                <strong>NEVER take a double dose</strong> to make up for it. Always consult your doctor or pharmacist if unsure.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Schedules Management */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider font-display">
              Medication Schedule Roster ({schedules.length})
            </h2>
            <p className="text-xs text-navy-500">
              Active routines verified and confirmed by you
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="text-health-600 hover:text-health-700 bg-health-50 hover:bg-health-100 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Schedule
          </Button>
        </div>

        {schedules.length === 0 ? (
          <div className="py-8 text-center text-xs text-navy-400">
            No medication schedules configured yet. Click &apos;Add Reminder Schedule&apos; to set one up.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 rounded-xl px-2 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy-900 text-sm font-display">{s.medication_name}</span>
                    {s.dosage && (
                      <span className="text-xs font-semibold text-teal-700 font-mono">({s.dosage})</span>
                    )}
                    {!s.is_active && (
                      <Badge variant="default" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-navy-500 mt-1">
                    <span className="capitalize">{s.frequency.replace(/_/g, ' ').toLowerCase()}</span>
                    <span>•</span>
                    <span className="font-mono">Times: {s.reminder_times.join(', ')}</span>
                    {s.instructions && (
                      <>
                        <span>•</span>
                        <span className="italic">{s.instructions}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleSchedule(s)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      s.is_active
                        ? 'text-teal-700 hover:bg-teal-50'
                        : 'text-slate-400 hover:bg-slate-100'
                    }`}
                    title={s.is_active ? 'Deactivate Schedule' : 'Activate Schedule'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(s.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Schedule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Schedule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="relative w-full max-w-md bg-white p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-navy-900 border-b border-slate-100 pb-3 flex items-center gap-2 font-display">
              <Pill className="w-4 h-4 text-health-600" />
              <span>Create Medication Schedule</span>
            </h3>

            <form onSubmit={handleCreateSchedule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                  Medication Name *
                </label>
                <Input
                  type="text"
                  required
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="e.g. Amoxicillin, Metformin"
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                    Dosage
                  </label>
                  <Input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. 500mg, 10ml"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as FrequencyType)}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2.5 text-navy-900 bg-white focus:outline-none focus:ring-2 focus:ring-health-500"
                  >
                    <option value="ONCE_DAILY">Once Daily</option>
                    <option value="TWICE_DAILY">Twice Daily</option>
                    <option value="THREE_TIMES_DAILY">Three Times Daily</option>
                    <option value="CUSTOM">Custom Schedule</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                  Reminder Times (24h format, comma separated)
                </label>
                <Input
                  type="text"
                  value={reminderTimes}
                  onChange={(e) => setReminderTimes(e.target.value)}
                  placeholder="08:00, 20:00"
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy-700 mb-1">
                  Instructions
                </label>
                <Input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Take with food"
                  className="text-xs"
                />
              </div>

              {/* Explicit User Confirmation Requirement */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="confirmDose"
                  checked={userConfirmed}
                  onChange={(e) => setUserConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-health-600 focus:ring-health-500 cursor-pointer"
                />
                <label htmlFor="confirmDose" className="text-[11px] text-navy-700 cursor-pointer font-medium">
                  I confirm that this medication schedule accurately reflects my doctor&apos;s prescription.
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                >
                  Save Schedule
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
