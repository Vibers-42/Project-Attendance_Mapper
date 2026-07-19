'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService } from '../api/facultyService';
import { toast } from 'sonner';
import { Loader2, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  facultyId: string;
  name: string;
}

const INITIAL: FormState = { facultyId: '', name: '' };

export function AddFacultyModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm]           = useState<FormState>(INITIAL);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: () =>
      facultyService.addFaculty({
        facultyId: form.facultyId.trim().toUpperCase(),
        name:      form.name.trim(),
      }),
    onSuccess: (faculty) => {
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      toast.success(`Faculty "${faculty.facultyId}" added. Default login: ${faculty.facultyId} / webcap`);
      handleClose();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        'Failed to add faculty. Please try again.';
      setError(msg);
      setConfirmed(false);
    },
  });

  const handleClose = () => {
    setForm(INITIAL);
    setConfirmed(false);
    setError(null);
    onClose();
  };

  const handleProceed = () => {
    setError(null);
    if (!form.facultyId.trim()) { setError('Employee ID is required.'); return; }
    if (!form.name.trim())      { setError('Faculty Name is required.'); return; }
    setConfirmed(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Add Faculty to Master Data
          </DialogTitle>
          <DialogDescription>
            The faculty member will be marked{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">ACTIVE</span>{' '}
            with default login password{' '}
            <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">webcap</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Fill in details */}
        {!confirmed && (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="add-fac-id" className="font-medium">
                Employee ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="add-fac-id"
                placeholder="e.g. FAC001"
                value={form.facultyId}
                onChange={(e) => setForm((f) => ({ ...f, facultyId: e.target.value.toUpperCase() }))}
                className="font-mono tracking-wide"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-fac-name" className="font-medium">
                Faculty Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="add-fac-name"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">Default Login Credentials</p>
              <p className="mt-1 font-mono text-xs text-blue-600 dark:text-blue-400">
                Username: {form.facultyId.trim().toUpperCase() || '<Employee ID>'} &nbsp;|&nbsp; Password: webcap
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {confirmed && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-5 py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <CheckCircle2 className="w-4 h-4" />
              Are you sure you want to add this faculty member?
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-3">
                <span className="text-zinc-400 w-28 shrink-0">Employee ID</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {form.facultyId.toUpperCase()}
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-28 shrink-0">Name</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{form.name}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-28 shrink-0">Password</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">webcap</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              They can log in to the app immediately and scan student IDs for attendance.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={addMutation.isPending}>
            Cancel
          </Button>

          {!confirmed ? (
            <Button onClick={handleProceed} className="bg-blue-600 hover:bg-blue-700 text-white">
              Review &amp; Add
            </Button>
          ) : (
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
            >
              {addMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding…</>
              ) : (
                'Yes, Add Faculty'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
