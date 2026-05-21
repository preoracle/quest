import { QuestLogo } from "@/components/QuestLogo";
import { Calendar, Home, LayoutGrid, TrendingUp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { MasteryTicks } from "@/components/MasteryTicks";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/topics", label: "Topics", icon: LayoutGrid },
  { to: "/due", label: "Review", icon: Calendar },
  { to: "/mastery", label: "Progress", icon: TrendingUp },
] as const;

export function AppShell({
  children,
  topicLabel,
  inSession,
  masteryScore,
}: {
  children: React.ReactNode;
  topicLabel?: string;
  inSession?: boolean;
  masteryScore?: number;
}) {
  const { pathname } = useLocation();

  function isActive(to: string, exact?: boolean) {
    if (exact) return pathname === to;
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  return (
    <div className="noise-overlay mesh-bg min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1320px]">
        <aside className="hidden w-rail shrink-0 flex-col border-r border-line/60 px-4 py-8 lg:flex">
          <Link to="/" className="group pl-1">
            <QuestLogo size="md" />
          </Link>
          <p className="mt-3 pl-1 text-xs leading-relaxed text-on-muted">
            Think. Answer. Improve.
          </p>
          <nav className="mt-10 flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon, ...rest }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive(to, "exact" in rest && rest.exact)
                    ? "bg-accent-dim font-medium text-accent"
                    : "text-on-muted hover:bg-surface-muted hover:text-on-surface",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-line/60 bg-void/80 backdrop-blur-xl">
            <div className="flex h-14 items-center justify-between gap-4 px-5 lg:px-8">
              <Link to="/" className="lg:hidden">
                <QuestLogo size="sm" />
              </Link>

              <div className="flex min-w-0 flex-1 items-center justify-center gap-2 lg:justify-start">
                {topicLabel && (
                  <span className="truncate rounded-md bg-surface-muted px-2.5 py-1 font-mono text-xs text-on-muted">
                    {topicLabel}
                  </span>
                )}
                {inSession && (
                  <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-accent-dim px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent sm:flex">
                    <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                    Live
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {inSession && (
                  <Link
                    to="/topics"
                    className="hidden text-xs font-medium text-on-muted hover:text-accent sm:inline"
                  >
                    Leave session
                  </Link>
                )}
                {masteryScore !== undefined && masteryScore > 0 && (
                  <MasteryTicks score={masteryScore} />
                )}
                <nav className="flex gap-1 lg:hidden">
                  {NAV.slice(1).map(({ to, label }) => (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-medium",
                        isActive(to)
                          ? "text-accent"
                          : "text-on-muted",
                      )}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </header>
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
