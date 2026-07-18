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
  arrowText: string;
  statText: string;
}> = {
  blue: {
    iconBg:    'bg-blue-50 dark:bg-blue-900/20',
    iconText:  'text-blue-600 dark:text-blue-400',
    bar:       'bg-blue-600',
    arrowText: 'text-blue-400 dark:text-blue-500',
    statText:  'text-blue-600 dark:text-blue-400',
  },
  indigo: {
    iconBg:    'bg-indigo-50 dark:bg-indigo-900/20',
    iconText:  'text-indigo-600 dark:text-indigo-400',
    bar:       'bg-indigo-600',
    arrowText: 'text-indigo-400 dark:text-indigo-500',
    statText:  'text-indigo-600 dark:text-indigo-400',
  },
  violet: {
    iconBg:    'bg-violet-50 dark:bg-violet-900/20',
    iconText:  'text-violet-600 dark:text-violet-400',
    bar:       'bg-violet-600',
    arrowText: 'text-violet-400 dark:text-violet-500',
    statText:  'text-violet-600 dark:text-violet-400',
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
      <div className="relative h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-zinc-300 dark:hover:border-zinc-700">

        {/* Colored top accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] ${c.bar}`} />

        <div className="p-5 pt-7 flex flex-col h-full">
          {/* Icon + stat row */}
          <div className="flex items-start justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${c.iconText}`} />
            </div>
            {stat !== undefined && (
              <div className="text-right">
                <p className={`text-2xl font-bold tabular-nums leading-none ${c.statText}`}>
                  {stat.toLocaleString()}
                </p>
                {statLabel && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{statLabel}</p>
                )}
              </div>
            )}
          </div>

          {/* Text */}
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1.5 tracking-tight">
            {title}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed flex-1">
            {description}
          </p>

          {/* Arrow */}
          <div className="mt-4 flex items-center gap-1.5">
            <span className={`text-xs font-medium ${c.arrowText} group-hover:underline`}>
              Open
            </span>
            <ArrowRight
              className={`w-3.5 h-3.5 ${c.arrowText} transition-transform duration-200 group-hover:translate-x-0.5`}
            />
          </div>
        </div>

      </div>
    </Link>
  );
}
