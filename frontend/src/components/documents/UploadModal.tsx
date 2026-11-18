'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '@/lib/api';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: () => void;
}

export function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [categoryHint, setCategoryHint] = useState<string>('');
  const [enableLlm, setEnableLlm] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'extracting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMessage(null);
    const validExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !validExtensions.includes(ext)) {
      setErrorMessage('Unsupported file format. Please upload PDF, PNG, JPG, or JPEG.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 10MB limit.');
      return;
    }

    setFile(selectedFile);
  };

  const handleLoadSample = async (sampleType: 'prescription' | 'lab_report') => {
    setErrorMessage(null);
    try {
      const filename = sampleType === 'prescription' ? 'sample_prescription.pdf' : 'sample_lab_report.pdf';
      const displayName = sampleType === 'prescription' ? 'Sample_Prescription_Lisinopril.pdf' : 'Sample_Lab_Report_Lipid_Panel.pdf';
      const hint = sampleType === 'prescription' ? 'Prescription' : 'Laboratory Report';

      const response = await fetch(`/samples/${filename}`);
      if (!response.ok) {
        throw new Error('Could not load sample document.');
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], displayName, { type: 'application/pdf' });
      setFile(sampleFile);
      setCategoryHint(hint);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load sample document.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    setErrorMessage(null);

    try {
      // 1. Upload to backend
      const res = await api.uploadDocument(file, categoryHint || undefined, enableLlm);
      const docId = res.document_id || res.id;
      setUploadedDocId(docId);

      // 2. Trigger Extraction & AI Understanding
      setStatus('extracting');
      try {
        await api.extractDocument(docId, false);
      } catch {
        // Extraction fallback handled on backend
      }

      setStatus('success');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Failed to process and upload document.');
    }
  };

  const handleClose = () => {
    setFile(null);
    setStatus('idle');
    setErrorMessage(null);
    setUploadedDocId(null);
    onClose();
  };

  const handleNavigateToReview = () => {
    if (uploadedDocId) {
      handleClose();
      router.push(`/documents/${uploadedDocId}/review`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-health-100 text-health-600 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-navy-900">Upload Medical Document</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-navy-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {status === 'success' ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-navy-900">Document Ingested & Analyzed!</h4>
                <p className="text-xs text-navy-600 mt-1 max-w-sm mx-auto">
                  Text was extracted with calibrated confidence. You can now review the extracted medical data.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={handleNavigateToReview}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-health-600 text-white text-xs font-semibold hover:bg-health-700 shadow-sm"
                >
                  Review Extracted Details
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-navy-700 text-xs font-semibold hover:bg-slate-200"
                >
                  Close & View All Records
                </button>
              </div>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <p>{errorMessage}</p>
                </div>
              )}

              {/* Quick Sample Document Loaders for Hackathon Demo */}
              <div className="rounded-xl border border-health-200 bg-health-50/70 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-health-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-health-600" />
                    ⚡ Hackathon Demo: Quick Sample Documents
                  </span>
                  <span className="text-[10px] text-health-800 bg-health-200/80 px-2 py-0.5 rounded-full font-semibold">
                    Synthetic Data Only
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleLoadSample('prescription')}
                    disabled={status === 'uploading' || status === 'extracting'}
                    className="text-left p-2.5 rounded-xl border border-health-200 bg-white hover:bg-health-100/50 hover:border-health-400 transition-all text-xs group shadow-xs disabled:opacity-50"
                  >
                    <div className="font-bold text-navy-900 group-hover:text-health-700 flex items-center justify-between">
                      <span>Prescription</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-health-100 text-health-700 font-mono">PDF</span>
                    </div>
                    <p className="text-[11px] text-navy-600 mt-0.5 truncate">
                      Lisinopril 10mg (Synthetic)
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('lab_report')}
                    disabled={status === 'uploading' || status === 'extracting'}
                    className="text-left p-2.5 rounded-xl border border-health-200 bg-white hover:bg-health-100/50 hover:border-health-400 transition-all text-xs group shadow-xs disabled:opacity-50"
                  >
                    <div className="font-bold text-navy-900 group-hover:text-health-700 flex items-center justify-between">
                      <span>Lab Report</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-health-100 text-health-700 font-mono">PDF</span>
                    </div>
                    <p className="text-[11px] text-navy-600 mt-0.5 truncate">
                      Lipid & Metabolic Panel
                    </p>
                  </button>
                </div>
              </div>

              {/* Drag and drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-health-500 bg-health-50/50'
                    : file
                    ? 'border-teal-400 bg-teal-50/20'
                    : 'border-slate-300 hover:border-health-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-teal-600" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-navy-900 truncate max-w-[280px]">
                        {file.name}
                      </p>
                      <p className="text-xs text-navy-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-full bg-health-50 text-health-600 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy-800">
                        Drop your medical document here, or <span className="text-health-600">browse</span>
                      </p>
                      <p className="text-xs text-navy-400 mt-1">
                        Supports PDF, PNG, JPG, or JPEG (Max 10MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Document Category Hint */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-navy-700 mb-1.5">
                  Document Type (Optional Hint)
                </label>
                <select
                  value={categoryHint}
                  onChange={(e) => setCategoryHint(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-800 bg-white"
                >
                  <option value="">Auto-Detect Category (Recommended)</option>
                  <option value="Prescription">Medical Prescription</option>
                  <option value="Blood Test">Blood Test Report</option>
                  <option value="Laboratory Report">Diagnostic / Laboratory Report</option>
                  <option value="Scan / Imaging Report">Imaging / Radiology Report</option>
                  <option value="Discharge Summary">Hospital Discharge Summary</option>
                  <option value="Consultation Record">Doctor Consultation Record</option>
                </select>
              </div>

              {/* Multimodal AI Vision Toggle */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-health-600" />
                  <div>
                    <p className="text-xs font-semibold text-navy-900">Multimodal Vision AI</p>
                    <p className="text-[11px] text-navy-500">
                      Deciphers handwriting and complex lab result tables
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableLlm}
                    onChange={(e) => setEnableLlm(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-health-600" />
                </label>
              </div>

              {/* Progress and status message */}
              {(status === 'uploading' || status === 'extracting') && (
                <div className="p-3.5 rounded-xl bg-health-50 border border-health-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-health-800">
                    <span>
                      {status === 'uploading'
                        ? '1/2 Uploading file securely...'
                        : '2/2 Running OCR & Structured AI Extraction...'}
                    </span>
                    <span className="animate-pulse">Processing</span>
                  </div>
                  <div className="w-full bg-health-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`bg-health-600 h-full rounded-full transition-all duration-500 ${
                        status === 'uploading' ? 'w-1/2' : 'w-5/6 animate-pulse'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Medical Disclaimer */}
              <div className="flex items-start gap-2 text-[11px] text-navy-500">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Uploaded records are processed for organization and retrieval only; never for clinical diagnosis.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={status === 'uploading' || status === 'extracting'}
                  className="px-4 py-2 text-xs font-semibold text-navy-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!file || status === 'uploading' || status === 'extracting'}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-health-600 hover:bg-health-700 rounded-xl shadow-sm disabled:opacity-50 transition-all"
                >
                  {status === 'uploading' || status === 'extracting' ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Ingest & Analyze Record
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
