import { useCallback, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "quest:theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute("data-theme") as Theme) ?? "dark",
  );

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  return { theme, toggle } as const;
}
