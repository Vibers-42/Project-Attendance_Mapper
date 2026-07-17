'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workbookService, GeneratedWorkbook } from '../api/workbookService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Download, Trash2, FileSpreadsheet, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function WorkbookTable() {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['workbooks'],
    queryFn: workbookService.listWorkbooks,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workbookService.deleteWorkbook(id),
    onSuccess: () => {
      toast.success('Workbook deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['workbooks'] });
    },
    onError: () => toast.error('Failed to delete workbook')
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => workbookService.bulkDeleteWorkbooks(ids),
    onSuccess: (data) => {
      toast.success(data.message || 'Workbooks deleted successfully');
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['workbooks'] });
    },
    onError: () => toast.error('Failed to delete workbooks')
  });

  const workbooks = data?.data || [];
  
  const filteredWorkbooks = workbooks.filter(wb => 
    wb.name.toLowerCase().includes(search.toLowerCase()) || 
    new Date(wb.createdAt).toLocaleDateString().includes(search)
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredWorkbooks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWorkbooks.map(w => w.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} workbooks?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this workbook?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Bulk Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[72px]">
        
        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-4 w-full">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {selectedIds.size} selected
            </span>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="gap-2"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input 
                placeholder="Search by name or date..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
              />
            </div>
            <div className="text-sm text-zinc-500 font-medium">
              Total: {filteredWorkbooks.length} Workbooks
            </div>
          </>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-950/50">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <Checkbox 
                    checked={filteredWorkbooks.length > 0 && selectedIds.size === filteredWorkbooks.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Workbook Name</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Generated Date</TableHead>
                <TableHead className="w-32 text-center">Status</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Loading Workbooks...
                    </div>
                  </TableCell>
                </TableRow>
              )}
              
              {!isLoading && isError && (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-red-500">
                    Failed to load workbooks.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && filteredWorkbooks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500 gap-3">
                      <FileSpreadsheet className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
                      <p>No workbooks found.</p>
                      {search && (
                        <Button variant="link" onClick={() => setSearch('')}>Clear Search</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && filteredWorkbooks.map((wb: GeneratedWorkbook) => (
                <TableRow key={wb.id}>
                  <TableCell className="text-center">
                    <Checkbox 
                      checked={selectedIds.has(wb.id)}
                      onCheckedChange={() => toggleSelect(wb.id)}
                      aria-label="Select row"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">
                    {wb.name}
                  </TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400">
                    {wb.academicYearId || 'All Years'}
                  </TableCell>
                  <TableCell className="text-zinc-600 dark:text-zinc-400">
                    {wb.topic || 'All Topics'}
                  </TableCell>
                  <TableCell className="text-zinc-500 text-sm">
                    {new Date(wb.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Ready
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 text-blue-600 hover:text-blue-700"
                        onClick={() => {
                          toast.promise(workbookService.downloadWorkbook(wb.id, wb.name), {
                            loading: 'Downloading...',
                            success: 'Download complete!',
                            error: 'Failed to download file'
                          });
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(wb.id)}
                        disabled={deleteMutation.isPending && deleteMutation.variables === wb.id}
                      >
                        {deleteMutation.isPending && deleteMutation.variables === wb.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
