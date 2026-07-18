'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentService, Student } from '../api/studentService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, X, AlertCircle, UserPlus, Trash2,
} from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { AddStudentModal } from './AddStudentModal';
import { DeleteStudentDialog } from './DeleteStudentDialog';

// ─── Column widths (must be identical in header and body) ─────────────────────
// These are used via colgroup so every <table> renders the same column widths.
const COLS = [
  { key: 'sno',    label: 'S.No',         width: 60,   align: 'left'  },
  { key: 'roll',   label: 'Roll No',       width: 148,  align: 'left'  },
  { key: 'name',   label: 'Student Name',  width: 'auto' as const, align: 'left'  },
  { key: 'tt',     label: 'Timetable',     width: 130,  align: 'left'  },
  { key: 'status', label: 'Status',        width: 90,   align: 'right' },
  { key: 'action', label: 'Action',        width: 68,   align: 'right' },
] as const;

const PAGE_SIZE    = 50;
const ROW_HEIGHT   = 48;
const VISIBLE_ROWS = 14;
const CONTAINER_H  = ROW_HEIGHT * VISIBLE_ROWS; // 672 px

// ─── Shared colgroup ─────────────────────────────────────────────────────────
function TableColGroup() {
  return (
    <colgroup>
      {COLS.map((c) => (
        <col
          key={c.key}
          style={c.width === 'auto' ? {} : { width: c.width, minWidth: c.width }}
        />
      ))}
    </colgroup>
  );
}

// ─── Virtual scroll hook ──────────────────────────────────────────────────────
function useVirtualScroll(items: Student[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
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

  // Reset scroll on items change, and measure scrollbar width
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

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  return status === 'ACTIVE' ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      ACTIVE
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      {status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function StudentTable() {
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [jumpValue, setJumpValue] = useState('');
  const [addOpen, setAddOpen]     = useState(false);
  const [delTarget, setDelTarget] = useState<Student | null>(null);
  const [debouncedSearch]         = useDebounce(search, 250);

  const clearSearch = useCallback(() => { setSearch(''); setPage(1); setJumpValue(''); }, []);
  const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value); setPage(1); setJumpValue('');
  }, []);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['students', page, debouncedSearch],
    queryFn: () => studentService.getStudents(page, PAGE_SIZE, debouncedSearch),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    retry: 2,
  });

  const students   = data?.data ?? [];
  const meta       = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const total      = meta?.total ?? 0;
  const from       = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to         = Math.min(page * PAGE_SIZE, total);

  const goTo = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p)));
    setJumpValue('');
  }, [totalPages]);

  const handleJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { const n = parseInt(jumpValue); if (!isNaN(n)) goTo(n); }
  };

  const { ref: scrollRef, totalH, visible, offsetTop, start, scrollbarWidth } = useVirtualScroll(students);

  return (
    <>
      <AddStudentModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <DeleteStudentDialog student={delTarget} onClose={() => setDelTarget(null)} />

      <div className="space-y-3">

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <Input
              id="student-search"
              placeholder="Search by Roll No or Name…"
              value={search}
              onChange={onSearchChange}
              className="pl-9 pr-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus-visible:ring-blue-500"
            />
            {search && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" aria-label="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            {!isLoading && !isError && (
              <span className="text-sm text-zinc-500 font-medium whitespace-nowrap">
                {total === 0
                  ? 'No records'
                  : debouncedSearch
                  ? `${total.toLocaleString()} match${total !== 1 ? 'es' : ''}`
                  : `${from}–${to} of ${total.toLocaleString()} records`}
              </span>
            )}
            <Button id="add-student-btn" onClick={() => setAddOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0">
              <UserPlus className="w-4 h-4" />
              Add Student
            </Button>
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

          {/* HEADER — identical colgroup ensures alignment with body, padded by scrollbar width */}
          <div 
            className="overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80"
            style={{ paddingRight: scrollbarWidth }}
          >
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <TableColGroup />
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-400"
                      style={{ textAlign: c.align }}
                    >
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
              <span className="text-sm font-medium">Loading students…</span>
            </div>
          )}

          {/* Error */}
          {!isLoading && isError && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div className="text-center">
                <p className="font-semibold text-red-500">Failed to load students</p>
                <p className="text-sm text-zinc-400 mt-1">
                  {(error as any)?.response?.data?.message || 'Server error — please try refreshing.'}
                </p>
              </div>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && students.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 py-16">
              <Search className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
              <p className="font-medium">
                {debouncedSearch ? `No students match "${debouncedSearch}"` : 'No students in Master Data.'}
              </p>
              {debouncedSearch && (
                <button onClick={clearSearch} className="text-blue-500 text-sm hover:underline mt-1">
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* BODY — virtual scroll, same colgroup, same table-layout: fixed */}
          {!isLoading && !isError && students.length > 0 && (
            <div ref={scrollRef} className="overflow-y-auto overflow-x-auto" style={{ height: `${Math.min(totalH, CONTAINER_H)}px` }}>
              {/* Full-height spacer keeps scrollbar proportional */}
              <div style={{ height: `${totalH}px`, position: 'relative' }}>
                <table
                  className="w-full text-sm"
                  style={{ tableLayout: 'fixed', position: 'absolute', top: `${offsetTop}px`, left: 0, right: 0 }}
                >
                  <TableColGroup />
                  <tbody>
                    {visible.map((student, i) => {
                      const rowNum = (page - 1) * PAGE_SIZE + (start + i) + 1;
                      return (
                        <tr
                          key={student.id}
                          className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                          style={{ height: `${ROW_HEIGHT}px` }}
                        >
                          {/* S.No */}
                          <td className="px-4 text-zinc-400 text-xs">
                            {rowNum}
                          </td>
                          {/* Roll No */}
                          <td className="px-4">
                            <span className="font-mono font-semibold text-xs text-zinc-800 dark:text-zinc-100 tracking-wide">
                              {student.rollNumber}
                            </span>
                          </td>
                          {/* Name */}
                          <td className="px-4 text-sm text-zinc-700 dark:text-zinc-300 truncate">
                            {student.name}
                          </td>
                          {/* Timetable */}
                          <td className="px-4 text-xs text-zinc-500 dark:text-zinc-400">
                            {student.timetable ?? '—'}
                          </td>
                          {/* Status */}
                          <td className="px-4 text-right">
                            <StatusBadge status={student.status} />
                          </td>
                          {/* Action */}
                          <td className="px-4 text-right">
                            <button
                              onClick={() => setDelTarget(student)}
                              title={`Delete ${student.rollNumber}`}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                Page <span className="font-semibold text-zinc-800 dark:text-zinc-200">{page}</span> of{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{totalPages}</span>
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(1)} disabled={page === 1} title="First page"><ChevronsLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(page - 1)} disabled={page === 1} title="Previous"><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(page + 1)} disabled={page === totalPages} title="Next"><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(totalPages)} disabled={page === totalPages} title="Last page"><ChevronsRight className="w-4 h-4" /></Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <span>Go to</span>
                <Input id="page-jump" type="number" min={1} max={totalPages} value={jumpValue} onChange={(e) => setJumpValue(e.target.value)} onKeyDown={handleJump} placeholder="…" className="w-16 h-8 text-center text-sm px-2 bg-white dark:bg-zinc-900" />
                <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => { const n = parseInt(jumpValue); if (!isNaN(n)) goTo(n); }}>Go</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
