import Lenis from "lenis";
import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";

/** Smooth scroll — home page only; respects reduced motion. */
export function useLenis(enabled: boolean) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!enabled || reduce) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [enabled, reduce]);
}
