import { ClerkFailed, ClerkLoaded, ClerkLoading } from "@clerk/react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/** Surfaces Clerk load state and missing publishable key configuration. */
export function ClerkEnvGuard({ children }: { children: React.ReactNode }) {
  if (!PUBLISHABLE_KEY?.startsWith("pk_")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void px-6">
        <div className="max-w-md rounded-lg border border-score-low/40 bg-score-low/10 p-6 text-sm text-on-surface">
          <p className="font-semibold text-score-low">Clerk is not configured</p>
          <p className="mt-2 text-on-muted">
            Add your publishable key to{" "}
            <code className="text-accent">.env.local</code> or the repo root{" "}
            <code className="text-accent">.env</code>:
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-surface-muted p-3 text-xs text-on-muted">
            VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
          </pre>
          <p className="mt-3 text-on-muted">
            Get a key from the{" "}
            <a
              href="https://dashboard.clerk.com/~/api-keys"
              className="text-accent underline"
              target="_blank"
              rel="noreferrer"
            >
              Clerk dashboard
            </a>
            , then restart <code className="text-accent">npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ClerkLoading>
        <div className="flex min-h-screen items-center justify-center bg-void text-sm text-on-muted">
          Loading…
        </div>
      </ClerkLoading>
      <ClerkFailed>
        <div className="flex min-h-screen items-center justify-center bg-void px-6">
          <p className="text-sm text-score-low">
            Clerk failed to load. Check your publishable key and network, then
            refresh.
          </p>
        </div>
      </ClerkFailed>
      <ClerkLoaded>{children}</ClerkLoaded>
    </>
  );
}
