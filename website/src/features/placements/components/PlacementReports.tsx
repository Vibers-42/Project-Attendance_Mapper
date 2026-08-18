'use client';

import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { WorkbookTable } from '../../workbooks/components/WorkbookTable';

export function PlacementReports() {
  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/30 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Placement Attendance Reports
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Consolidated workbooks and session records for placement drives
            </p>
          </div>
        </div>
      </div>

      <WorkbookTable moduleType="placement" />
    </div>
  );
}
