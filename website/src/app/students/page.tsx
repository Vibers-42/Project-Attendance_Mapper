'use client';

import React, { useState } from 'react';
import { Navbar } from '@/features/dashboard/components/Navbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload } from 'lucide-react';
import Link from 'next/link';
import { StudentTable } from '@/features/students/components/StudentTable';
import { StudentUploadModal } from '@/features/students/components/StudentUploadModal';

export default function StudentsPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 sm:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Button asChild variant="ghost" size="sm" className="w-fit -ml-3 mb-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Link href="/dashboard" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Student Master Data
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400">
              Manage the master list of students for attendance mapping.
            </p>
          </div>
          <Button onClick={() => setIsUploadModalOpen(true)} className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="w-4 h-4" />
            Upload Students (Excel)
          </Button>
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
