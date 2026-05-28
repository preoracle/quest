import { Fragment, useEffect, useState } from "react";
import { AuthControls } from "@/components/AuthControls";
import { MobileNav } from "@/components/MobileNav";
import { QuestLogo } from "@/components/QuestLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowUpRight, BarChart2, BookOpen, Calendar, LayoutGrid, Radio } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { MasteryTicks } from "@/components/MasteryTicks";
import { gutterPx } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { getActiveSession, type ActiveSessionInfo } from "@/lib/activeSession";

const NAV = [
  { to: "/dashboard", label: "Focus", icon: BookOpen },
  { to: "/topics", label: "Library", icon: LayoutGrid },
  { to: "/due", label: "Queue", icon: Calendar },
  { to: "/mastery", label: "Insights", icon: BarChart2 },
] as const;

const PAGE_TITLE: Record<string, string> = {
  "/dashboard": "Focus",
  "/topics": "Library",
  "/due": "Queue",
  "/mastery": "Insights",
};

export function AppShell({
  children,
  breadcrumb,
  topicSession,
  inSession,
  exitTo,
  masteryScore,
}: {
  children: React.ReactNode;
  breadcrumb?: Array<{ label: string; to?: string }>;
  topicSession?: { name: string; live?: boolean };
  inSession?: boolean;
  exitTo?: string;
  masteryScore?: number;
}) {
  const { pathname } = useLocation();
  const [activeSession, setActiveSessionState] = useState<ActiveSessionInfo | null>(getActiveSession);

  useEffect(() => {
    function sync() { setActiveSessionState(getActiveSession()); }
    window.addEventListener("quest:session-changed", sync);
    return () => window.removeEventListener("quest:session-changed", sync);
  }, []);

  const onSessionPage = pathname.startsWith("/session/");
  const onDashboard = pathname === "/dashboard";
  const showSessionBanner = !!activeSession && !onSessionPage && !inSession && !onDashboard;

  const pageTitle =
    !breadcrumb && !topicSession ? (PAGE_TITLE[pathname] ?? null) : null;

  function isActive(to: string) {
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  return (
    <div className="mesh-bg flex h-dvh w-full overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-1">

        {/* Sidebar — hidden during active sessions to maximise study surface */}
        <aside className={cn("sidebar-bg h-full w-rail shrink-0 flex-col border-r border-line/20 px-4 py-6", inSession ? "hidden" : "hidden lg:flex")}>
          <Link to="/dashboard" className="pl-1">
            <QuestLogo size="md" />
          </Link>
          <p className="mt-2 pl-1 text-xs leading-relaxed text-on-muted/70">
            Master anything.
          </p>
          <nav className="mt-8 flex flex-col gap-0.5">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive(to)
                    ? "bg-accent/10 font-medium text-accent shadow-[0_0_0_1px_rgb(212_168_83/0.15)_inset]"
                    : "text-on-muted hover:bg-surface-muted/60 hover:text-on-surface",
                )}
              >
                <Icon className="size-[1.1rem] shrink-0 opacity-80" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 flex-1" />

          <div className="space-y-2.5">
            <div className="rounded-xl border border-line/30 bg-surface/20 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-on-muted/55">
                Session
              </p>
              {activeSession ? (
                onDashboard ? (
                  <div className="mt-2.5 rounded-lg border border-accent/20 bg-accent-dim/15 px-2.5 py-2">
                    <div className="flex items-center gap-1.5 text-accent">
                      <Radio className="size-3 animate-pulse" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
                        Live now
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-on-surface">
                      {activeSession.topicDisplay}
                    </p>
                    <p className="mt-1 text-[11px] text-on-muted/65">
                      Continue from your focus board
                    </p>
                  </div>
                ) : (
                  <Link
                    to={`/session/${activeSession.sessionId}`}
                    className="mt-2.5 block rounded-lg border border-accent/25 bg-accent-dim/20 px-2.5 py-2 transition-colors hover:bg-accent-dim/35"
                  >
                    <div className="flex items-center gap-1.5 text-accent">
                      <Radio className="size-3 animate-pulse" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
                        Live now
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-on-surface">
                      {activeSession.topicDisplay}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent/85">
                      Resume <ArrowUpRight className="size-3" />
                    </p>
                  </Link>
                )
              ) : (
                <p className="mt-2 text-xs text-on-muted/55">
                  No active session. Pick a topic and begin.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-line/25 bg-surface/10 p-2">
              <Link
                to="/due"
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-on-muted/70 transition-colors hover:bg-surface-muted/35 hover:text-on-surface"
              >
                <span>Review due concepts</span>
                <ArrowUpRight className="size-3" />
              </Link>
              <Link
                to="/mastery"
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-on-muted/70 transition-colors hover:bg-surface-muted/35 hover:text-on-surface"
              >
                <span>See mastery breakdown</span>
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">

          {/* Header — clean flat bar */}
          <header className={cn("z-40 shrink-0 border-b border-line/35 bg-void/92", gutterPx)}>
            <div className="flex h-14 items-center gap-3">
              <Link
                to="/dashboard"
                className={cn("shrink-0", !inSession && "lg:hidden")}
                aria-label="Dashboard"
              >
                <QuestLogo size="sm" />
              </Link>

              <div className="min-w-0 flex-1">
                {breadcrumb && breadcrumb.length > 0 && (
                  <nav
                    className="flex min-w-0 items-center gap-1.5 text-sm text-on-muted"
                    aria-label="Breadcrumb"
                  >
                    {breadcrumb.map((crumb, i) => (
                      <Fragment key={crumb.label}>
                        {i > 0 && <span className="select-none text-on-muted/35">/</span>}
                        {crumb.to ? (
                          <Link
                            to={crumb.to}
                            className="shrink-0 transition-colors hover:text-accent"
                          >
                            {crumb.label}
                          </Link>
                        ) : (
                          <span className="truncate font-medium text-on-surface">
                            {crumb.label}
                          </span>
                        )}
                      </Fragment>
                    ))}
                  </nav>
                )}

                {topicSession && !inSession && (
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-on-surface">
                      {topicSession.name}
                    </span>
                    {topicSession.live && (
                      <span className="shrink-0 rounded-full bg-accent-dim px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-accent">
                        Live
                      </span>
                    )}
                  </div>
                )}

                {pageTitle && pathname !== "/dashboard" && (
                  <span className="text-sm font-semibold text-on-surface">
                    {pageTitle}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {inSession && (
                  <Link
                    to={exitTo ?? "/topics"}
                    className="text-xs font-medium text-on-muted/70 hover:text-on-surface transition-colors border border-line/40 rounded-md px-2.5 py-1 hover:border-line/70"
                  >
                    ← Exit session
                  </Link>
                )}
                {masteryScore !== undefined && masteryScore > 0 && (
                  <MasteryTicks score={masteryScore} />
                )}
                <ThemeToggle />
                <AuthControls />
              </div>
            </div>
          </header>

          {/* "Return to session" banner */}
          {showSessionBanner && (
            <Link
              to={`/session/${activeSession.sessionId}`}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b border-accent/20 bg-accent-dim/30 px-5 py-2 text-sm transition-colors hover:bg-accent-dim/50 lg:hidden",
                gutterPx,
              )}
            >
              <Radio className="size-4 shrink-0 animate-pulse text-accent" />
              <span className="flex-1 truncate text-on-surface">
                {activeSession.topicDisplay}
              </span>
              <span className="shrink-0 text-xs font-medium text-accent">
                Return to session →
              </span>
            </Link>
          )}

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(env(safe-area-inset-bottom)+3.5rem)] lg:pb-0">
            {children}
          </main>
        </div>
      </div>
      {!inSession && <MobileNav />}
    </div>
  );
}
