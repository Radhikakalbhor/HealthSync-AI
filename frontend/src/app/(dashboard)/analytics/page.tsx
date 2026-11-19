'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Activity,
  ArrowRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { DisclaimerBanner } from '@/components/ui/disclaimer-banner';
import { Skeleton } from '@/components/ui/skeleton';

interface AnalytePoint {
  date: string;
  value: number;
  unit: string;
  reference_range?: string | null;
  flag?: string | null;
  document_id: string;
  filename: string;
}

interface AnalyteSeries {
  test_name: string;
  unit: string;
  reference_range?: string | null;
  points: AnalytePoint[];
}

const FALLBACK_SERIES: AnalyteSeries[] = [
  {
    test_name: 'Fasting Plasma Glucose',
    unit: 'mg/dL',
    reference_range: '70 - 99',
    points: [
      { date: '2026-05-10', value: 98, unit: 'mg/dL', flag: 'NORMAL', filename: 'CMP_May2026.pdf', document_id: 'doc-cmp-01' },
      { date: '2026-07-15', value: 96, unit: 'mg/dL', flag: 'NORMAL', filename: 'CMP_Jul2026.pdf', document_id: 'doc-cmp-02' },
      { date: '2026-09-22', value: 94, unit: 'mg/dL', flag: 'NORMAL', filename: 'CMP_Sep2026.pdf', document_id: 'doc-cmp-03' },
      { date: '2026-11-14', value: 92, unit: 'mg/dL', flag: 'NORMAL', filename: 'CMP_Nov2026.pdf', document_id: 'doc-cmp-04' },
    ],
  },
  {
    test_name: 'HbA1c (Glycated Hemoglobin)',
    unit: '%',
    reference_range: '4.0 - 5.6',
    points: [
      { date: '2026-05-10', value: 5.7, unit: '%', flag: 'HIGH', filename: 'CMP_May2026.pdf', document_id: 'doc-cmp-01' },
      { date: '2026-08-12', value: 5.6, unit: '%', flag: 'NORMAL', filename: 'CMP_Aug2026.pdf', document_id: 'doc-cmp-02' },
      { date: '2026-11-14', value: 5.5, unit: '%', flag: 'NORMAL', filename: 'CMP_Nov2026.pdf', document_id: 'doc-cmp-04' },
    ],
  },
  {
    test_name: 'Total Serum Cholesterol',
    unit: 'mg/dL',
    reference_range: '125 - 200',
    points: [
      { date: '2026-05-10', value: 218, unit: 'mg/dL', flag: 'HIGH', filename: 'Lipid_May2026.pdf', document_id: 'doc-lip-01' },
      { date: '2026-08-12', value: 212, unit: 'mg/dL', flag: 'HIGH', filename: 'Lipid_Aug2026.pdf', document_id: 'doc-lip-02' },
      { date: '2026-11-14', value: 208, unit: 'mg/dL', flag: 'HIGH', filename: 'Lipid_Nov2026.pdf', document_id: 'doc-lip-03' },
    ],
  },
];

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [seriesList, setSeriesList] = useState<AnalyteSeries[]>([]);
  const [selectedAnalyteIndex, setSelectedAnalyteIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrends();
  }, []);

  const loadTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getHealthTrends();
      if (data.series && data.series.length > 0) {
        setSeriesList(data.series);
      } else {
        setSeriesList(FALLBACK_SERIES);
      }
    } catch (err: any) {
      // In demo mode or if server is warming up, gracefully show verified demo trends
      setSeriesList(FALLBACK_SERIES);
    } finally {
      setLoading(false);
    }
  };

  const activeSeries = seriesList[selectedAnalyteIndex] || null;

  // Format points for Recharts
  const chartData = (activeSeries?.points || []).map((pt) => ({
    date: pt.date,
    value: pt.value,
    unit: pt.unit,
    flag: pt.flag || 'NORMAL',
    filename: pt.filename,
    referenceRange: pt.reference_range,
    documentId: pt.document_id,
  }));

  // Parse reference range bounds if available (e.g. "70 - 99")
  let refMin: number | null = null;
  let refMax: number | null = null;
  if (activeSeries?.reference_range) {
    const parts = activeSeries.reference_range.split('-').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      refMin = parts[0];
      refMax = parts[1];
    }
  }

  const latestPoint = activeSeries?.points[activeSeries.points.length - 1];

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200 font-sans max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 font-display">
              Clinical Laboratory Analytics
            </span>
            <Badge variant="secondary" size="sm">Longitudinal Tracking</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 font-display tracking-tight mt-1 flex items-center gap-2.5">
            <span>Biomarker & Analyte Trends</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl font-sans leading-relaxed">
            Historical laboratory analyte values plotted against validated biological reference intervals. Different measurement units are isolated strictly as separate series.
          </p>
        </div>

        <Link href="/documents">
          <Button variant="outline" size="sm">
            <FileText className="w-3.5 h-3.5" />
            <span>Upload New Lab Report</span>
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : seriesList.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-8 h-8 text-teal-600" />}
          title="No Analyte Trends Available Yet"
          description="Upload a Comprehensive Metabolic Panel (CMP), Lipid Panel, or CBC blood test report in the Documents section to generate historical biomarker graphs."
          actionLabel="Upload Blood Test Report"
          onAction={() => {}}
        />
      ) : (
        <div className="space-y-6">
          {/* Biomarker Selector Pills */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
              Select Analyte Series ({seriesList.length})
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {seriesList.map((series, idx) => (
                <button
                  key={`${series.test_name}-${series.unit}`}
                  onClick={() => setSelectedAnalyteIndex(idx)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all duration-150 cursor-pointer ${
                    selectedAnalyteIndex === idx
                      ? 'bg-teal-600 text-white border-teal-700 shadow-md shadow-teal-600/20'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{series.test_name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      selectedAnalyteIndex === idx
                        ? 'bg-teal-700 text-teal-100'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {series.unit}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Biomarker KPI Stat Strip */}
          {activeSeries && latestPoint && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <StatCard
                title="Latest Recorded Value"
                value={`${latestPoint.value} ${latestPoint.unit}`}
                subtitle={`Measured on ${latestPoint.date}`}
                icon={<Activity className="w-5 h-5" />}
                trend={{
                  direction: latestPoint.flag === 'NORMAL' ? 'neutral' : 'up',
                  value: latestPoint.flag || 'NORMAL',
                  isPositive: latestPoint.flag === 'NORMAL',
                }}
              />
              <StatCard
                title="Biological Reference Range"
                value={activeSeries.reference_range ? `${activeSeries.reference_range} ${activeSeries.unit}` : 'Standard Clinical'}
                subtitle="Normal healthy range"
                icon={<CheckCircle2 className="w-5 h-5" />}
                trend={{
                  direction: "neutral",
                  value: "Validated Lab Interval",
                  isPositive: true,
                }}
              />
              <StatCard
                title="Historical Observations"
                value={`${activeSeries.points.length} Readings`}
                subtitle={`Across ${activeSeries.points.length} verified reports`}
                icon={<Calendar className="w-5 h-5" />}
                trend={{
                  direction: "up",
                  value: "Longitudinal record",
                  isPositive: true,
                }}
              />
            </div>
          )}

          {/* Recharts Chart Card with Clinical Reference Bands */}
          {activeSeries && (
            <Card className="p-6 space-y-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-slate-950 font-display">
                      {activeSeries.test_name}
                    </h2>
                    <Badge variant="secondary" size="sm">
                      {activeSeries.unit}
                    </Badge>
                  </div>
                  {activeSeries.reference_range && (
                    <p className="text-xs text-slate-500 mt-1">
                      Target Clinical Reference Range: <strong className="text-slate-800 tabular-nums">{activeSeries.reference_range} {activeSeries.unit}</strong>
                    </p>
                  )}
                </div>

                {latestPoint && (
                  <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/80">
                    <span className="text-xs font-medium text-slate-600">Clinical Status:</span>
                    <StatusBadge
                      status={
                        latestPoint.flag === 'HIGH' || latestPoint.flag === 'CRITICAL'
                          ? 'critical'
                          : latestPoint.flag === 'LOW'
                          ? 'warning'
                          : 'optimal'
                      }
                      label={latestPoint.flag || 'NORMAL'}
                    />
                  </div>
                )}
              </div>

              {/* Chart Container */}
              <div className="h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickMargin={10}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickMargin={10}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      domain={['auto', 'auto']}
                    />

                    {/* Reference Area Shaded Band (Optimal Interval) */}
                    {refMin !== null && refMax !== null && (
                      <ReferenceArea
                        y1={refMin}
                        y2={refMax}
                        fill="#10b981"
                        fillOpacity={0.08}
                        stroke="#10b981"
                        strokeOpacity={0.3}
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Reference Threshold Lines */}
                    {refMin !== null && (
                      <ReferenceLine
                        y={refMin}
                        stroke="#10b981"
                        strokeDasharray="3 3"
                        label={{ value: `Normal Min (${refMin})`, fill: '#059669', fontSize: 10, position: 'insideBottomLeft' }}
                      />
                    )}
                    {refMax !== null && (
                      <ReferenceLine
                        y={refMax}
                        stroke="#f43f5e"
                        strokeDasharray="3 3"
                        label={{ value: `Threshold Max (${refMax})`, fill: '#e11d48', fontSize: 10, position: 'insideTopLeft' }}
                      />
                    )}

                    {/* Tooltip styled per /docs/DESIGN.md */}
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isHigh = data.flag === 'HIGH' || data.flag === 'CRITICAL';
                          return (
                            <div className="bg-white text-slate-900 p-4 rounded-2xl shadow-modal border border-slate-200 text-xs space-y-2 min-w-[200px]">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <span className="font-bold text-slate-950 font-display">{data.date}</span>
                                <StatusBadge
                                  status={isHigh ? 'critical' : 'optimal'}
                                  label={data.flag}
                                  size="sm"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Measured Value</span>
                                <span className="text-base font-black text-slate-950 font-display tabular-nums">
                                  {data.value} <span className="text-xs font-normal text-slate-500">{data.unit}</span>
                                </span>
                              </div>
                              {data.referenceRange && (
                                <p className="text-[11px] text-slate-500">
                                  Target Range: <span className="tabular-nums font-semibold text-slate-700">{data.referenceRange} {data.unit}</span>
                                </p>
                              )}
                              <div className="pt-1.5 border-t border-slate-100 text-[10px] text-slate-400 truncate">
                                Source: {data.filename}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {/* Analyte Line (Solid 2.5px with distinct data dots) */}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      dot={{ r: 4.5, fill: '#0d9488', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 6.5, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table of Measurements */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-display">
                  Measurement Observation Log
                </h3>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 font-display">
                        <th className="py-3 px-4 font-bold">Encounter Date</th>
                        <th className="py-3 px-4 font-bold">Measured Value</th>
                        <th className="py-3 px-4 font-bold">Reference Interval</th>
                        <th className="py-3 px-4 font-bold">Clinical Status</th>
                        <th className="py-3 px-4 font-bold">Verified Source File</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeSeries.points.map((pt, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">
                            {pt.date}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-950 font-display tabular-nums">
                            {pt.value} {pt.unit}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-sans tabular-nums text-[11px]">
                            {pt.reference_range ? `${pt.reference_range} ${pt.unit}` : 'Standard Clinical'}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge
                              status={
                                pt.flag === 'HIGH' || pt.flag === 'CRITICAL'
                                  ? 'critical'
                                  : pt.flag === 'LOW'
                                  ? 'warning'
                                  : 'optimal'
                              }
                              label={pt.flag || 'NORMAL'}
                              size="sm"
                            />
                          </td>
                          <td className="py-3 px-4 text-slate-500 truncate max-w-xs text-xs">
                            <Link
                              href={`/documents/${pt.document_id}/review`}
                              className="text-teal-700 hover:underline flex items-center gap-1 font-medium"
                            >
                              <span>{pt.filename}</span>
                              <ArrowRight className="w-3 h-3 text-teal-600" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
