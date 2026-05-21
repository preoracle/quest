import { motion, useReducedMotion } from "framer-motion";
import { QuestLogo } from "@/components/QuestLogo";
import { useEffect, useState } from "react";

export function Preloader({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduce) {
      onDone();
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 800);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(onDone, 200);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone, reduce]);

  if (reduce) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-void"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <QuestLogo size="lg" />
      <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full bg-accent"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </motion.div>
  );
}
