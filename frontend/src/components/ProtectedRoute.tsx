import { Show } from "@clerk/react";
import { SignInModalTrigger } from "@/components/SignInModalTrigger";

/** Renders children when signed in; otherwise a minimal prompt that opens the auth modal. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-out">
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-on-muted">Sign in to continue</p>
          <SignInModalTrigger label="Sign in" size="lg" />
        </div>
      </Show>
      <Show when="signed-in">{children}</Show>
    </>
  );
}
