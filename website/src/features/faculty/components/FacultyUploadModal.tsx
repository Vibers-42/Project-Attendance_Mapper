'use client';

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UploadCloud, FileType, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService, NewFacultyCredential } from '../api/facultyService';
import { toast } from 'sonner';

interface FacultyUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FacultyUploadModal({ isOpen, onClose }: FacultyUploadModalProps) {
  const [file, setFile]               = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError]             = useState<string | null>(null);
  const [credentials, setCredentials] = useState<NewFacultyCredential[] | null>(null);
  const [copiedId, setCopiedId]       = useState<string | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const queryClient                   = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const xlsx = await import('xlsx');
        const data     = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rawData  = xlsx.utils.sheet_to_json(sheet, { defval: '' });
        if (rawData.length === 0) { setError('The uploaded Excel file is empty.'); return; }
        setPreviewData(rawData.slice(0, 5));
      } catch {
        setError('Failed to parse Excel file. Please ensure it is a valid .xlsx file.');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const resetState = () => {
    setFile(null);
    setPreviewData([]);
    setError(null);
    setCredentials(null);
    setCopiedId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => { resetState(); onClose(); };

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      return facultyService.uploadFaculty(file);
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Faculty uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      if ((data.data.newFaculty ?? []).length > 0) {
        setCredentials(data.data.newFaculty);
        setFile(null);
        setPreviewData([]);
      } else {
        handleClose();
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Upload failed';
      setError(msg);
      toast.error('Upload Failed');
    },
  });

  const copyRow = (f: NewFacultyCredential) => {
    navigator.clipboard.writeText(`${f.facultyId}\t${f.name}\t${f.password}`);
    setCopiedId(f.facultyId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const copyAll = () => {
    if (!credentials) return;
    const header = 'Employee ID\tName\tPassword\n';
    const rows   = credentials.map((f) => `${f.facultyId}\t${f.name}\t${f.password}`).join('\n');
    navigator.clipboard.writeText(header + rows);
    toast.success('Credentials copied to clipboard!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Faculty Master Data</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx) containing faculty records. Existing faculty accounts are
            kept unchanged — only new Employee IDs are added.
          </DialogDescription>
        </DialogHeader>

        {/* ── Credentials result ────────────────────────────────── */}
        {credentials && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {credentials.length} new faculty account{credentials.length !== 1 ? 's' : ''} created
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Share these login IDs and passwords with the faculty members.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={copyAll} className="gap-1.5 shrink-0 text-xs">
                <Copy className="w-3.5 h-3.5" />
                Copy All
              </Button>
            </div>

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID (Login)</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.map((f) => (
                    <TableRow key={f.facultyId}>
                      <TableCell className="font-mono font-semibold text-sm">{f.facultyId}</TableCell>
                      <TableCell>{f.name}</TableCell>
                      <TableCell className="font-mono">{f.password}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => copyRow(f)}
                          title="Copy row"
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          {copiedId === f.facultyId
                            ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                            : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── File picker ───────────────────────────────────────── */}
        {!credentials && !file && (
          <div
            className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="w-12 h-12 text-zinc-400 mb-4" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium text-center">
              Click to browse or drag and drop<br/>
              <span className="text-sm font-normal">Excel files only (.xlsx, .xls)</span>
            </p>
            <input
              type="file"
              className="hidden"
              accept=".xlsx, .xls"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {/* ── Preview ───────────────────────────────────────────── */}
        {!credentials && file && !error && previewData.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <FileType className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{file.name}</p>
                <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Data Preview (First 5 rows)</h4>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(previewData[0]).slice(0, 5).map((key) => (
                        <TableHead key={key}>{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).slice(0, 5).map((val: any, j) => (
                          <TableCell key={j} className="truncate max-w-[150px]">{String(val)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose} disabled={uploadMutation.isPending}>
            {credentials ? 'Done' : 'Cancel'}
          </Button>
          {!credentials && file && (
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !!error}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Upload & Add New Faculty'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
