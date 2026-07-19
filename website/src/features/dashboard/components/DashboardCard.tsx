import { LucideIcon, ArrowRight } from 'lucide-react';
import Link from 'next/link';

type CardColor = 'blue' | 'indigo' | 'violet';

interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color?: CardColor;
  stat?: number;
  statLabel?: string;
}

const COLOR_MAP: Record<CardColor, {
  iconBg: string;
  iconText: string;
  bar: string;
  linkText: string;
  statText: string;
  badgeBg: string;
}> = {
  blue: {
    iconBg:   'bg-blue-50 dark:bg-blue-900/20',
    iconText: 'text-blue-600 dark:text-blue-400',
    bar:      'bg-gradient-to-r from-blue-500 to-blue-600',
    linkText: 'text-blue-600 dark:text-blue-400',
    statText: 'text-blue-600 dark:text-blue-400',
    badgeBg:  'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  },
  indigo: {
    iconBg:   'bg-indigo-50 dark:bg-indigo-900/20',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    bar:      'bg-gradient-to-r from-indigo-500 to-indigo-600',
    linkText: 'text-indigo-600 dark:text-indigo-400',
    statText: 'text-indigo-600 dark:text-indigo-400',
    badgeBg:  'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  },
  violet: {
    iconBg:   'bg-violet-50 dark:bg-violet-900/20',
    iconText: 'text-violet-600 dark:text-violet-400',
    bar:      'bg-gradient-to-r from-violet-500 to-violet-600',
    linkText: 'text-violet-600 dark:text-violet-400',
    statText: 'text-violet-600 dark:text-violet-400',
    badgeBg:  'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
  },
};

export function DashboardCard({
  title,
  description,
  href,
  icon: Icon,
  color = 'blue',
  stat,
  statLabel,
}: DashboardCardProps) {
  const c = COLOR_MAP[color];

  return (
    <Link href={href} className="block group h-full">
      <div className="relative h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-zinc-300 dark:hover:border-zinc-700">

        {/* Colored top accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] ${c.bar}`} />

        <div className="p-6 pt-7 flex flex-col h-full">
          {/* Icon + stat row */}
          <div className="flex items-start justify-between mb-5">
            <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgb(0,0,0,0.04)]`}>
              <Icon className={`w-5 h-5 ${c.iconText}`} />
            </div>
            {stat !== undefined && (
              <div className="text-right">
                <p className={`text-2xl font-bold tabular-nums leading-none tracking-tight ${c.statText}`}>
                  {stat.toLocaleString()}
                </p>
                {statLabel && (
                  <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-1 uppercase tracking-wide">{statLabel}</p>
                )}
              </div>
            )}
          </div>

          {/* Text */}
          <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            {title}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed flex-1">
            {description}
          </p>

          {/* Footer link */}
          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <span className={`text-xs font-semibold ${c.linkText} group-hover:underline underline-offset-2`}>
              Open module
            </span>
            <ArrowRight
              className={`w-3.5 h-3.5 ${c.linkText} transition-transform duration-200 group-hover:translate-x-1`}
            />
          </div>
        </div>

      </div>
    </Link>
  );
}
