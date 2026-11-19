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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight font-display">
            Medical Records Vault
          </h1>
          <p className="text-xs sm:text-sm text-navy-500 mt-1 font-sans">
            Organized timeline of your prescriptions, lab tests, and hospital reports
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsUploadOpen(true)}
          className="shadow-md shadow-health-600/20"
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Upload New Document
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 shadow-sm flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by file name or document type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-xs sm:text-sm"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-auto text-xs font-semibold border border-slate-300 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-800 bg-white"
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
            className="w-full md:w-auto text-xs font-semibold border border-slate-300 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-health-500 text-navy-800 bg-white"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </Card>

      {/* Documents Table / Card List */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-7 h-7 border-2 border-health-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-navy-500">Retrieving encrypted medical records...</p>
          </CardContent>
        </Card>
      ) : filteredDocuments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-health-50 text-health-600 flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-base text-navy-900 font-display">
              {searchTerm || selectedCategory !== 'all'
                ? 'No documents matched your filter'
                : 'No medical documents found'}
            </h3>
            <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto">
              {searchTerm || selectedCategory !== 'all'
                ? 'Try adjusting your search criteria or category filter.'
                : 'Upload a prescription or diagnostic report to start structuring your medical record vault.'}
            </p>
            <div className="mt-5">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsUploadOpen(true)}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Upload Document
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-navy-500 uppercase tracking-wider">
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
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Filename & Size */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-health-50 text-health-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 max-w-xs sm:max-w-md">
                          <Link
                            href={`/documents/${doc.id}/review`}
                            className="font-bold text-navy-950 hover:text-health-600 transition-colors truncate block"
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
                      <Badge variant="default" className="text-[11px] capitalize font-medium">
                        {(doc.document_type || 'other').replace(/_/g, ' ')}
                      </Badge>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-navy-500 whitespace-nowrap font-mono text-[11px]">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A'}
                    </td>

                    {/* Confidence */}
                    <td className="py-3.5 px-4">
                      {doc.document_type !== 'non_medical' &&
                      doc.status !== 'unsupported' &&
                      doc.ocr_confidence !== undefined &&
                      doc.ocr_confidence !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-150 h-1.5 rounded-full overflow-hidden bg-slate-200">
                            <div
                              className="h-full bg-teal-500 rounded-full"
                              style={{ width: `${Math.round(doc.ocr_confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-teal-700 font-mono">
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
                        <Badge variant="default" className="text-[10px]">
                          Non-Medical
                        </Badge>
                      ) : doc.status === 'failed' ? (
                        <Badge variant="danger" className="text-[10px]">
                          Failed
                        </Badge>
                      ) : doc.status === 'uploaded' || doc.status === 'processing' ? (
                        <Badge variant="default" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          Processing
                        </Badge>
                      ) : doc.needs_human_review || doc.status === 'needs_review' ? (
                        <Badge variant="pending" className="text-[10px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Needs Review
                        </Badge>
                      ) : doc.document_type !== 'other' && (doc.status === 'extracted' || doc.status === 'verified') ? (
                        <Badge variant="verified" className="text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-teal-600" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">
                          Unverified
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/documents/${doc.id}/review`}
                          className="p-2 rounded-lg text-slate-500 hover:text-health-600 hover:bg-health-50 transition-colors"
                          title="Review Clinical Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDownload(doc.id, doc.filename || doc.original_filename)}
                          disabled={downloadingId === doc.id}
                          className="p-2 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Download Original File"
                        >
                          <Download className={`w-4 h-4 ${downloadingId === doc.id ? 'animate-bounce' : ''}`} />
                        </button>
                        <button
                          onClick={() => setDocumentToDelete(doc)}
                          className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      {documentToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="relative w-full max-w-md bg-white p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy-950 font-display">Delete Medical Record?</h3>
              <p className="text-xs text-navy-600 mt-1 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-navy-900 font-semibold">{documentToDelete.filename}</strong>?
                This will delete the file and all associated extracted prescriptions, lab results, and review entries.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDocumentToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={deleting}
              >
                Delete Permanently
              </Button>
            </div>
          </Card>
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
