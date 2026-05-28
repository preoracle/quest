import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthControls } from "@/components/AuthControls";
import { QuestLogo } from "@/components/QuestLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY && y > 100) setHidden(true);
      else setHidden(false);
      setLastY(y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastY]);

  return (
    <motion.header
      className={cn(
        "fixed top-0 right-0 left-0 z-40 border-b border-line/50 bg-void/90",
        !reduce && "transition-transform duration-300 ease-out",
        hidden && !reduce && "-translate-y-full",
      )}
    >
      <div className="mx-auto flex h-16 max-w-catalog items-center justify-between px-gutter-app">
        <Link to="/" className="flex items-center">
          <QuestLogo size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AuthControls />
        </div>
      </div>
    </motion.header>
  );
}
