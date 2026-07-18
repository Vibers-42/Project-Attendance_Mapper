'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService, Faculty } from '../api/facultyService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  ShieldCheck, ShieldOff, Search, X, Loader2, AlertTriangle, CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: 'FACULTY' | 'SUPER_ADMIN' }) {
  return role === 'SUPER_ADMIN' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
      <ShieldCheck className="w-3 h-3" /> Super Admin
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      Faculty
    </span>
  );
}

// ─── Selectable Faculty Row ────────────────────────────────────────────────────
interface RowProps {
  faculty: Faculty;
  selected: boolean;
  onToggle: (id: string) => void;
}
function FacultyRow({ faculty, selected, onToggle }: RowProps) {
  return (
    <label
      className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all border ${
        selected
          ? 'bg-violet-50 border-violet-300 dark:bg-violet-900/20 dark:border-violet-600'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(faculty.id)}
        className="w-4 h-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 cursor-pointer flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">{faculty.name}</span>
        <span className="block text-xs text-zinc-500 font-mono">{faculty.facultyId}</span>
      </div>
      <RoleBadge role={faculty.role} />
    </label>
  );
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────
interface ConfirmDialogProps {
  mode: 'promote' | 'revoke';
  count: number;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmDialog({ mode, count, isPending, onConfirm, onCancel }: ConfirmDialogProps) {
  const isPromote = mode === 'promote';
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isPromote ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {isPromote ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
            {isPromote ? 'Grant Super Admin Privilege' : 'Revoke Super Admin Privilege'}
          </DialogTitle>
          <DialogDescription>
            {isPromote
              ? `This will give ${count} faculty member(s) Super Admin role. They will be able to log in to the app with full attendance management privileges.`
              : `This will revert ${count} faculty member(s) back to the Faculty role. They will lose Super Admin app privileges.`}
          </DialogDescription>
        </DialogHeader>
        <div className={`rounded-xl border px-5 py-4 ${
          isPromote
            ? 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20'
            : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
        }`}>
          <p className={`text-sm font-semibold ${isPromote ? 'text-violet-700 dark:text-violet-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {isPromote
              ? `${count} member(s) will be promoted to Super Admin.`
              : `${count} member(s) will be reverted to Faculty.`}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {isPromote
              ? 'Their Faculty credentials (Employee ID + password) remain unchanged.'
              : 'Their Faculty credentials remain unchanged. Website admin access is separate.'}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className={isPromote
              ? 'bg-violet-600 hover:bg-violet-700 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
            }
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying…</>
            ) : (
              isPromote ? <><ShieldCheck className="w-4 h-4 mr-2" />Confirm Grant</> : <><ShieldOff className="w-4 h-4 mr-2" />Confirm Revoke</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
type Tab = 'grant' | 'revoke';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageSuperAdminModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab]               = useState<Tab>('grant');
  const [search, setSearch]         = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fetch ALL faculty (no pagination — needed for checkbox list)
  const { data, isLoading } = useQuery({
    queryKey: ['faculty-all-roles'],
    queryFn:  () => facultyService.getFaculty(1, 9999),
    enabled:  isOpen,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const allFaculty = data?.data ?? [];

  // Split by role
  const regularFaculty   = useMemo(() => allFaculty.filter(f => f.role === 'FACULTY'),      [allFaculty]);
  const superAdminFaculty = useMemo(() => allFaculty.filter(f => f.role === 'SUPER_ADMIN'), [allFaculty]);

  // Current list based on active tab
  const currentList = tab === 'grant' ? regularFaculty : superAdminFaculty;

  // Filtered by search
  const filtered = useMemo(() => {
    if (!search.trim()) return currentList;
    const q = search.toLowerCase();
    return currentList.filter(f =>
      f.name.toLowerCase().includes(q) || f.facultyId.toLowerCase().includes(q)
    );
  }, [currentList, search]);

  // Reset selection when tab changes
  const switchTab = (t: Tab) => { setTab(t); setSelectedIds(new Set()); setSearch(''); };

  // Toggle single
  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Select / deselect all visible
  const allVisibleSelected = filtered.length > 0 && filtered.every(f => selectedIds.has(f.id));
  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => { const next = new Set(prev); filtered.forEach(f => next.delete(f.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); filtered.forEach(f => next.add(f.id)); return next; });
    }
  };

  // Mutations
  const promoteMutation = useMutation({
    mutationFn: (ids: string[]) => facultyService.promoteToSuperAdmin(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      queryClient.invalidateQueries({ queryKey: ['faculty-all-roles'] });
      toast.success(res.message);
      setConfirmOpen(false);
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast.error('Failed', { description: err?.response?.data?.message || err.message });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (ids: string[]) => facultyService.revokeSuperAdmin(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['faculty'] });
      queryClient.invalidateQueries({ queryKey: ['faculty-all-roles'] });
      toast.success(res.message);
      setConfirmOpen(false);
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast.error('Failed', { description: err?.response?.data?.message || err.message });
    },
  });

  const handleApply = () => {
    const ids = Array.from(selectedIds);
    if (tab === 'grant') promoteMutation.mutate(ids);
    else revokeMutation.mutate(ids);
  };

  const isPending = promoteMutation.isPending || revokeMutation.isPending;

  const handleClose = () => {
    if (isPending) return;
    setSelectedIds(new Set());
    setSearch('');
    setTab('grant');
    setConfirmOpen(false);
    onClose();
  };

  return (
    <>
      {confirmOpen && (
        <ConfirmDialog
          mode={tab === 'grant' ? 'promote' : 'revoke'}
          count={selectedIds.size}
          isPending={isPending}
          onConfirm={handleApply}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              <ShieldCheck className="w-5 h-5 text-violet-600" />
              Manage Super Admin Privileges
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-zinc-500">
              Grant or revoke Super Admin role for faculty members. Super Admins can log into the app and take attendance with elevated privileges.
            </DialogDescription>

            {/* Tabs */}
            <div className="flex gap-1 mt-4 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg w-fit">
              <button
                onClick={() => switchTab('grant')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'grant'
                    ? 'bg-white dark:bg-zinc-800 text-violet-700 dark:text-violet-300 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Grant Super Admin
                {regularFaculty.length > 0 && (
                  <span className="ml-1 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full">
                    {regularFaculty.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => switchTab('revoke')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'revoke'
                    ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                <ShieldOff className="w-4 h-4" />
                Revoke Super Admin
                {superAdminFaculty.length > 0 && (
                  <span className="ml-1 text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full">
                    {superAdminFaculty.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search + Select All */}
          <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <Input
                placeholder="Search by name or Employee ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Select All row */}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                  />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {allVisibleSelected ? 'Deselect all' : `Select all (${filtered.length})`}
                  </span>
                </label>
                {selectedIds.size > 0 && (
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    {selectedIds.size} selected
                  </span>
                )}
              </div>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2 min-h-0">
            {isLoading && (
              <div className="flex items-center justify-center py-12 gap-3 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                <span className="text-sm">Loading faculty…</span>
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-400">
                {tab === 'grant' ? (
                  <>
                    <ShieldCheck className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-sm font-medium">
                      {search ? `No faculty match "${search}"` : 'All faculty are already Super Admins.'}
                    </p>
                  </>
                ) : (
                  <>
                    <ShieldOff className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-sm font-medium">
                      {search ? `No Super Admins match "${search}"` : 'No Super Admin faculty to revoke.'}
                    </p>
                  </>
                )}
              </div>
            )}

            {!isLoading && filtered.map(faculty => (
              <FacultyRow
                key={faculty.id}
                faculty={faculty}
                selected={selectedIds.has(faculty.id)}
                onToggle={toggle}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0 flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950/60">
            <span className="text-sm text-zinc-500">
              {selectedIds.size === 0
                ? `${tab === 'grant' ? 'Select faculty to promote' : 'Select Super Admins to revoke'}`
                : `${selectedIds.size} member(s) selected`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={selectedIds.size === 0 || isPending}
                className={tab === 'grant'
                  ? 'bg-violet-600 hover:bg-violet-700 text-white gap-2'
                  : 'bg-amber-500 hover:bg-amber-600 text-white gap-2'
                }
              >
                {tab === 'grant' ? (
                  <><ShieldCheck className="w-4 h-4" />Grant Super Admin ({selectedIds.size})</>
                ) : (
                  <><ShieldOff className="w-4 h-4" />Revoke Super Admin ({selectedIds.size})</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
