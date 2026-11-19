'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Pill,
  Search,
  Filter,
  FileText,
  Calendar,
  Clock,
  User,
  Upload,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { MedicalDocument, MedicationItem } from '@/types';
import { UploadModal } from '@/components/documents/UploadModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PrescribedMedicationEntry {
  medication: MedicationItem;
  doctorName?: string | null;
  prescriptionDate?: string | null;
  clinicName?: string | null;
  documentId: string;
  documentFilename: string;
}

export default function PrescriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [medicationsList, setMedicationsList] = useState<PrescribedMedicationEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const fetchPrescriptionData = async () => {
    setLoading(true);
    try {
      const data = await api.listDocuments(100, 0);
      const docs = data.documents || [];

      const entries: PrescribedMedicationEntry[] = [];
      for (const doc of docs) {
        const ext = (doc.extracted_data || (doc as any).extraction_result?.structured_data) as any;
        const meds = ext?.medications || ext?.discharge_medications;
        if (Array.isArray(meds)) {
          for (const med of meds) {
            entries.push({
              medication: med,
              doctorName: ext.doctor_name || ext.hospital_name || null,
              prescriptionDate: ext.prescription_date || ext.discharge_date || null,
              clinicName: ext.clinic_name || ext.clinic_or_hospital || ext.hospital_name || null,
              documentId: doc.id,
              documentFilename: doc.filename,
            });
          }
        }
      }
      setMedicationsList(entries);
    } catch {
      setMedicationsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptionData();

    const handleUploadEvent = () => fetchPrescriptionData();
    window.addEventListener('healthsync-record-uploaded', handleUploadEvent);
    return () => window.removeEventListener('healthsync-record-uploaded', handleUploadEvent);
  }, []);

  const filtered = medicationsList.filter((entry) => {
    const term = (searchTerm || '').trim().toLowerCase();
    const medName = (entry.medication?.name || '').toLowerCase();
    const docName = (entry.doctorName || '').toLowerCase();
    const docFile = (entry.documentFilename || '').toLowerCase();
    return !term || medName.includes(term) || docName.includes(term) || docFile.includes(term);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight font-display">
            Prescription & Medication Manager
          </h1>
          <p className="text-xs sm:text-sm text-navy-500 mt-1 font-sans">
            Active medication schedules extracted verbatim from verified prescription documents
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsUploadOpen(true)}
          className="shadow-md shadow-health-600/20"
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Upload Prescription
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="p-4 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search medications by name, prescribing doctor, or prescription source..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-xs sm:text-sm"
          />
        </div>
      </Card>

      {/* Medication Cards / Table */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-7 h-7 border-2 border-health-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-navy-500">Scanning prescription records...</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
              <Pill className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-base text-navy-900 font-display">
              {searchTerm ? 'No medications match your search' : 'No prescription medications found'}
            </h3>
            <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {searchTerm
                ? 'Try typing another drug name or physician name.'
                : 'Upload a prescription PDF or photo. The OCR pipeline will extract medications, dosages, and administration frequencies.'}
            </p>
            <div className="mt-5">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsUploadOpen(true)}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Upload Prescription Document
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item, idx) => (
            <Card
              key={idx}
              className="p-5 hover:border-teal-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0">
                    <Pill className="w-5 h-5" />
                  </div>
                  <Badge variant="teal" className="text-[10px] uppercase">
                    Prescribed
                  </Badge>
                </div>

                <h2 className="text-base font-bold text-navy-950 mt-3 font-display">{item.medication.name}</h2>
                <p className="text-xs font-semibold text-teal-700 mt-0.5 font-mono">
                  {item.medication.dosage || 'Dosage not specified'}
                </p>

                <div className="mt-4 space-y-2 text-xs text-navy-600 border-t border-slate-100 pt-3">
                  {item.medication.frequency && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{item.medication.frequency}</span>
                    </div>
                  )}

                  {item.medication.duration && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Duration: {item.medication.duration}</span>
                    </div>
                  )}

                  {item.doctorName && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Prescribed by: {item.doctorName}</span>
                    </div>
                  )}

                  {item.medication.instructions && (
                    <p className="text-[11px] text-navy-600 bg-slate-50 p-2.5 rounded-xl mt-2 italic border border-slate-100">
                      &ldquo;{item.medication.instructions}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Source Document Link */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-navy-400 truncate max-w-[160px]">
                  {item.documentFilename}
                </span>
                <Link
                  href={`/documents/${item.documentId}/review`}
                  className="inline-flex items-center gap-1 font-bold text-health-600 hover:text-health-700 transition-colors"
                >
                  Review Record
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Medical Disclaimer */}
      <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5 shadow-sm">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          HealthSync AI displays only prescribed medicines verbatim from existing uploaded medical documents. It never prescribes drugs or advises medication changes.
        </p>
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => fetchPrescriptionData()}
      />
    </div>
  );
}
