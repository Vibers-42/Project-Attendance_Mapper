'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workbookService } from '../api/workbookService';
import { toast } from 'sonner';

export function WorkbookFilters() {
  const [academicYear, setAcademicYear] = useState<string>('2nd Year');
  const [topic, setTopic] = useState<string>('All');
  
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: () => {
      // Map UI values to backend expected values if necessary, but backend is flexible
      // We pass topic as undefined if "All" is selected
      const apiTopic = topic === 'All' ? undefined : topic;
      // We can pass academicYearId directly. If backend needs specific UUID, 
      // it would need a lookup. We assume backend handles the string mapping or accepts these names.
      return workbookService.generateWorkbook(academicYear, apiTopic);
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Workbook generated successfully!');
      queryClient.invalidateQueries({ queryKey: ['workbooks'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to generate workbook';
      toast.error(msg);
    }
  });

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-6 items-end justify-between mb-6">
      
      <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto">
        
        {/* Academic Year Radio Cards */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Academic Year</label>
          <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg w-fit">
            {['2nd Year', '3rd Year'].map((year) => (
              <button
                key={year}
                onClick={() => setAcademicYear(year)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  academicYear === year 
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Topic Dropdown */}
        <div className="space-y-2 min-w-[200px]">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Topic</label>
          <Select value={topic} onValueChange={(val) => setTopic(val || 'All')}>
            <SelectTrigger className="w-full bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
              <SelectValue placeholder="Select Topic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Topics</SelectItem>
              <SelectItem value="Soft Skills">Soft Skills</SelectItem>
              <SelectItem value="Aptitude">Aptitude</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      <Button 
        onClick={() => generateMutation.mutate()} 
        disabled={generateMutation.isPending}
        className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto h-[42px]"
      >
        {generateMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4" />
        )}
        {generateMutation.isPending ? 'Generating...' : 'Generate Workbook'}
      </Button>

    </div>
  );
}
