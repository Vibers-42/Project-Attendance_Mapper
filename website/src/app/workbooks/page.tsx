'use client';

import { Navbar } from '@/features/dashboard/components/Navbar';
import { WorkbookFilters } from '@/features/workbooks/components/WorkbookFilters';
import { WorkbookTable } from '@/features/workbooks/components/WorkbookTable';
import { FileSpreadsheet } from 'lucide-react';

export default function WorkbooksPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Workbook Management
            </h1>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Generate, download, and manage Excel attendance workbooks. Use the filters to instantly build workbooks for specific academic years and subjects.
          </p>
        </div>

        <WorkbookFilters />
        <WorkbookTable />

      </main>
    </div>
  );
}
