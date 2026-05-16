import { Link, useLocation } from "react-router-dom";
import { MasteryBar } from "./MasteryBar";

const NAV = [
  { to: "/", label: "Catalog" },
  { to: "/mastery", label: "Progress" },
] as const;

export function Layout({
  children,
  topicLabel,
  sessionDepth,
}: {
  children: React.ReactNode;
  topicLabel?: string;
  sessionDepth?: number;
}) {
  const { pathname } = useLocation();
  const onSession = pathname.startsWith("/session");

  return (
    <div className="grain relative flex min-h-screen">
      <nav className="fixed left-0 top-0 z-40 hidden h-full w-64 flex-col border-r border-outline-variant bg-surface-container-low py-8 lg:flex">
        <div className="mb-12 px-8">
          <div className="font-display text-2xl text-primary">The Scholar</div>
          <div className="mt-2 font-mono text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            Deep Work Mode
          </div>
        </div>
        <div className="flex flex-grow flex-col">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-colors ${
                pathname === to
                  ? "border-l-2 border-secondary bg-surface-container-high text-secondary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-secondary"
              }`}
            >
              <span className="mr-3 align-middle text-base opacity-80">◇</span>
              {label}
            </Link>
          ))}
          {onSession && (
            <div className="border-l-2 border-secondary bg-surface-container-high px-8 py-3 font-mono text-xs font-bold uppercase tracking-widest text-secondary">
              ◇ Inquiry
            </div>
          )}
        </div>
      </nav>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface">
          <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-6">
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="font-display text-xl font-bold uppercase tracking-tight text-on-surface"
              >
                Quest
              </Link>
              {topicLabel && (
                <>
                  <div className="h-4 w-px bg-outline-variant" />
                  <span className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
                    {topicLabel}
                  </span>
                </>
              )}
            </div>
            {sessionDepth !== undefined && (
              <div className="hidden items-center gap-4 sm:flex">
                <MasteryBar score={sessionDepth} />
                <span className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
                  Session depth
                </span>
              </div>
            )}
          </div>
        </header>
        <main className="relative z-10 flex-1">{children}</main>
      </div>
    </div>
  );
}
