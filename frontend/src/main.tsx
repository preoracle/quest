import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App.tsx";
import { ClerkEnvGuard } from "./components/ClerkEnvGuard.tsx";
import { ClerkUserSync } from "./components/ClerkUserSync.tsx";

const clerkProviderProps = {
  afterSignOutUrl: "/",
  signInFallbackRedirectUrl: "/dashboard",
  signUpFallbackRedirectUrl: "/dashboard",
} as React.ComponentProps<typeof ClerkProvider>;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider {...clerkProviderProps}>
      <ClerkEnvGuard>
        <QueryClientProvider client={queryClient}>
          <ClerkUserSync />
          <App />
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-line)",
                color: "var(--color-on-surface)",
              },
            }}
          />
        </QueryClientProvider>
      </ClerkEnvGuard>
    </ClerkProvider>
  </StrictMode>,
);
