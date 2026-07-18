'use client';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/students',  label: 'Students'  },
  { href: '/faculty',   label: 'Faculty'   },
  { href: '/workbooks', label: 'Reports'   },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const initials = (user?.employeeName ?? 'SA')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="container mx-auto flex h-15 items-center gap-6 px-4 sm:px-8" style={{ height: '60px' }}>

        {/* Brand */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-[15px] tracking-tight">Attendance Mapper</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive =
              href === '/dashboard'
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden sm:flex items-center gap-2.5 pr-2 border-r border-zinc-200 dark:border-zinc-800 mr-1">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">{initials}</span>
            </div>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 max-w-[140px] truncate">
              {user?.employeeName || 'Super Admin'}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 h-8 px-2.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Sign out</span>
          </Button>
        </div>

      </div>
    </header>
  );
}
