import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import * as Sentry from "@sentry/react";
import posthog from "posthog-js";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./components/AuthProvider.tsx";
import { queryClient } from "./lib/queryClient.ts";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,
  });
}

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com",
    capture_pageview: true,
    autocapture: false,
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p className="p-8 text-center text-sm text-red-400">Something went wrong. Please refresh.</p>}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
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
      </AuthProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
