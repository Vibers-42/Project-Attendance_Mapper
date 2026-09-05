'use client';

import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentTable } from '../../students/components/StudentTable';
import { StudentUploadModal } from '../../students/components/StudentUploadModal';

export function PlacementStudentMaster() {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Action bar — the tab description above already covers what this list is */}
      <div className="flex justify-end">
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
