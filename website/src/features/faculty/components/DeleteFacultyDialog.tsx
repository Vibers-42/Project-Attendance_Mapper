'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService, Faculty } from '../api/facultyService';
import { toast } from 'sonner';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  faculty: Faculty | null;
  onClose: () => void;
}

export function DeleteFacultyDialog({ faculty, onClose }: Props) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => facultyService.deleteFaculty(faculty!.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['faculty'] });
      toast.success(`Faculty "${faculty?.facultyId}" removed from Master Data.`);
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        'Failed to delete faculty. Please try again.';
      toast.error('Delete failed', { description: msg });
    },
  });

  if (!faculty) return null;

  return (
    <Dialog open={!!faculty} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
            <AlertTriangle className="w-5 h-5" />
            Remove Faculty
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Confirmation card */}
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Are you sure you want to delete:
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex gap-3">
              <span className="text-zinc-500 w-28 shrink-0">Employee ID:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {faculty.facultyId}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-zinc-500 w-28 shrink-0">Name:</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{faculty.name}</span>
            </div>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            This faculty member will lose access to the app and will no longer be able to scan
            student IDs or manage attendance.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</>
            ) : (
              <><Trash2 className="w-4 h-4 mr-2" /> Yes, Delete</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
