'use client';

import React, { useState } from 'react';
import { Users, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentTable } from '../../students/components/StudentTable';
import { StudentUploadModal } from '../../students/components/StudentUploadModal';

export function PlacementStudentMaster() {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Placement Student Master List
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Registered candidates eligible for placement drives and sessions
            </p>
          </div>
        </div>

        <Button
          onClick={() => setUploadOpen(true)}
          className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          <Upload className="w-4 h-4" />
          Upload Candidate List (Excel)
        </Button>
      </div>

      <StudentUploadModal 
        isOpen={uploadOpen} 
        onClose={() => setUploadOpen(false)} 
        moduleType="placement" 
      />

      <StudentTable moduleType="placement" />
    </div>
  );
}
