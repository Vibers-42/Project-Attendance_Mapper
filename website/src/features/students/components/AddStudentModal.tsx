'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentService } from '../api/studentService';
import { toast } from 'sonner';
import { Loader2, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  rollNumber: string;
  name: string;
  timetable: string;
}

const INITIAL: FormState = { rollNumber: '', name: '', timetable: '' };

export function AddStudentModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: () =>
      studentService.addStudent({
        rollNumber: form.rollNumber.trim().toUpperCase(),
        name: form.name.trim(),
        timetable: form.timetable.trim(),
      }),
    onSuccess: (student) => {
      queryClient.removeQueries({ queryKey: ['students'] });
      toast.success(`Student "${student.rollNumber}" added to Master Data.`);
      handleClose();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        'Failed to add student. Please try again.';
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
    if (!form.rollNumber.trim()) { setError('Roll No is required.'); return; }
    if (!form.name.trim()) { setError('Student Name is required.'); return; }
    if (!form.timetable.trim()) { setError('Timetable is required.'); return; }
    setConfirmed(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Add Student to Master Data
          </DialogTitle>
          <DialogDescription>
            The student will be marked{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">ACTIVE</span>{' '}
            and will be tracked for attendance in the app.
          </DialogDescription>
        </DialogHeader>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1: Fill in details ── */}
        {!confirmed && (
          <div className="space-y-4 py-1">
            {/* Roll No */}
            <div className="space-y-1.5">
              <Label htmlFor="add-roll" className="font-medium">
                Roll No <span className="text-red-500">*</span>
              </Label>
              <Input
                id="add-roll"
                placeholder="e.g. 24B11AI139"
                value={form.rollNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rollNumber: e.target.value.toUpperCase() }))
                }
                className="font-mono tracking-wide"
                autoFocus
              />
            </div>

            {/* Student Name */}
            <div className="space-y-1.5">
              <Label htmlFor="add-name" className="font-medium">
                Student Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="add-name"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Timetable */}
            <div className="space-y-1.5">
              <Label htmlFor="add-timetable" className="font-medium">
                Timetable <span className="text-red-500">*</span>
              </Label>
              <Input
                id="add-timetable"
                placeholder="e.g. T4(CA2) or T5(T-HUB)"
                value={form.timetable}
                onChange={(e) => setForm((f) => ({ ...f, timetable: e.target.value }))}
              />
              <p className="text-xs text-zinc-400">
                Enter the timetable code exactly as it appears in your records.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2: Confirmation ── */}
        {confirmed && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-5 py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
              <CheckCircle2 className="w-4 h-4" />
              Are you sure you want to add this student?
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-3">
                <span className="text-zinc-400 w-24 shrink-0">Roll No</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {form.rollNumber.toUpperCase()}
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-24 shrink-0">Name</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{form.name}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-zinc-400 w-24 shrink-0">Timetable</span>
                <span className="text-zinc-700 dark:text-zinc-300">{form.timetable}</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              This student will be eligible for attendance tracking and scanning in the app.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={addMutation.isPending}>
            Cancel
          </Button>

          {!confirmed ? (
            <Button
              onClick={handleProceed}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
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
                'Yes, Add Student'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
