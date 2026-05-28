import { BarChart2, BookOpen, LayoutGrid } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/topics", label: "Library", icon: LayoutGrid },
  { to: "/due", label: "Queue", icon: BookOpen },
  { to: "/mastery", label: "Insights", icon: BarChart2 },
] as const;

export function MobileNav() {
  const { pathname } = useLocation();

  function isActive(to: string) {
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-line/60 bg-surface/95 lg:hidden"
      aria-label="Mobile navigation"
    >
      {TABS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 px-3 py-2.5 text-[11px] font-medium transition-colors",
            isActive(to)
              ? "text-accent"
              : "text-on-muted hover:text-on-surface",
          )}
        >
          <Icon
            className={cn(
              "size-5 transition-colors",
              isActive(to) ? "text-accent" : "text-on-muted",
            )}
          />
          {label}
        </Link>
      ))}
    </nav>
  );
}
