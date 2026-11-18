'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Filter,
  Search,
  FileText,
  Pill,
  BarChart3,
  Stethoscope,
  Activity,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

interface TimelineEvent {
  id: string;
  document_id: string;
  event_date: string;
  title: string;
  document_type: string;
  facility_or_doctor?: string | null;
  summary: string;
  key_items: string[];
  confidence?: number | null;
  needs_review: boolean;
  created_at: string;
}

export default function TimelinePage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const res = await api.getTimeline(category, startDate, endDate, search);
      setEvents(res.events || []);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, [category, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTimeline();
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'prescription':
        return <Pill className="w-5 h-5 text-teal-600" />;
      case 'blood_test':
      case 'laboratory_report':
        return <BarChart3 className="w-5 h-5 text-health-600" />;
      case 'imaging_report':
        return <Activity className="w-5 h-5 text-indigo-600" />;
      default:
        return <Stethoscope className="w-5 h-5 text-sky-600" />;
    }
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'prescription':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'blood_test':
      case 'laboratory_report':
        return 'bg-health-50 text-health-700 border-health-200';
      case 'imaging_report':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-950 tracking-tight flex items-center gap-2">
          <Calendar className="w-7 h-7 text-health-600" />
          {t('timeline_title')}
        </h1>
        <p className="text-sm text-navy-600 mt-1">{t('timeline_subtitle')}</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl">
            {[
              { id: 'all', label: t('timeline_all') },
              { id: 'prescription', label: t('timeline_prescriptions') },
              { id: 'blood_test', label: t('timeline_labs') },
              { id: 'imaging_report', label: t('timeline_imaging') },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  category === tab.id
                    ? 'bg-white text-navy-900 shadow-sm'
                    : 'text-navy-600 hover:text-navy-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date range filters */}
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-navy-800 text-xs focus:ring-1 focus:ring-health-500"
              placeholder="From"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-navy-800 text-xs focus:ring-1 focus:ring-health-500"
              placeholder="To"
            />
          </div>
        </div>

        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('timeline_search_placeholder')}
            className="w-full pl-10 pr-24 py-2 text-xs rounded-xl border border-slate-200 text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-health-500/20 focus:border-health-500"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-medium"
          >
            Search
          </button>
        </form>
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div className="py-16 text-center text-sm text-navy-500 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-health-500 border-t-transparent animate-spin mb-3" />
          Aggregating verified clinical events...
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-navy-800">No medical events recorded</p>
          <p className="text-xs text-navy-500 mt-1 max-w-md mx-auto">
            Upload prescriptions, blood test results, or diagnostic scans to build your chronological medical timeline.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 md:pl-8 border-l-2 border-slate-200 space-y-6 my-6">
          {events.map((event) => (
            <div key={event.id} className="relative group">
              {/* Event node dot */}
              <div className="absolute -left-[31px] md:-left-[39px] top-4 w-7 h-7 rounded-full bg-white border-2 border-health-500 flex items-center justify-center shadow-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-health-600" />
              </div>

              {/* Event Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-health-300 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                      {getEventIcon(event.document_type)}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-navy-950 group-hover:text-health-700 transition-colors">
                        {event.title}
                      </h3>
                      {event.facility_or_doctor && (
                        <p className="text-xs font-medium text-teal-700 flex items-center gap-1 mt-0.5">
                          <Stethoscope className="w-3 h-3" />
                          {event.facility_or_doctor}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getEventBadgeColor(
                        event.document_type
                      )}`}
                    >
                      {event.document_type.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-semibold text-navy-500 flex items-center gap-1 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-100">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {event.event_date}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-navy-700 leading-relaxed mb-3">
                  {event.summary}
                </p>

                {/* Key items chips */}
                {event.key_items && event.key_items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {event.key_items.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md text-navy-800"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {/* Card Footer: Confidence & Navigation */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3">
                    {event.confidence !== null && event.confidence !== undefined && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-teal-600" />
                        AI Extraction Confidence: {(event.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {event.needs_review && (
                      <span className="text-[10px] text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        Verification Recommended
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/documents/${event.document_id}/review`}
                    className="inline-flex items-center gap-1 font-semibold text-health-600 hover:text-health-700 text-xs"
                  >
                    View Record
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
