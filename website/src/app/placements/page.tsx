'use client';

import React, { useState } from 'react';
import { Navbar } from '@/features/dashboard/components/Navbar';
import { PlacementStudentMaster } from '@/features/placements/components/PlacementStudentMaster';
import { PlacementReports } from '@/features/placements/components/PlacementReports';
import { ChevronLeft, Briefcase, GraduationCap, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';

type TabId = 'students' | 'reports';

const TABS: { id: TabId; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'students',
    label: 'Placement Student Master Data',
    icon: <GraduationCap className="w-3.5 h-3.5" />,
    description: 'Master list of registered placement candidates and roll numbers',
  },
  {
    id: 'reports',
    label: 'Placement Reports',
    icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
    description: 'View and export attendance reports from placement sessions',
  },
];

export default function PlacementsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('students');

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

          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Placement Module
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-2xl">
                Manage placement candidate master data and view attendance session reports.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 mb-3 p-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                ${activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-800'}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab description */}
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-6 ml-1">
          {TABS.find(t => t.id === activeTab)?.description}
        </p>

        {activeTab === 'students' && <PlacementStudentMaster />}
        {activeTab === 'reports'  && <PlacementReports />}

      </main>
    </div>
  );
}
