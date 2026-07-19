'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionReportService, AttendanceSession, SessionStatus, WorkbookFilters } from '../api/workbookService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X,
  AlertCircle, AlertTriangle, Trash2, CalendarCheck, CalendarDays, Download,
} from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';

// ─── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<SessionStatus, { label: string; className: string }> = {
  CREATED:   { label: 'Created',   className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
  ACTIVE:    { label: 'Active',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};
function StatusBadge({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.CREATED;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>{cfg.label}</span>;
}

// ─── Column definitions ───────────────────────────────────────────────────────
const BASE_COLS = [
  { key: 'sno',      label: 'S.No',          width: 55,            align: 'left'   },
  { key: 'session',  label: 'Session Name',  width: 'auto' as const, align: 'left' },
  { key: 'faculty',  label: 'Faculty',       width: 150,           align: 'left'   },
  { key: 'room',     label: 'Room',          width: 90,            align: 'left'   },
  { key: 'acYear',   label: 'Academic Year', width: 120,           align: 'left'   },
  { key: 'topic',    label: 'Topic',         width: 110,           align: 'left'   },
  { key: 'date',     label: 'Date',          width: 105,           align: 'left'   },
  { key: 'status',   label: 'Status',        width: 105,           align: 'center' },
  { key: 'actions',  label: 'Actions',       width: 130,           align: 'right'  },
] as const;

const SEL_COL  = { key: 'select', label: '', width: 50, align: 'center' as const };
type ColDef    = { key: string; label: string; width: number | 'auto'; align: 'left' | 'center' | 'right' };

const PAGE_SIZE    = 50;
const ROW_HEIGHT   = 48;
const VISIBLE_ROWS = 14;
const CONTAINER_H  = ROW_HEIGHT * VISIBLE_ROWS;

function TableColGroup({ cols }: { cols: readonly ColDef[] }) {
  return (
    <colgroup>
      {cols.map((c) => (
        <col key={c.key} style={c.width === 'auto' ? {} : { width: c.width, minWidth: c.width }} />
      ))}
    </colgroup>
  );
}

// ─── Virtual scroll ───────────────────────────────────────────────────────────
function useVirtualScroll(items: AttendanceSession[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop]           = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const onScroll = useCallback(() => { if (ref.current) setScrollTop(ref.current.scrollTop); }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = 0;
      setScrollTop(0);
      setScrollbarWidth(ref.current.offsetWidth - ref.current.clientWidth);
    }
  }, [items]);

  const totalH    = items.length * ROW_HEIGHT;
  const start     = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 3);
  const end       = Math.min(items.length - 1, Math.ceil((scrollTop + CONTAINER_H) / ROW_HEIGHT) + 3);
  const visible   = items.slice(start, end + 1);
  const offsetTop = start * ROW_HEIGHT;

  return { ref, totalH, visible, offsetTop, start, scrollbarWidth };
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────
interface DeleteDialogProps {
  session: AttendanceSession | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}
