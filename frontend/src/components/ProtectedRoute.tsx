import React from "react";
import { useAuth } from "@/components/AuthProvider";
import { AuthModal } from "@/components/AuthModal";

/** Renders children when signed in; shows a spinner while loading; otherwise shows sign-in prompt. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-on-muted">Sign in to continue</p>
        <AuthModal trigger="Sign in" size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
