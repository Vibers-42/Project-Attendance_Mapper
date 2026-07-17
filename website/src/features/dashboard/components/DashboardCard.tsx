import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export function DashboardCard({ title, description, href, icon: Icon }: DashboardCardProps) {
  return (
    <Link href={href} className="block group h-full">
      <Card className="h-full transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-1 border-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 pointer-events-none">
          <Icon className="w-32 h-32 text-blue-600 dark:text-blue-400" />
        </div>
        <CardHeader>
          <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
            <Icon className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-zinc-600 dark:text-zinc-400 text-base leading-relaxed">
            {description}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
