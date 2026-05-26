import React from "react";
import { useAuth } from "@/components/AuthProvider";
import { AuthModal } from "@/components/AuthModal";

/** Renders children when signed in; otherwise shows the sign-in prompt. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
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
