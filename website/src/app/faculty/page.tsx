'use client';

import React, { useState } from 'react';
import { Navbar } from '@/features/dashboard/components/Navbar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Upload, BookOpenCheck } from 'lucide-react';
import Link from 'next/link';
import { FacultyTable } from '@/features/faculty/components/FacultyTable';
import { FacultyUploadModal } from '@/features/faculty/components/FacultyUploadModal';

export default function FacultyPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 sm:px-8 py-8">

        {/* Page header */}
        <div className="mb-7">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-5 group"
          >
            <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center shrink-0">
                <BookOpenCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Faculty Master Data
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Manage faculty accounts that access the Attendance App.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="gap-2 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Upload Faculty (Excel)
            </Button>
          </div>
        </div>

        <FacultyTable />

        <FacultyUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
        />
      </main>
    </div>
  );
}
