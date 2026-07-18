'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionReportService, WorkbookRecord, WorkbookFilters } from '../api/workbookService';
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

// ─── Column definitions ───────────────────────────────────────────────────────
const BASE_COLS = [
  { key: 'sno',          label: 'S.No',           width: 55,            align: 'left'  },
  { key: 'workbook',     label: 'Workbook Name',  width: 'auto' as const, align: 'left' },
  { key: 'academicYear', label: 'Academic Year',  width: 130,           align: 'left'  },
  { key: 'topic',        label: 'Topic',          width: 130,           align: 'left'  },
  { key: 'date',         label: 'Date',           width: 110,           align: 'left'  },
  { key: 'actions',      label: 'Actions',        width: 170,           align: 'right' },
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
function useVirtualScroll(items: WorkbookRecord[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop]       = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const onScroll = useCallback(() => {
    if (ref.current) setScrollTop(ref.current.scrollTop);
  }, []);

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
          <DialogDescription>Download is not available for this class yet.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 text-sm text-amber-700 dark:text-amber-300 space-y-2">
          <p className="font-semibold">No attendance records have been submitted for any session in this class.</p>
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
export function WorkbookTable() {
  const queryClient = useQueryClient();
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [jumpValue, setJumpValue] = useState('');
  const [debouncedSearch]         = useDebounce(search, 250);
  const [filters, setFilters]     = useState<WorkbookFilters>({});
  const [noRecordsOpen, setNoRecordsOpen]         = useState(false);
  const [downloadingId, setDownloadingId]         = useState<string | null>(null);
  const [deleteWorkbookTarget, setDeleteWorkbookTarget] = useState<WorkbookRecord | null>(null);

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

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['admin-workbooks', queryFilters],
    queryFn:  () => sessionReportService.listSessions(queryFilters),
    placeholderData: (prev) => prev,
    // staleTime: 0 — always treat cached data as stale so React Query re-fetches
    // on every mount (tab switch) and window focus, keeping the list perfectly
    // in sync after session deletions or new sessions from the app.
    staleTime:          0,
    refetchOnMount:     'always',
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const workbooks  = data?.data ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const total      = meta?.total ?? 0;
  const from       = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to         = Math.min(page * PAGE_SIZE, total);

  const hasActiveFilters = !!(debouncedSearch || filters.academicYear || filters.topic || filters.date);

  // ── Download handler ────────────────────────────────────────────────────────
  const handleDownload = async (workbook: WorkbookRecord) => {
    if (workbook.totalRecords === 0) {
      setNoRecordsOpen(true);
      return;
    }

    setDownloadingId(workbook.id);
    try {
      await sessionReportService.downloadSession(workbook);
      toast.success('Workbook downloaded successfully.');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400 || status === 404) {
        setNoRecordsOpen(true);
      } else {
        const msg = err?.response?.data?.message || err.message || 'Failed to download workbook.';
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

  const { ref: scrollRef, totalH, visible, offsetTop, start, scrollbarWidth } = useVirtualScroll(workbooks);

  return (
    <div className="space-y-3">
      <NoRecordsModal open={noRecordsOpen} onClose={() => setNoRecordsOpen(false)} />
      <DeleteWorkbookDialog
        workbook={deleteWorkbookTarget}
        onClose={() => setDeleteWorkbookTarget(null)}
        onConfirm={() => deleteWorkbookMutation.mutate(deleteWorkbookTarget!)}
        isPending={deleteWorkbookMutation.isPending}
      />

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Academic Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Academic Year</label>
            <div className="flex gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg">
              <button
                onClick={() => handleFilterChange({ academicYear: undefined })}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${!filters.academicYear ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                All
              </button>
              {YEAR_OPTIONS.map((year) => (
                <button
                  key={year}
                  onClick={() => handleFilterChange({ academicYear: year })}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filters.academicYear === year ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
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
              placeholder='Search by Workbook Name (e.g. ES-Aptitude(2nd Year,18-07-2026))...'
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
                  ? 'No workbooks'
                  : hasActiveFilters
                  ? `${total.toLocaleString()} match${total !== 1 ? 'es' : ''}`
                  : `${from}–${to} of ${total.toLocaleString()} workbook${total !== 1 ? 's' : ''}`}
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
            <TableColGroup cols={BASE_COLS} />
            <thead>
              <tr>
                {BASE_COLS.map((c) => (
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
            <span className="text-sm font-medium">Loading attendance reports…</span>
          </div>
        )}

        {/* Error */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <div className="text-center">
              <p className="font-semibold text-red-500">Failed to load attendance reports</p>
              <p className="text-sm text-zinc-400 mt-1">{(error as any)?.response?.data?.message || 'Server error — please try refreshing.'}</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && workbooks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 py-16">
            <CalendarCheck className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
            <p className="font-medium">{debouncedSearch || hasActiveFilters ? 'No workbooks match your filters' : 'No attendance reports found.'}</p>
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
                <TableColGroup cols={BASE_COLS} />
                <tbody>
                  {visible.map((workbook, i) => {
                    const rowNum = (page - 1) * PAGE_SIZE + (start + i) + 1;
                    const pad    = (n: number) => n.toString().padStart(2, '0');
                    const d      = new Date(workbook.date);
                    const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
                    const isDownloading = downloadingId === workbook.id;

                    return (
                      <tr
                        key={workbook.id}
                        className="border-b border-zinc-100 dark:border-zinc-800 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        style={{ height: `${ROW_HEIGHT}px` }}
                      >
                        {/* S.No */}
                        <td className="px-4 text-zinc-400 text-xs">{rowNum}</td>

                        {/* Workbook Name */}
                        <td className="px-4 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate" title={workbook.workbookName}>
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">{workbook.workbookName}</span>
                            {workbook.sessionCount > 1 && (
                              <span className="shrink-0 text-xs text-zinc-400 font-normal">({workbook.sessionCount} rooms)</span>
                            )}
                          </div>
                        </td>

                        {/* Academic Year */}
                        <td className="px-4 text-sm text-zinc-600 dark:text-zinc-400 truncate">
                          {workbook.academicYear?.name ?? '—'}
                        </td>

                        {/* Topic */}
                        <td className="px-4 text-sm text-zinc-600 dark:text-zinc-400 truncate">
                          {workbook.topic ?? '—'}
                        </td>

                        {/* Date */}
                        <td className="px-4 text-sm text-zinc-500">{dateStr}</td>

                        {/* Actions */}
                        <td className="px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline" size="sm"
                              className="h-7 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                              onClick={() => handleDownload(workbook)}
                              disabled={isDownloading}
                              title="Download consolidated workbook"
                            >
                              {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                              {!isDownloading && <span className="text-xs">Download</span>}
                            </Button>
                            <Button
                              variant="outline" size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                              onClick={() => setDeleteWorkbookTarget(workbook)}
                              title="Delete all sessions in this class"
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
              <Input type="number" min={1} max={totalPages} value={jumpValue} onChange={(e) => setJumpValue(e.target.value)} onKeyDown={handleJump} placeholder="…" className="w-16 h-8 text-center text-sm px-2" />
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => { const n = parseInt(jumpValue); if (!isNaN(n)) goTo(n); }}>Go</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