function DeleteDialog({ session, onClose, onConfirm, isPending }: DeleteDialogProps) {
  if (!session) return null;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d   = new Date(session.date);
  const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  return (
    <Dialog open={!!session} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
            <AlertTriangle className="w-5 h-5" />
            Delete Session
          </DialogTitle>
          <DialogDescription>This action is permanent and cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Are you sure you want to delete this session?</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex gap-3"><span className="text-zinc-500 w-24 shrink-0">Topic:</span><span className="font-medium text-zinc-800 dark:text-zinc-200">{session.topic || '—'}</span></div>
            <div className="flex gap-3"><span className="text-zinc-500 w-24 shrink-0">Date:</span><span className="text-zinc-700 dark:text-zinc-300">{dateStr}</span></div>
            <div className="flex gap-3"><span className="text-zinc-500 w-24 shrink-0">Faculty:</span><span className="text-zinc-700 dark:text-zinc-300">{session.faculty?.name}</span></div>
            <div className="flex gap-3"><span className="text-zinc-500 w-24 shrink-0">Room:</span><span className="text-zinc-700 dark:text-zinc-300">{session.room?.name || '—'}</span></div>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">All attendance records for this session will also be permanently deleted.</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4 mr-2" />Yes, Delete</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Delete Dialog ───────────────────────────────────────────────────────
function BulkDeleteDialog({ isOpen, count, onClose, onConfirm, isPending }: { isOpen: boolean; count: number; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500"><AlertTriangle className="w-5 h-5" />Delete {count} Sessions</DialogTitle>
          <DialogDescription>This action is permanent and cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Are you sure you want to delete the selected {count} session(s)?</p>
          <p className="text-xs text-red-600 dark:text-red-400">All attendance records for these sessions will also be permanently deleted.</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4 mr-2" />Yes, Delete All</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Filter constants ─────────────────────────────────────────────────────────
const YEAR_OPTIONS  = ['2nd Year', '3rd Year'] as const;
const TOPIC_OPTIONS = ['All', 'Aptitude', 'Soft Skills'] as const;

function deriveTopicFromSubject(subjectName?: string | null): string | null {
  if (!subjectName) return null;
  const idx = subjectName.lastIndexOf(' - ');
  return idx !== -1 ? subjectName.slice(idx + 3).trim() : subjectName.trim();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SessionTable() {
  const queryClient = useQueryClient();
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [jumpValue, setJumpValue] = useState('');
  const [debouncedSearch]         = useDebounce(search, 250);
  const [filters, setFilters]     = useState<WorkbookFilters>({});
  const [deleteTarget, setDeleteTarget]       = useState<AttendanceSession | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen]   = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId]     = useState<string | null>(null);

  // ── Download handler ────────────────────────────────────────────────────────
  const handleDownload = async (session: AttendanceSession) => {
    if (session._count.records === 0) {
      toast.warning('No attendance records for this session yet.');
      return;
    }
    setDownloadingId(session.id);
    try {
      await sessionReportService.downloadSingleSession(session);
      toast.success('Session worksheet downloaded successfully.');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400 || status === 404) {
        toast.warning('No attendance records for this session yet.');
      } else {
        toast.error('Download failed', { description: err?.response?.data?.message || err.message });
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const currentCols: readonly ColDef[] = isSelectionMode
    ? [SEL_COL, ...BASE_COLS]
    : BASE_COLS;

  useEffect(() => {
    setPage(1); setSelectedIds(new Set()); setIsSelectionMode(false);
  }, [filters.academicYear, filters.topic, filters.date, debouncedSearch]);

  const clearSearch = useCallback(() => { setSearch(''); setPage(1); setJumpValue(''); setSelectedIds(new Set()); setIsSelectionMode(false); }, []);
  const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value); setPage(1); setJumpValue(''); setSelectedIds(new Set()); setIsSelectionMode(false);
  }, []);
  const handleFilterChange = (updated: Partial<WorkbookFilters>) => setFilters(prev => ({ ...prev, ...updated }));

  const queryFilters = { ...filters, search: debouncedSearch, page, limit: PAGE_SIZE };

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['admin-raw-sessions', queryFilters],
    queryFn:  () => sessionReportService.listRawSessions(queryFilters),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    retry: 2,
  });

  const sessions   = data?.data ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const total      = meta?.total ?? 0;
  const from       = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to         = Math.min(page * PAGE_SIZE, total);
  const hasActiveFilters = !!(debouncedSearch || filters.academicYear || filters.topic || filters.date);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionReportService.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-raw-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-workbooks'] });
      toast.success('Session deleted successfully.');
      setDeleteTarget(null); setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast.error('Delete failed', { description: err?.response?.data?.message || err.message });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => sessionReportService.bulkDeleteSessions(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-raw-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-workbooks'] });
      toast.success(res.message || 'Sessions deleted.');
      setBulkDeleteOpen(false); setSelectedIds(new Set()); setIsSelectionMode(false);
    },
    onError: (err: any) => {
      toast.error('Bulk delete failed', { description: err?.response?.data?.message || err.message });
    },
  });

  const goTo = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p))); setJumpValue(''); setSelectedIds(new Set());
  }, [totalPages]);

  const handleJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { const n = parseInt(jumpValue); if (!isNaN(n)) goTo(n); }
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === sessions.length && sessions.length > 0 ? new Set() : new Set(sessions.map(s => s.id)));
  };
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const { ref: scrollRef, totalH, visible, offsetTop, start, scrollbarWidth } = useVirtualScroll(sessions);

  return (
    <div className="space-y-3">
      <DeleteDialog session={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteMutation.mutate(deleteTarget!.id)} isPending={deleteMutation.isPending} />
      <BulkDeleteDialog isOpen={bulkDeleteOpen} count={selectedIds.size} onClose={() => setBulkDeleteOpen(false)} onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))} isPending={bulkDeleteMutation.isPending} />

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Academic Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Academic Year</label>
            <div className="flex gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg">
              <button onClick={() => handleFilterChange({ academicYear: undefined })} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${!filters.academicYear ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>All</button>
              {YEAR_OPTIONS.map((year) => (
                <button key={year} onClick={() => handleFilterChange({ academicYear: year })} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filters.academicYear === year ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>{year}</button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className="space-y-1.5 min-w-[180px]">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Topic</label>
            <Select value={String(filters.topic || 'All')} onValueChange={(val) => handleFilterChange({ topic: (!val || val === 'All') ? undefined : val })}>
              <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 h-9"><SelectValue placeholder="All Topics" /></SelectTrigger>
              <SelectContent>{TOPIC_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t === 'All' ? 'All Topics' : t}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Date</label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <Input type="date" value={filters.date ?? ''} onChange={(e) => handleFilterChange({ date: e.target.value || undefined })} className="pl-9 pr-10 h-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 w-48" />
              {filters.date && (
                <button onClick={() => handleFilterChange({ date: undefined })} className="absolute right-7 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" aria-label="Clear date">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {(filters.academicYear || filters.topic || filters.date) && (
            <Button variant="ghost" size="sm" onClick={() => handleFilterChange({ academicYear: undefined, topic: undefined, date: undefined })} className="h-9 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 gap-1.5">
              <X className="w-3.5 h-3.5" />Clear Filters
            </Button>
          )}
        </div>

        <div className="h-[1px] bg-zinc-200 dark:bg-zinc-800 w-full" />

        {/* Search & Actions Row */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-0 max-w-[460px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <Input
              placeholder='Search by Session Name (e.g. ES-Aptitude(2nd Year,18-07-2026,T1))...'
              value={search}
              onChange={onSearchChange}
              className="pl-9 pr-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus-visible:ring-blue-500 w-full"
            />
            {search && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors" aria-label="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            {!isLoading && !isError && (
              <span className="text-sm text-zinc-500 font-medium whitespace-nowrap">
                {sessions.length === 0 ? 'No sessions' : hasActiveFilters ? `${total.toLocaleString()} match${total !== 1 ? 'es' : ''}` : `${from}–${to} of ${total.toLocaleString()} sessions`}
              </span>
            )}

            {!isSelectionMode && sessions.length > 0 && (
              <Button onClick={() => setIsSelectionMode(true)} variant="outline" className="gap-2 shrink-0">
                <Trash2 className="w-4 h-4 text-zinc-500" />Select Multiple
              </Button>
            )}
            {isSelectionMode && (
              <div className="flex items-center gap-2">
                <Button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} variant="outline" className="shrink-0">Cancel</Button>
                {selectedIds.size > 0 && (
                  <Button onClick={() => setBulkDeleteOpen(true)} variant="destructive" className="gap-2 shrink-0">
                    <Trash2 className="w-4 h-4" />Delete Selected ({selectedIds.size})
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

        {/* HEADER */}
        <div className="overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80" style={{ paddingRight: scrollbarWidth }}>
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <TableColGroup cols={currentCols} />
            <thead>
              <tr>
                {currentCols.map((c) => (
                  <th key={c.key} className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-400" style={{ textAlign: c.align as any }}>
                    {c.key === 'select' ? (
                      <div className="flex justify-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={sessions.length > 0 && selectedIds.size === sessions.length} onChange={toggleSelectAll} />
                      </div>
                    ) : c.label}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 text-zinc-500 py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-sm font-medium">Loading sessions…</span>
          </div>
        )}

        {/* Error */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <div className="text-center">
              <p className="font-semibold text-red-500">Failed to load sessions</p>
              <p className="text-sm text-zinc-400 mt-1">{(error as any)?.response?.data?.message || 'Server error — please try refreshing.'}</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 py-16">
            <CalendarCheck className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
            <p className="font-medium">{hasActiveFilters ? 'No sessions match your filters' : 'No sessions found.'}</p>
            {hasActiveFilters && <p className="text-sm">Try adjusting or clearing the filters above.</p>}
          </div>
        )}

        {/* BODY */}
        {!isLoading && !isError && sessions.length > 0 && (
          <div ref={scrollRef} className="overflow-y-auto overflow-x-auto" style={{ height: `${Math.min(totalH, CONTAINER_H)}px` }}>
            <div style={{ height: `${totalH}px`, position: 'relative' }}>
              <table className="w-full text-sm" style={{ tableLayout: 'fixed', position: 'absolute', top: `${offsetTop}px`, left: 0, right: 0 }}>
                <TableColGroup cols={currentCols} />
                <tbody>
                  {visible.map((session, i) => {
                    const rowNum = (page - 1) * PAGE_SIZE + (start + i) + 1;
                    const pad    = (n: number) => n.toString().padStart(2, '0');
                    const d      = new Date(session.date);
                    const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
                    // Convention: ES-Topic(AcYear,Date,Room) — topic derived from subject when topic field is null
                    const topicDisplay = session.topic || deriveTopicFromSubject(session.subject?.name) || 'Session';
                    const sessionName = `ES-${topicDisplay}(${session.academicYear?.name || 'All Years'},${dateStr},${session.room?.name || 'N/A'})`;
                    const isSelected = selectedIds.has(session.id);

                    return (
                      <tr
                        key={session.id}
                        className={`border-b border-zinc-100 dark:border-zinc-800 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'}`}
                        style={{ height: `${ROW_HEIGHT}px` }}
                      >
                        {isSelectionMode && (
                          <td className="px-4 text-center">
                            <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer" checked={isSelected} onChange={() => toggleSelect(session.id)} />
                          </td>
                        )}
                        <td className="px-4 text-zinc-400 text-xs">{rowNum}</td>
                        <td className="px-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate" title={sessionName}>{sessionName}</td>
                        <td className="px-4 text-sm text-zinc-700 dark:text-zinc-300 truncate" title={session.faculty?.name}>{session.faculty?.name ?? '—'}</td>
                        <td className="px-4 text-sm text-zinc-600 dark:text-zinc-400 truncate">{session.room?.name ?? '—'}</td>
                        <td className="px-4 text-sm text-zinc-600 dark:text-zinc-400 truncate">{session.academicYear?.name ?? '—'}</td>
                        <td className="px-4 text-sm text-zinc-600 dark:text-zinc-400 truncate">{session.topic ?? deriveTopicFromSubject(session.subject?.name) ?? '—'}</td>
                        <td className="px-4 text-sm text-zinc-500">{dateStr}</td>
                        <td className="px-4 text-center"><StatusBadge status={session.status} /></td>
                        <td className="px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline" size="icon"
                              className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                              onClick={() => handleDownload(session)}
                              disabled={downloadingId === session.id}
                              title="Download session worksheet"
                            >
                              {downloadingId === session.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="outline" size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setDeleteTarget(session)}
                              title="Delete session"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-950/60">
            <span className="text-sm text-zinc-500">Page <span className="font-semibold text-zinc-800 dark:text-zinc-200">{page}</span> of <span className="font-semibold text-zinc-800 dark:text-zinc-200">{totalPages}</span></span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(1)}          disabled={page === 1}          title="First page"><ChevronsLeft  className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(page - 1)}  disabled={page === 1}          title="Previous"><ChevronLeft   className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(page + 1)}  disabled={page === totalPages} title="Next"><ChevronRight  className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(totalPages)} disabled={page === totalPages} title="Last page"><ChevronsRight className="w-4 h-4" /></Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span>Go to</span>
              <Input id="session-page-jump" type="number" min={1} max={totalPages} value={jumpValue} onChange={(e) => setJumpValue(e.target.value)} onKeyDown={handleJump} placeholder="…" className="w-16 h-8 text-center text-sm px-2 bg-white dark:bg-zinc-900" />
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => { const n = parseInt(jumpValue); if (!isNaN(n)) goTo(n); }}>Go</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
