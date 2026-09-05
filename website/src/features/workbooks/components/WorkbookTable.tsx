'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionReportService, WorkbookRecord, WorkbookFilters } from '../api/workbookService';
import { placementReportService, PlacementReportRecord, PlacementReportFilters } from '../../placements/api/placementReportService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X,
  AlertCircle, AlertTriangle, Download, CalendarCheck, CalendarDays, BookOpen, Trash2,
} from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';

interface WorkbookTableProps {
  moduleType?: 'attendance' | 'placement';
}

// ─── Column definitions ───────────────────────────────────────────────────────
const BASE_COLS = [
  { key: 'sno',          label: 'S.No',           width: 55,            align: 'left'   },
  { key: 'workbook',     label: 'Workbook Name',  width: 'auto' as const, align: 'left' },
  { key: 'academicYear', label: 'Academic Year',  width: 130,           align: 'left'   },
  { key: 'topic',        label: 'Topic',          width: 130,           align: 'left'   },
  { key: 'date',         label: 'Date',           width: 110,           align: 'left'   },
  { key: 'present',      label: 'Present',        width: 90,            align: 'center' },
  { key: 'actions',      label: 'Actions',        width: 170,           align: 'right'  },
] as const;

const PLACEMENT_COLS = [
  { key: 'sno',          label: 'S.No',           width: 55,            align: 'left'   },
  { key: 'workbook',     label: 'Placement Name', width: 'auto' as const, align: 'left' },
  { key: 'date',         label: 'Date',           width: 110,           align: 'left'   },
  { key: 'time',         label: 'Time',           width: 80,            align: 'left'   },
  { key: 'mode',         label: 'Mode',           width: 100,           align: 'left'   },
  { key: 'status',       label: 'Status',         width: 110,           align: 'center' },
  { key: 'present',      label: 'Present',        width: 80,            align: 'center' },
  { key: 'actions',      label: 'Actions',        width: 120,           align: 'right'  },
] as const;

type ColDef = { key: string; label: string; width: number | 'auto'; align: 'left' | 'center' | 'right' };

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

