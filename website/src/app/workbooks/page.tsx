'use client';

import React from 'react';
import { Navbar } from '@/features/dashboard/components/Navbar';
import { WorkbookTable } from '@/features/workbooks/components/WorkbookTable';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CalendarCheck } from 'lucide-react';
import Link from 'next/link';

export default function AttendanceReportsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 sm:px-8 py-8">

        {/* ── Page Header ── */}
        <div className="mb-6">
          <Button
            asChild variant="ghost" size="sm"
            className="w-fit -ml-3 mb-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CalendarCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Attendance Reports
            </h1>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 ml-14 max-w-2xl">
            View attendance sessions recorded by faculty. Filter by year, topic, or date, then download
            an instant Excel workbook — no files stored on the server.
          </p>
        </div>

        {/* ── Table & Filters ── */}
        <WorkbookTable />

      </main>
    </div>
  );
}
