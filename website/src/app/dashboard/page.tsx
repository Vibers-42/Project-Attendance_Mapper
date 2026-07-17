'use client';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { Navbar } from '@/features/dashboard/components/Navbar';
import { DashboardCard } from '@/features/dashboard/components/DashboardCard';
import { Users, FileSpreadsheet, BookOpenCheck } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950 font-sans">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 sm:px-8 py-8 md:py-12 space-y-10">
        
        {/* Welcome Section */}
        <section className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome, <br className="sm:hidden" />
            <span className="text-blue-600 dark:text-blue-500">{user?.employeeName || 'Admin'}</span>
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Attendance Mapper Administration Portal
          </p>
        </section>

        {/* Dashboard Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashboardCard
            title="Student Master Data"
            description="Upload and manage Student Master Data used by the attendance system."
            href="/students"
            icon={Users}
          />
          <DashboardCard
            title="Faculty Master Data"
            description="Upload and manage Faculty accounts used by the Faculty Attendance App."
            href="/faculty"
            icon={BookOpenCheck}
          />
          <DashboardCard
            title="Workbook Generation"
            description="Generate and download Attendance Workbooks."
            href="/workbooks"
            icon={FileSpreadsheet}
          />
        </section>

      </main>
    </div>
  );
}
