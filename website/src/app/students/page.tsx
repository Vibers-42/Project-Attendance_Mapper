'use client';

import React, { useState } from 'react';
import { Navbar } from '@/features/dashboard/components/Navbar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Upload, Users } from 'lucide-react';
import Link from 'next/link';
import { StudentTable } from '@/features/students/components/StudentTable';
import { StudentUploadModal } from '@/features/students/components/StudentUploadModal';

export default function StudentsPage() {
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
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Student Master Data
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Manage the master list of students used for attendance mapping.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Upload Students (Excel)
            </Button>
          </div>
        </div>

        <StudentTable />

        <StudentUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
        />
      </main>
    </div>
  );
}
