import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { QuestLogo } from "@/components/QuestLogo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
        "fixed top-0 right-0 left-0 z-40 border-b border-line/50 bg-void/70 backdrop-blur-xl",
        !reduce && "transition-transform duration-300 ease-out",
        hidden && !reduce && "-translate-y-full",
      )}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link to="/" className="flex items-center">
          <QuestLogo size="sm" />
        </Link>
        <Button asChild size="sm">
          <Link to="/topics">Start studying</Link>
        </Button>
      </div>
    </motion.header>
  );
}
