'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Search,
  Filter,
  FileText,
  Calendar,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Upload,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api';
import { LabResultItem } from '@/types';
import { UploadModal } from '@/components/documents/UploadModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LabResultEntry {
  result: LabResultItem;
  labName?: string | null;
  testDate?: string | null;
  documentId: string;
  documentFilename: string;
}

export default function LabReportsPage() {
  const [loading, setLoading] = useState(true);
  const [labEntries, setLabEntries] = useState<LabResultEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFlag, setFilterFlag] = useState<string>('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const fetchLabData = async () => {
    setLoading(true);
    try {
      const data = await api.listDocuments(100, 0);
      const docs = data.documents || [];

      const entries: LabResultEntry[] = [];
      for (const doc of docs) {
        const ext = (doc.extracted_data || (doc as any).extraction_result?.structured_data) as any;
        const results = ext?.results || ext?.tests;
        if (Array.isArray(results)) {
          for (const item of results) {
            entries.push({
              result: {
                ...item,
                value: item.value || item.measured_value || '',
                flag: item.flag || (item.is_abnormal ? 'HIGH' : 'NORMAL'),
              },
              labName: ext.lab_name || ext.doctor_or_lab_name || null,
              testDate: ext.test_date || ext.report_date || null,
              documentId: doc.id,
              documentFilename: doc.filename,
            });
          }
        }
      }
      setLabEntries(entries);
    } catch {
      setLabEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabData();

    const handleUploadEvent = () => fetchLabData();
    window.addEventListener('healthsync-record-uploaded', handleUploadEvent);
    return () => window.removeEventListener('healthsync-record-uploaded', handleUploadEvent);
  }, []);

  const filtered = labEntries.filter((item) => {
    const term = (searchTerm || '').trim().toLowerCase();
    const testName = (item.result?.test_name || '').toLowerCase();
    const docName = (item.documentFilename || '').toLowerCase();
    const matchesSearch = !term || testName.includes(term) || docName.includes(term);

    const matchesFlag =
      filterFlag === 'all' ||
      (filterFlag === 'abnormal' && item.result?.flag && item.result.flag !== 'NORMAL') ||
      item.result?.flag === filterFlag;

    return matchesSearch && matchesFlag;
  });

  // Prepare chart data for numeric analytes
  const numericData = filtered
    .filter((e) => {
      const num = parseFloat(e.result.value);
      return !isNaN(num) && isFinite(num);
    })
    .slice(0, 10)
    .map((e) => ({
      name: e.result.test_name.length > 14 ? `${e.result.test_name.slice(0, 12)}…` : e.result.test_name,
      value: parseFloat(e.result.value),
      unit: e.result.unit || '',
      flag: e.result.flag,
    }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight font-display">
            Diagnostic & Lab Reports
          </h1>
          <p className="text-xs sm:text-sm text-navy-500 mt-1 font-sans">
            Biomarker concentrations, reference ranges, and laboratory anomaly flags
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsUploadOpen(true)}
          className="shadow-md shadow-health-600/20"
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Upload Lab Report
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search analyte (e.g. Hemoglobin, Glucose, Cholesterol, HbA1c)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterFlag}
            onChange={(e) => setFilterFlag(e.target.value)}
            className="w-full sm:w-auto text-xs font-semibold border border-slate-300 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-800 bg-white"
          >
            <option value="all">All Results</option>
            <option value="abnormal">Abnormal Flags (High / Low / Critical)</option>
            <option value="HIGH">High Only</option>
            <option value="LOW">Low Only</option>
            <option value="NORMAL">Normal Only</option>
          </select>
        </div>
      </Card>

      {/* Chart Section (if numeric data exists) */}
      {numericData.length > 0 && (
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <h2 className="text-xs font-bold text-navy-900 uppercase tracking-wider font-display">
                Extracted Numeric Biomarkers Overview
              </h2>
            </div>
            <span className="text-[11px] text-navy-400 font-medium">Latest test readings</span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={numericData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any, name: any, item: any) => [
                    `${val} ${item.payload.unit || ''}`,
                    item.payload.name,
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px', border: '1px solid #1e293b' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {numericData.map((entry, index) => {
                    const isAbnormal = entry.flag === 'HIGH' || entry.flag === 'CRITICAL';
                    const isLow = entry.flag === 'LOW';
                    const fillColor = isAbnormal ? '#e11d48' : isLow ? '#d97706' : '#0284c7';
                    return <Cell key={`cell-${index}`} fill={fillColor} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Lab Results Table / Cards */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-7 h-7 border-2 border-health-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-navy-500">Scanning laboratory report records...</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-base text-navy-900 font-display">
              {searchTerm || filterFlag !== 'all'
                ? 'No lab results match your filter'
                : 'No laboratory results recorded yet'}
            </h3>
            <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Upload a blood test, pathology report, or diagnostic PDF. HealthSync AI will parse each analyte, unit, and reference interval.
            </p>
            <div className="mt-5">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsUploadOpen(true)}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Upload Diagnostic Document
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-navy-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Test / Analyte</th>
                  <th className="py-3.5 px-4">Observed Value</th>
                  <th className="py-3.5 px-4">Reference Range</th>
                  <th className="py-3.5 px-4">Diagnostic Flag</th>
                  <th className="py-3.5 px-4">Source Document</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-navy-800">
                {filtered.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-navy-950 font-display">
                      {item.result.test_name}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-navy-900 font-mono">
                      {item.result.value}{' '}
                      <span className="text-[11px] font-normal text-navy-500">
                        {item.result.unit || ''}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-navy-500 font-mono text-[11px]">
                      {item.result.reference_range || 'Not specified'}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          item.result.flag === 'HIGH' || item.result.flag === 'CRITICAL'
                            ? 'high'
                            : item.result.flag === 'LOW'
                            ? 'pending'
                            : 'normal'
                        }
                        className="text-[10px]"
                      >
                        {item.result.flag || 'NORMAL'}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-navy-400 truncate max-w-xs">
                      {item.documentFilename}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/documents/${item.documentId}/review`}
                        className="inline-flex items-center gap-1 font-bold text-health-600 hover:text-health-700 transition-colors"
                      >
                        Review
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Medical Disclaimer */}
      <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5 shadow-sm">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Reference ranges and abnormal flags are extracted verbatim from the diagnostic laboratory report. HealthSync AI does not assess clinical significance or recommend medical treatments.
        </p>
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => fetchLabData()}
      />
    </div>
  );
}
