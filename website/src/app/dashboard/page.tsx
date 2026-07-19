'use client';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { Navbar } from '@/features/dashboard/components/Navbar';
import { DashboardCard } from '@/features/dashboard/components/DashboardCard';
import { Users, BookOpenCheck, CalendarCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api';

interface StatsResponse {
  success: boolean;
  data: { studentCount: number; facultyCount: number; sessionCount: number };
}

function useStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await apiClient.get<StatsResponse>('/admin/stats');
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats } = useStats();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 sm:px-8 py-10 md:py-14 space-y-10">

        {/* Welcome */}
        <section className="space-y-3">
          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            Administration Portal
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back,{' '}
            <span className="text-blue-600 dark:text-blue-400">
              {user?.employeeName || 'Super Admin'}
            </span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-[15px] leading-relaxed max-w-xl">
            Manage students, faculty, and attendance reports from one central place.
          </p>
        </section>

        {/* Cards */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 shrink-0">
              Modules
            </h2>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <DashboardCard
              title="Student Master Data"
              description="Upload and manage the student master list used by the attendance system for QR-based tracking."
              href="/students"
              icon={Users}
              color="blue"
              stat={stats?.studentCount}
              statLabel="students"
            />
            <DashboardCard
              title="Faculty Master Data"
              description="Upload and manage faculty accounts that are used to log in to the Attendance App."
              href="/faculty"
              icon={BookOpenCheck}
              color="indigo"
              stat={stats?.facultyCount}
              statLabel="faculty"
            />
            <DashboardCard
              title="Attendance Reports"
              description="View, filter, and download attendance session workbooks — generated instantly from live session data."
              href="/workbooks"
              icon={CalendarCheck}
              color="violet"
              stat={stats?.sessionCount}
              statLabel="sessions"
            />
          </div>
        </section>

      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-4 mt-auto">
        <div className="text-center space-y-0.5">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-500">Department of AIML</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
            Built by Vijay Chikkala, Sashank Devarakonda, Pavan Guvvala &amp; M.N.B Prasad Reddy
          </p>
        </div>
      </footer>
    </div>
  );
}
