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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-navy-950">Prescription & Medication Manager</h2>
          <p className="text-xs sm:text-sm text-navy-500 mt-0.5">
            Active medication schedules extracted verbatim from verified prescription documents
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-health-600 hover:bg-health-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Upload className="w-4 h-4" />
          Upload Prescription
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex items-center gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search medications by name, prescribing doctor, or prescription source..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-900"
          />
        </div>
      </div>

      {/* Medication Cards / Table */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-7 h-7 border-2 border-health-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-navy-500">Scanning prescription records...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
            <Pill className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-base text-navy-900">
            {searchTerm ? 'No medications match your search' : 'No prescription medications found'}
          </h4>
          <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {searchTerm
              ? 'Try typing another drug name or physician name.'
              : 'Upload a prescription PDF or photo. The OCR pipeline will extract medications, dosages, and administration frequencies.'}
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-health-600 hover:bg-health-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload Prescription Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0">
                    <Pill className="w-5 h-5" />
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-navy-600 uppercase">
                    Prescribed
                  </span>
                </div>

                <h3 className="text-base font-bold text-navy-950 mt-3">{item.medication.name}</h3>
                <p className="text-xs font-semibold text-teal-700 mt-0.5">
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
                    <p className="text-[11px] text-navy-500 bg-slate-50 p-2 rounded-lg mt-2 italic">
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
                  className="inline-flex items-center gap-1 font-semibold text-health-600 hover:text-health-700"
                >
                  Review Record
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Medical Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
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
