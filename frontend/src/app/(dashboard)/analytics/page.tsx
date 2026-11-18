'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  AlertTriangle,
  Info,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
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
} from 'recharts';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

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

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [seriesList, setSeriesList] = useState<AnalyteSeries[]>([]);
  const [selectedAnalyteIndex, setSelectedAnalyteIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrends();
  }, []);

  const loadTrends = async () => {
    setLoading(true);
    try {
      const data = await api.getHealthTrends();
      setSeriesList(data.series || []);
    } catch (err) {
      console.error('Failed to load biomarker trends:', err);
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-950 tracking-tight flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-health-600" />
          {t('analytics_title')}
        </h1>
        <p className="text-sm text-navy-600 mt-1">{t('analytics_subtitle')}</p>
      </div>

      {/* Safety Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">Clinical Data Integrity Notice</p>
          <p className="leading-relaxed">
            Biomarker values are extracted verbatim from patient-uploaded lab reports. Different measurement units are graphed strictly as distinct series. HealthSync AI does NOT diagnose health conditions or predict illness. Always consult your healthcare provider.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-navy-500 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-health-500 border-t-transparent animate-spin mb-3" />
          Plotting biomarker longitudinal trends...
        </div>
      ) : seriesList.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-navy-800">{t('analytics_no_data')}</p>
          <p className="text-xs text-navy-500 mt-1 max-w-md mx-auto">
            Upload blood test reports or CBC panels in the Documents section to unlock historical biomarker charts.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Biomarker Selector Tabs */}
          <div className="flex flex-wrap gap-2">
            {seriesList.map((series, idx) => (
              <button
                key={`${series.test_name}-${series.unit}`}
                onClick={() => setSelectedAnalyteIndex(idx)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                  selectedAnalyteIndex === idx
                    ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
                    : 'bg-white text-navy-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>{series.test_name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    selectedAnalyteIndex === idx
                      ? 'bg-navy-800 text-teal-300'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {series.unit}
                </span>
              </button>
            ))}
          </div>

          {/* Active Biomarker Details & Graph */}
          {activeSeries && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-navy-950">
                      {activeSeries.test_name}
                    </h2>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-md">
                      Unit: {activeSeries.unit}
                    </span>
                  </div>
                  {activeSeries.reference_range && (
                    <p className="text-xs text-navy-500 mt-1">
                      Standard Reference Range: <span className="font-semibold text-navy-800">{activeSeries.reference_range} {activeSeries.unit}</span>
                    </p>
                  )}
                </div>

                {latestPoint && (
                  <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-500">Most Recent Reading</p>
                      <p className="text-base font-bold text-navy-950">
                        {latestPoint.value} <span className="text-xs font-normal text-slate-500">{latestPoint.unit}</span>
                      </p>
                    </div>
                    {latestPoint.flag && latestPoint.flag !== 'NORMAL' ? (
                      <span className="text-xs font-bold px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        {latestPoint.flag}
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        NORMAL
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Recharts Line Visualization */}
              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-navy-950 text-white p-3 rounded-xl shadow-xl text-xs space-y-1">
                              <p className="font-semibold text-teal-400">{data.date}</p>
                              <p className="text-sm font-bold">
                                {data.value} {data.unit}
                              </p>
                              {data.referenceRange && (
                                <p className="text-[10px] text-slate-300">
                                  Ref: {data.referenceRange}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400">
                                Status: <span className={data.flag === 'NORMAL' ? 'text-emerald-400' : 'text-amber-400'}>{data.flag}</span>
                              </p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                Source: {data.filename}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {refMin !== null && (
                      <ReferenceLine y={refMin} stroke="#10b981" strokeDasharray="3 3" label={{ value: `Min: ${refMin}`, fill: '#10b981', fontSize: 10 }} />
                    )}
                    {refMax !== null && (
                      <ReferenceLine y={refMax} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: `Max: ${refMax}`, fill: '#f43f5e', fontSize: 10 }} />
                    )}

                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0284c7"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#0284c7', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 7, fill: '#0369a1' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table of Measurements */}
              <div className="overflow-x-auto border-t border-slate-100 pt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="pb-2 font-semibold">Test Date</th>
                      <th className="pb-2 font-semibold">Measured Value</th>
                      <th className="pb-2 font-semibold">Reference Range</th>
                      <th className="pb-2 font-semibold">Diagnostic Flag</th>
                      <th className="pb-2 font-semibold">Source Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeSeries.points.map((pt, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 font-medium text-navy-900">{pt.date}</td>
                        <td className="py-2.5 font-bold text-navy-950">
                          {pt.value} {pt.unit}
                        </td>
                        <td className="py-2.5 text-navy-600">
                          {pt.reference_range ? `${pt.reference_range} ${pt.unit}` : 'Not Specified'}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pt.flag === 'NORMAL'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {pt.flag || 'NORMAL'}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-500 truncate max-w-xs">{pt.filename}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
