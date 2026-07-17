'use client';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, GraduationCap } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          <span className="font-bold text-lg tracking-tight">Attendance Mapper</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300 hidden sm:inline-block">
            {user?.employeeName || 'Super Admin'}
          </span>
          <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
