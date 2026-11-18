'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Filter,
  Trash2,
  Download,
  Eye,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Sparkles,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { MedicalDocument, DocumentCategory } from '@/types';
import { UploadModal } from '@/components/documents/UploadModal';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<MedicalDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listDocuments(100, 0);
      setDocuments(data.documents || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch medical documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    const handleUploadEvent = () => {
      fetchDocuments();
    };
    window.addEventListener('healthsync-record-uploaded', handleUploadEvent);
    return () => {
      window.removeEventListener('healthsync-record-uploaded', handleUploadEvent);
    };
  }, []);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!documentToDelete) return;
    setDeleting(true);
    try {
      await api.deleteDocument(documentToDelete.id);
      setDocuments((prev) => prev.filter((d) => d.id !== documentToDelete.id));
      setDocumentToDelete(null);
    } catch (err: any) {
      alert(`Delete failed: ${err?.message || 'Error occurred.'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (docId: string, filename?: string) => {
    try {
      setDownloadingId(docId);
      await api.downloadDocumentFile(docId, filename);
    } catch (err: any) {
      alert(`Download failed: ${err?.message || 'Could not download document'}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Filter and sort logic
  const filteredDocuments = documents
    .filter((doc) => {
      const docName = (doc.filename || doc.original_filename || '').toLowerCase();
      const docType = (doc.document_type || 'other').toLowerCase();
      const term = (searchTerm || '').trim().toLowerCase();
      const matchesSearch = !term || docName.includes(term) || docType.includes(term);
      const matchesCategory =
        selectedCategory === 'all' ||
        docType === selectedCategory.toLowerCase() ||
        ((selectedCategory === 'laboratory_report' || selectedCategory === 'blood_test' || selectedCategory === 'lab_report') &&
          (docType === 'lab_report' || docType === 'blood_test' || docType === 'laboratory_report'));
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const categories = [
    { value: 'all', label: 'All Documents' },
    { value: 'prescription', label: 'Prescriptions' },
    { value: 'blood_test', label: 'Blood Tests' },
    { value: 'laboratory_report', label: 'Lab Reports' },
    { value: 'imaging_report', label: 'Imaging / Scans' },
    { value: 'discharge_summary', label: 'Discharge Summaries' },
    { value: 'consultation_record', label: 'Consultations' },
    { value: 'non_medical', label: 'Non-Medical Documents' },
    { value: 'other', label: 'Other Records' },
  ];

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-navy-950">Medical Records Vault</h2>
          <p className="text-xs sm:text-sm text-navy-500 mt-0.5">
            Organized timeline of your prescriptions, lab tests, and hospital reports
          </p>
        </div>

        <button
          onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-health-600 hover:bg-health-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Upload className="w-4 h-4" />
          Upload New Document
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by file name or document type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-900"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-auto text-xs font-medium border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-800 bg-white"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="w-full md:w-auto text-xs font-medium border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-800 bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Documents Table / Card List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="w-7 h-7 border-2 border-health-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-navy-500">Retrieving encrypted medical records...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-health-50 text-health-600 flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-base text-navy-900">
            {searchTerm || selectedCategory !== 'all'
              ? 'No documents matched your filter'
              : 'No medical documents found'}
          </h4>
          <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedCategory !== 'all'
              ? 'Try adjusting your search criteria or category filter.'
              : 'Upload a prescription or diagnostic report to start structuring your medical record vault.'}
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-health-600 hover:bg-health-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-navy-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Document Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Upload Date</th>
                  <th className="py-3.5 px-4">OCR Confidence</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-navy-800">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Filename & Size */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-health-50 text-health-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 max-w-xs sm:max-w-md">
                          <Link
                            href={`/documents/${doc.id}/review`}
                            className="font-semibold text-navy-900 hover:text-health-600 transition-colors truncate block"
                          >
                            {doc.filename || doc.original_filename || 'Untitled document'}
                          </Link>
                          <p className="text-[11px] text-navy-400 mt-0.5">
                            {((doc.file_size_bytes || 0) / 1024).toFixed(1)} KB • {doc.mime_type || 'file'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-medium capitalize ${
                        doc.document_type === 'non_medical'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-slate-100 text-navy-700'
                      }`}>
                        {(doc.document_type || 'other').replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-navy-500 whitespace-nowrap">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'}
                    </td>

                    {/* Confidence */}
                    <td className="py-3.5 px-4">
                      {doc.document_type !== 'non_medical' &&
                      doc.status !== 'unsupported' &&
                      doc.ocr_confidence !== undefined &&
                      doc.ocr_confidence !== null ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full"
                              style={{ width: `${Math.round(doc.ocr_confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-teal-700">
                            {Math.round(doc.ocr_confidence * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">N/A</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {doc.status === 'unsupported' || doc.document_type === 'non_medical' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          Non-Medical
                        </span>
                      ) : doc.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Failed
                        </span>
                      ) : doc.status === 'uploaded' || doc.status === 'processing' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Processing
                        </span>
                      ) : doc.needs_human_review || doc.status === 'needs_review' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Needs Review
                        </span>
                      ) : doc.document_type !== 'other' && (doc.status === 'extracted' || doc.status === 'verified') ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                          <CheckCircle2 className="w-3 h-3 text-teal-600" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Unverified
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/documents/${doc.id}/review`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-health-600 hover:bg-health-50 transition-colors"
                          title="Review Clinical Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDownload(doc.id, doc.filename || doc.original_filename)}
                          disabled={downloadingId === doc.id}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50"
                          title="Download Original File"
                        >
                          <Download className={`w-4 h-4 ${downloadingId === doc.id ? 'animate-bounce' : ''}`} />
                        </button>
                        <button
                          onClick={() => setDocumentToDelete(doc)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {documentToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy-950">Delete Medical Record?</h3>
              <p className="text-xs text-navy-600 mt-1 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-navy-900 font-semibold">{documentToDelete.filename}</strong>?
                This will delete the file and all associated extracted prescriptions, lab results, and review entries.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDocumentToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-navy-700 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => fetchDocuments()}
      />
    </div>
  );
}
