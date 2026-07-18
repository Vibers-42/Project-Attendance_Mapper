'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facultyService, Faculty } from '../api/facultyService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, X, AlertCircle, UserPlus, Trash2, ShieldCheck,
} from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { AddFacultyModal }        from './AddFacultyModal';
import { DeleteFacultyDialog }    from './DeleteFacultyDialog';
import { ManageSuperAdminModal }  from './ManageSuperAdminModal';

// ─── Column widths ─────────────────────────────────────────────────────────────
const COLS = [
  { key: 'sno',     label: 'S.No',        width: 60,              align: 'left'   },
  { key: 'empid',   label: 'Employee ID',  width: 130,             align: 'left'   },
  { key: 'name',    label: 'Faculty Name', width: 'auto' as const, align: 'left'   },
  { key: 'role',    label: 'Role',         width: 130,             align: 'left'   },
  { key: 'created', label: 'Created Date', width: 120,             align: 'left'   },
  { key: 'status',  label: 'Status',       width: 90,              align: 'right'  },
  { key: 'action',  label: 'Action',       width: 68,              align: 'right'  },
] as const;

const PAGE_SIZE    = 50;
const ROW_HEIGHT   = 48;
const VISIBLE_ROWS = 14;
const CONTAINER_H  = ROW_HEIGHT * VISIBLE_ROWS;

// ─── Shared colgroup ────────────────────────────────────────────────────────────
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

// ─── Virtual scroll hook ────────────────────────────────────────────────────────
function useVirtualScroll(items: Faculty[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop]           = useState(0);
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

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      ACTIVE
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      INACTIVE
    </span>
  );
}

