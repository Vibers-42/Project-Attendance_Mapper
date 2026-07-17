'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentService } from '../api/studentService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDebounce } from 'use-debounce';

export function StudentTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 500);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['students', page, debouncedSearch],
    queryFn: () => studentService.getStudents(page, 15, debouncedSearch),
    placeholderData: (prev) => prev,
  });

  const students = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            placeholder="Search by Roll No or Name..." 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset page on search
            }}
            className="pl-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
          />
        </div>
        <div className="text-sm text-zinc-500 font-medium">
          {meta?.total ? `Total Records: ${meta.total}` : 'No records found'}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-950/50">
              <TableRow>
                <TableHead className="w-20">S.No</TableHead>
                <TableHead className="w-32">Roll No</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Timetable</TableHead>
                <TableHead className="w-24 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Loading Students...
                    </div>
                  </TableCell>
                </TableRow>
              )}
              
              {!isLoading && isError && (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-red-500">
                    Failed to load students.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-zinc-500">
                    No students found in Master Data.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium text-zinc-500">{student.serialNo || '-'}</TableCell>
                  <TableCell className="font-semibold">{student.rollNumber}</TableCell>
                  <TableCell>{student.name}</TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400">{student.timetable}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {student.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination Controls */}
        {meta && meta.totalPages > 1 && !debouncedSearch && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/50">
            <div className="text-sm text-zinc-500">
              Page {meta.page} of {meta.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
