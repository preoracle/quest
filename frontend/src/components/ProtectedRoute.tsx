import React from "react";
import { useAuth } from "@/components/AuthProvider";
import { Navigate, useLocation } from "react-router-dom";
import { InlineLoader } from "@/components/InlineLoader";

/** Renders children when signed in; shows a spinner while loading; otherwise shows sign-in prompt. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <InlineLoader label="Checking session" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