// ─── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: Faculty['role'] }) {
  if (role === 'SUPER_ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
        <ShieldCheck className="w-3 h-3" />
        Super Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      Faculty
    </span>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export function FacultyTable() {
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [jumpValue, setJumpValue] = useState('');
  const [addOpen, setAddOpen]     = useState(false);
  const [delTarget, setDelTarget] = useState<Faculty | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [debouncedSearch]         = useDebounce(search, 250);

  const clearSearch = useCallback(() => { setSearch(''); setPage(1); setJumpValue(''); }, []);
  const onSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value); setPage(1); setJumpValue('');
  }, []);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['faculty', page, debouncedSearch],
    queryFn:  () => facultyService.getFaculty(page, PAGE_SIZE, debouncedSearch),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    retry: 2,
  });

  const facultyList = data?.data ?? [];
  const meta        = data?.meta;
  const totalPages  = meta?.totalPages ?? 1;
  const total       = meta?.total ?? 0;
  const from        = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to          = Math.min(page * PAGE_SIZE, total);

  const goTo = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p)));
    setJumpValue('');
  }, [totalPages]);

  const handleJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { const n = parseInt(jumpValue); if (!isNaN(n)) goTo(n); }
  };

  const { ref: scrollRef, totalH, visible, offsetTop, start, scrollbarWidth } = useVirtualScroll(facultyList);

  return (
    <>
      <AddFacultyModal    isOpen={addOpen}    onClose={() => setAddOpen(false)} />
      <DeleteFacultyDialog faculty={delTarget} onClose={() => setDelTarget(null)} />
      <ManageSuperAdminModal isOpen={manageOpen} onClose={() => setManageOpen(false)} />

      <div className="space-y-3">

        {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <Input
              id="faculty-search"
              placeholder="Search by Employee ID or Name…"
              value={search}
              onChange={onSearchChange}
              className="pl-9 pr-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus-visible:ring-blue-500"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
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

            {/* Manage Super Admin button */}
            <Button
              id="manage-superadmin-btn"
              onClick={() => setManageOpen(true)}
              variant="outline"
              className="gap-2 border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              Manage Super Admin
            </Button>

            {/* Add Faculty button */}
            <Button
              id="add-faculty-btn"
              onClick={() => setAddOpen(true)}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              Add Faculty
            </Button>
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

          {/* HEADER */}
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
              <span className="text-sm font-medium">Loading faculty…</span>
            </div>
          )}

          {/* Error */}
          {!isLoading && isError && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div className="text-center">
                <p className="font-semibold text-red-500">Failed to load faculty</p>
                <p className="text-sm text-zinc-400 mt-1">
                  {(error as any)?.response?.data?.message || 'Server error — please try refreshing.'}
                </p>
              </div>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && facultyList.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 py-16">
              <Search className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
              <p className="font-medium">
                {debouncedSearch
                  ? `No faculty match "${debouncedSearch}"`
                  : 'No faculty in Master Data.'}
              </p>
              {debouncedSearch && (
                <button onClick={clearSearch} className="text-blue-500 text-sm hover:underline mt-1">
                  Clear search
                </button>
              )}
            </div>
          )}

          {/* BODY — virtual scroll */}
          {!isLoading && !isError && facultyList.length > 0 && (
            <div ref={scrollRef} className="overflow-y-auto overflow-x-auto" style={{ height: `${Math.min(totalH, CONTAINER_H)}px` }}>
              <div style={{ height: `${totalH}px`, position: 'relative' }}>
                <table
                  className="w-full text-sm"
                  style={{ tableLayout: 'fixed', position: 'absolute', top: `${offsetTop}px`, left: 0, right: 0 }}
                >
                  <TableColGroup />
                  <tbody>
                    {visible.map((faculty, i) => {
                      const rowNum = (page - 1) * PAGE_SIZE + (start + i) + 1;
                      return (
                        <tr
                          key={faculty.id}
                          className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${
                            faculty.role === 'SUPER_ADMIN' ? 'bg-violet-50/30 dark:bg-violet-900/5' : ''
                          }`}
                          style={{ height: `${ROW_HEIGHT}px` }}
                        >
                          {/* S.No */}
                          <td className="px-4 text-zinc-400 text-xs">{rowNum}</td>

                          {/* Employee ID */}
                          <td className="px-4">
                            <span className="font-mono font-semibold text-xs text-zinc-800 dark:text-zinc-100 tracking-wide">
                              {faculty.facultyId}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="px-4 text-sm text-zinc-700 dark:text-zinc-300 truncate">
                            {faculty.name}
                          </td>

                          {/* Role */}
                          <td className="px-4">
                            <RoleBadge role={faculty.role} />
                          </td>

                          {/* Created Date */}
                          <td className="px-4 text-xs text-zinc-500 dark:text-zinc-400">
                            {new Date(faculty.createdAt).toLocaleDateString()}
                          </td>

                          {/* Status */}
                          <td className="px-4 text-right">
                            <StatusBadge isActive={faculty.isActive} />
                          </td>

                          {/* Action */}
                          <td className="px-4 text-right">
                            <button
                              onClick={() => setDelTarget(faculty)}
                              title={`Delete ${faculty.facultyId}`}
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
                Page{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{page}</span> of{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{totalPages}</span>
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(1)}          disabled={page === 1}          title="First page"><ChevronsLeft  className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(page - 1)}   disabled={page === 1}          title="Previous"  ><ChevronLeft   className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(page + 1)}   disabled={page === totalPages} title="Next"      ><ChevronRight  className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => goTo(totalPages)} disabled={page === totalPages} title="Last page" ><ChevronsRight className="w-4 h-4" /></Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <span>Go to</span>
                <Input
                  id="faculty-page-jump"
                  type="number" min={1} max={totalPages}
                  value={jumpValue}
                  onChange={(e) => setJumpValue(e.target.value)}
                  onKeyDown={handleJump}
                  placeholder="…"
                  className="w-16 h-8 text-center text-sm px-2 bg-white dark:bg-zinc-900"
                />
                <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => { const n = parseInt(jumpValue); if (!isNaN(n)) goTo(n); }}>
                  Go
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
