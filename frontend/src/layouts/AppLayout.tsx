import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/** Product routes: lock document scroll, fill viewport. See docs/UI_LAYOUT_PLAN.md */
export function AppLayout() {
  useEffect(() => {
    document.body.dataset.appShell = "true";
    return () => {
      delete document.body.dataset.appShell;
    };
  }, []);

  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}
