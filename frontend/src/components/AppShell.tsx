import { Fragment, useEffect, useState } from "react";
import { AuthControls } from "@/components/AuthControls";
import { MobileNav } from "@/components/MobileNav";
import { QuestLogo } from "@/components/QuestLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BarChart2, BookOpen, Calendar, LayoutGrid, Radio } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { MasteryTicks } from "@/components/MasteryTicks";
import { gutterPx } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { getActiveSession, type ActiveSessionInfo } from "@/lib/activeSession";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: BookOpen },
  { to: "/topics", label: "Topics", icon: LayoutGrid },
  { to: "/due", label: "Due", icon: Calendar },
  { to: "/mastery", label: "Progress", icon: BarChart2 },
] as const;

const PAGE_TITLE: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/topics": "Topics",
  "/due": "Due for review",
  "/mastery": "Progress",
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
  const showSessionBanner = !!activeSession && !onSessionPage && !inSession;

  const pageTitle =
    !breadcrumb && !topicSession ? (PAGE_TITLE[pathname] ?? null) : null;

  function isActive(to: string) {
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  return (
    <div className="noise-overlay mesh-bg flex h-dvh w-full overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-1">

        {/* Sidebar */}
        <aside className="sidebar-bg hidden h-full w-rail shrink-0 flex-col border-r border-line/20 px-4 py-6 backdrop-blur-2xl lg:flex">
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
        </aside>

        {/* Main column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">

          {/* Header — clean flat bar */}
          <header
            className={cn("z-40 shrink-0 header-glass", gutterPx)}
          >
            <div className="flex h-14 items-center gap-3">
              <Link to="/dashboard" className="shrink-0 lg:hidden" aria-label="Dashboard">
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

                {topicSession && (
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

                {pageTitle && (
                  <span className="text-sm font-semibold text-on-surface">
                    {pageTitle}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                {inSession && (
                  <Link
                    to={exitTo ?? "/topics"}
                    className="hidden text-xs font-medium text-on-muted hover:text-on-surface sm:inline"
                  >
                    ← Leave
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
                "flex shrink-0 items-center gap-2 border-b border-accent/20 bg-accent-dim/30 px-5 py-2 text-sm transition-colors hover:bg-accent-dim/50",
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