// ─── Virtual scroll hook ──────────────────────────────────────────────────────
function useVirtualScroll(items: any[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop]       = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const rafId = useRef<number | null>(null);

  // Batched to at most one state update per animation frame — an unthrottled
  // scroll handler fires 60-100+ times/sec during a fling and would force a
  // full re-render (recomputing visible rows) on every single one of them.
  const onScroll = useCallback(() => {
    if (rafId.current !== null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (ref.current) setScrollTop(ref.current.scrollTop);
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
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

// ─── Workbook Delete Confirm Dialog ─────────────────────────────────────────
interface DeleteWorkbookDialogProps {
  workbook: WorkbookRecord | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}
function DeleteWorkbookDialog({ workbook, onClose, onConfirm, isPending }: DeleteWorkbookDialogProps) {
  if (!workbook) return null;
  return (
    <Dialog open={!!workbook} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
            <AlertTriangle className="w-5 h-5" />
            Delete Workbook
          </DialogTitle>
          <DialogDescription>This will permanently delete all sessions in this class.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Are you sure you want to delete <span className="font-bold">{workbook.workbookName}</span>?
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">
            This will delete {workbook.sessionCount} session{workbook.sessionCount !== 1 ? 's' : ''} and all their attendance records permanently.
          </p>
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

// ─── No Records Modal ─────────────────────────────────────────────────────────
function NoRecordsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-5 h-5" />
            No Attendance Records
          </DialogTitle>
          <DialogDescription>Download is not available for this session yet.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 text-sm text-amber-700 dark:text-amber-300 space-y-2">
          <p className="font-semibold">No attendance records have been submitted.</p>
          <p className="text-amber-600 dark:text-amber-400 text-xs">
            Download will be available once the faculty has recorded attendance through the app.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Filter constants ─────────────────────────────────────────────────────────
const YEAR_OPTIONS  = ['2nd Year', '3rd Year'] as const;
const TOPIC_OPTIONS = ['All', 'Aptitude', 'Soft Skills'] as const;

// ─── Main Component ───────────────────────────────────────────────────────────
export function WorkbookTable({ moduleType = 'attendance' }: WorkbookTableProps) {
  const queryClient = useQueryClient();
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [jumpValue, setJumpValue] = useState('');
  const [debouncedSearch]         = useDebounce(search, 250);
  const [filters, setFilters]     = useState<WorkbookFilters>({});
  const [noRecordsOpen, setNoRecordsOpen]         = useState(false);
  const [downloadingId, setDownloadingId]         = useState<string | null>(null);
  const [deleteWorkbookTarget, setDeleteWorkbookTarget] = useState<WorkbookRecord | null>(null);

  const isPlacement = moduleType === 'placement';
  const queryKey = isPlacement ? 'admin-placement-reports' : 'admin-workbooks';
  const COLS = isPlacement ? PLACEMENT_COLS : BASE_COLS;

  const deleteWorkbookMutation = useMutation({
    mutationFn: (wb: WorkbookRecord) => sessionReportService.deleteWorkbook(wb),
    onSuccess: (res) => {
      // Invalidate BOTH views: workbook list recomputes, session list removes deleted sessions
      queryClient.invalidateQueries({ queryKey: ['admin-workbooks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-raw-sessions'] });
      toast.success(res.message || 'Workbook and all its sessions deleted successfully.');
      setDeleteWorkbookTarget(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to delete workbook.';
      toast.error('Delete failed', { description: msg });
    },
  });

  // Reset page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [filters.academicYear, filters.topic, filters.date, debouncedSearch]);

  const clearSearch = useCallback(() => { setSearch(''); setPage(1); setJumpValue(''); }, []);
  const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value); setPage(1); setJumpValue('');
  }, []);
  const handleFilterChange = (updated: Partial<WorkbookFilters>) => {
    setFilters(prev => ({ ...prev, ...updated }));
  };

  const queryFilters = { ...filters, search: debouncedSearch, page, limit: PAGE_SIZE };

  const { data, isLoading, isFetching, isError, error } = useQuery<any>({
    queryKey: [queryKey, queryFilters],
    queryFn:  () => {
      if (isPlacement) {
        return placementReportService.listReports({
          page: queryFilters.page,
          limit: queryFilters.limit,
          search: queryFilters.search,
          date: queryFilters.date,
        });
      }
      return sessionReportService.listSessions(queryFilters);
    },
    placeholderData: (prev: any) => prev,
    staleTime:          0,
    refetchOnMount:     'always',
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const workbooks  = data?.data ?? [];

  // Precompute per-row display strings once per fetched page instead of on
  // every render — this array feeds a virtualized/scrolling table, so without
  // memoizing here, date/time parsing+formatting would re-run for every
  // visible row on every single scroll-driven re-render.
  const workbooksFormatted = useMemo(() => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (data?.data ?? []).map((w: any) => {
      const d = new Date(w.date);
      const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
      const timeStr = isPlacement && w.time
        ? new Date(w.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : undefined;
      return { ...w, dateStr, timeStr };
    });
    // `data` (not the derived `workbooks` const) is the stable react-query
    // reference — depending on `workbooks` would re-run this every render
    // since `data?.data ?? []` produces a new array identity each time.
  }, [data, isPlacement]);

  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const total      = meta?.total ?? 0;
  const from       = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to         = Math.min(page * PAGE_SIZE, total);

  const hasActiveFilters = !!(debouncedSearch || filters.academicYear || filters.topic || filters.date);

  // ── Download handler ────────────────────────────────────────────────────────
  const handleDownload = async (workbook: any) => {
    const presentCount = isPlacement ? workbook.presentCount : workbook.totalRecords;
    if (presentCount === 0) {
      setNoRecordsOpen(true);
      return;
    }

    setDownloadingId(workbook.id);
    try {
      if (isPlacement) {
        await placementReportService.downloadReport(workbook.id);
      } else {
        await sessionReportService.downloadSession(workbook as WorkbookRecord);
      }
      toast.success(isPlacement ? 'Placement Report downloaded successfully.' : 'Workbook downloaded successfully.');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400 || status === 404) {
        setNoRecordsOpen(true);
      } else {
        const msg = err?.response?.data?.message || err.message || 'Failed to download report.';
        toast.error('Download failed', { description: msg });
      }
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Pagination ──────────────────────────────────────────────────────────────
  const goTo = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p)));
    setJumpValue('');
  }, [totalPages]);

  const handleJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { const n = parseInt(jumpValue); if (!isNaN(n)) goTo(n); }
  };

  const { ref: scrollRef, totalH, visible, offsetTop, start, scrollbarWidth } = useVirtualScroll(workbooksFormatted);

  return (
    <div className="space-y-3">
      <NoRecordsModal open={noRecordsOpen} onClose={() => setNoRecordsOpen(false)} />
      {!isPlacement && (
        <DeleteWorkbookDialog
          workbook={deleteWorkbookTarget}
          onClose={() => setDeleteWorkbookTarget(null)}
          onConfirm={() => deleteWorkbookMutation.mutate(deleteWorkbookTarget!)}
          isPending={deleteWorkbookMutation.isPending}
        />
      )}

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 items-end">
          
          {!isPlacement && (
            <>
              {/* Academic Year */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Academic Year</label>
                <div className="flex gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg">
                  <button
                    onClick={() => handleFilterChange({ academicYear: undefined })}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-[color,background-color,box-shadow] ${!filters.academicYear ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    All
                  </button>
                  {YEAR_OPTIONS.map((year) => (
                    <button
                      key={year}
                      onClick={() => handleFilterChange({ academicYear: year })}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-[color,background-color,box-shadow] ${filters.academicYear === year ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div className="space-y-1.5 min-w-[180px]">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Topic</label>
                <Select
                  value={String(filters.topic || 'All')}
                  onValueChange={(val: string | null | undefined) => handleFilterChange({ topic: (!val || val === 'All') ? undefined : val })}
                >
                  <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 h-9">
                    <SelectValue placeholder="All Topics" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOPIC_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t === 'All' ? 'All Topics' : t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Date</label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <Input
                type="date"
                value={filters.date ?? ''}
                onChange={(e) => handleFilterChange({ date: e.target.value || undefined })}
                className="pl-9 pr-10 h-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 w-48"
              />
              {filters.date && (
                <button
                  onClick={() => handleFilterChange({ date: undefined })}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  aria-label="Clear date"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Clear All */}
          {(filters.academicYear || filters.topic || filters.date) && (
            <Button
              variant="ghost" size="sm"
              onClick={() => handleFilterChange({ academicYear: undefined, topic: undefined, date: undefined })}
              className="h-9 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Clear Filters
            </Button>
          )}
        </div>

        <div className="h-[1px] bg-zinc-200 dark:bg-zinc-800 w-full" />

        {/* Search & Count Row */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-0 max-w-[460px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <Input
              placeholder={isPlacement ? 'Search by Placement Name (e.g. TCS Campus Drive)...' : 'Search by Workbook Name (e.g. ES-Aptitude(2nd Year,18-07-2026))...'}
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
                {workbooks.length === 0
                  ? (isPlacement ? 'No reports' : 'No workbooks')
                  : hasActiveFilters
                  ? `${total.toLocaleString()} match${total !== 1 ? 'es' : ''}`
                  : `${from}–${to} of ${total.toLocaleString()} ${isPlacement ? 'report' : 'workbook'}${total !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

        {/* HEADER */}
        <div className="overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80" style={{ paddingRight: scrollbarWidth }}>
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <TableColGroup cols={COLS} />
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-400" style={{ textAlign: c.align as any }}>
                    {c.label}
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
            <span className="text-sm font-medium">Loading {isPlacement ? 'placement reports' : 'attendance reports'}…</span>
          </div>
        )}

        {/* Error */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <div className="text-center">
              <p className="font-semibold text-red-500">Failed to load {isPlacement ? 'placement reports' : 'attendance reports'}</p>
              <p className="text-sm text-zinc-400 mt-1">{(error as any)?.response?.data?.message || 'Server error — please try refreshing.'}</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && workbooks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 py-16">
            <CalendarCheck className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
            <p className="font-medium">{debouncedSearch || hasActiveFilters ? `No ${isPlacement ? 'reports' : 'workbooks'} match your filters` : `No ${isPlacement ? 'placement reports' : 'attendance reports'} found.`}</p>
            {(debouncedSearch || hasActiveFilters) && (
              <p className="text-sm">Try adjusting or clearing the filters above.</p>
            )}
          </div>
        )}

        {/* BODY */}
        {!isLoading && !isError && workbooks.length > 0 && (
          <div ref={scrollRef} className="overflow-y-auto overflow-x-auto" style={{ height: `${Math.min(totalH, CONTAINER_H)}px` }}>
            <div style={{ height: `${totalH}px`, position: 'relative' }}>
              <table className="w-full text-sm" style={{ tableLayout: 'fixed', position: 'absolute', top: `${offsetTop}px`, left: 0, right: 0 }}>
                <TableColGroup cols={COLS} />
                <tbody>
                  {visible.map((workbook, i) => {
                    const rowNum = (page - 1) * PAGE_SIZE + (start + i) + 1;
                    const isDownloading = downloadingId === workbook.id;
                    const title = isPlacement ? workbook.title : workbook.workbookName;
                    const presentCount = isPlacement ? workbook.presentCount : workbook.totalRecords;

                    return (
                      <tr
                        key={workbook.id}
                        className="border-b border-zinc-100 dark:border-zinc-800 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        style={{ height: `${ROW_HEIGHT}px` }}
                      >
                        {/* S.No */}
                        <td className="px-4 text-zinc-400 text-xs">{rowNum}</td>

                        {/* Workbook Name / Placement Name */}
                        <td className="px-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate" title={title}>
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">{title}</span>
                            {!isPlacement && workbook.totalRecords > 0 && workbook.roomCount > 1 && (
                              <span className="shrink-0 text-xs text-zinc-400 font-normal">({workbook.roomCount} rooms)</span>
                            )}
                          </div>
                        </td>

                        {/* Academic Year (Attendance Only) */}
                        {!isPlacement && (
                          <td className="px-4 text-sm text-zinc-600 dark:text-zinc-400 truncate">
                            {workbook.academicYear?.name ?? '—'}
                          </td>
                        )}

                        {/* Topic (Attendance Only) */}
                        {!isPlacement && (
                          <td className="px-4 text-sm text-zinc-600 dark:text-zinc-400 truncate">
                            {workbook.topic ?? '—'}
                          </td>
                        )}

                        {/* Date */}
                        <td className="px-4 text-sm text-zinc-500">{workbook.dateStr}</td>

                        {/* Placement Specific Columns */}
                        {isPlacement && (
                          <>
                            <td className="px-4 text-sm text-zinc-600 dark:text-zinc-400">
                              {workbook.timeStr}
                            </td>
                            <td className="px-4 text-sm text-zinc-600 dark:text-zinc-400">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${workbook.mode === 'Virtual' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                {workbook.mode}
                              </span>
                            </td>
                            <td className="px-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                workbook.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                workbook.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}>
                                {workbook.status}
                              </span>
                            </td>
                          </>
                        )}

                        {/* Present */}
                        <td className="px-4 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {presentCount}
                        </td>

                        {/* Actions */}
                        <td className="px-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline" size="icon"
                              className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                              onClick={() => handleDownload(workbook)}
                              disabled={isDownloading}
                              title={isPlacement ? "Download placement report" : "Download consolidated workbook"}
                            >
                              {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            </Button>

                            {!isPlacement && (
                              <Button
                                variant="outline" size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => setDeleteWorkbookTarget(workbook)}
                                title="Delete all sessions in this class"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
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
            <span className="text-sm text-zinc-500">
              Page <span className="font-semibold text-zinc-800 dark:text-zinc-200">{page}</span> of <span className="font-semibold text-zinc-800 dark:text-zinc-200">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(1)}          disabled={page === 1}          title="First page"><ChevronsLeft  className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(page - 1)}  disabled={page === 1}          title="Previous"><ChevronLeft   className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(page + 1)}  disabled={page === totalPages} title="Next"><ChevronRight  className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(totalPages)} disabled={page === totalPages} title="Last page"><ChevronsRight className="w-4 h-4" /></Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span>Go to</span>
              <Input id="workbook-page-jump" type="number" min={1} max={totalPages} value={jumpValue} onChange={(e) => setJumpValue(e.target.value)} onKeyDown={handleJump} placeholder="…" className="w-16 h-8 text-center text-sm px-2 bg-white dark:bg-zinc-900" />
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => { const n = parseInt(jumpValue); if (!isNaN(n)) goTo(n); }}>Go</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
