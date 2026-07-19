import { LoginForm } from '@/features/auth/components/LoginForm';
import { GraduationCap, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  'Real-time QR attendance tracking',
  'Instant Excel workbook generation',
  'Multi-room & multi-faculty support',
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">

      {/* ── Left Brand Panel ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-2/5 bg-gradient-to-br from-blue-600 to-blue-700 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-0 w-48 h-48 rounded-full bg-blue-500/30 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute top-1/3 left-1/4 w-24 h-24 rounded-full bg-white/5" />

        {/* Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-[15px] tracking-tight">Attendance Mapper</span>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Attendance,<br />made effortless.
            </h1>
            <p className="text-blue-100/90 text-[15px] leading-relaxed max-w-xs">
              The administration portal for managing students, faculty, and session reports — all in one place.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-blue-50 text-sm">
                <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-blue-200/50 text-xs">
          © {new Date().getFullYear()} Attendance Mapper
        </p>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-zinc-50 dark:bg-zinc-950">
        {/* Mobile brand header */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">Attendance Mapper</span>
        </div>

        <LoginForm />
      </div>

    </div>
  );
}
