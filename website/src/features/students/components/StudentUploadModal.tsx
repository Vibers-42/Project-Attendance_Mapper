'use client';

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UploadCloud, FileType, AlertCircle } from 'lucide-react';
import * as xlsx from 'xlsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentService } from '../api/studentService';
import { toast } from 'sonner';

interface StudentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StudentUploadModal({ isOpen, onClose }: StudentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = xlsx.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });
        
        if (rawData.length === 0) {
          setError('The uploaded Excel file is empty.');
          return;
        }

        // Just take first 5 rows for preview
        setPreviewData(rawData.slice(0, 5));
      } catch (err) {
        setError('Failed to parse Excel file preview. Please ensure it is a valid format.');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const resetState = () => {
    setFile(null);
    setPreviewData([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      return studentService.uploadStudents(file);
    },
    onSuccess: (data) => {
      // Remove all cached student pages so the table always shows fresh data
      queryClient.removeQueries({ queryKey: ['students'] });
      toast.success(data.message || 'Students uploaded successfully!');
      handleClose();
    },
    onError: (err: any) => {
      // Surface the full backend message (including validation errors from excel parser)
      const backendMsg = err?.response?.data?.message;
      const msg = backendMsg || err.message || 'Upload failed. Please try again.';
      setError(msg);
      toast.error('Upload failed', { description: msg.split('\n')[0] });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Student Master Data</DialogTitle>
          <DialogDescription>
            Upload an Excel file (.xlsx) containing student records. 
            <strong className="text-red-600 dark:text-red-400 block mt-2">
              Warning: This will REPLACE all existing Student Master Data!
            </strong>
          </DialogDescription>
        </DialogHeader>

        {!file && (
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

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm whitespace-pre-wrap">{error}</p>
          </div>
        )}

        {file && !error && previewData.length > 0 && (
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
            Cancel
          </Button>
          {file && (
            <Button 
              variant="destructive" 
              onClick={() => uploadMutation.mutate()} 
              disabled={uploadMutation.isPending || !!error}
            >
              {uploadMutation.isPending ? 'Replacing Data...' : 'Confirm & Replace Data'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
