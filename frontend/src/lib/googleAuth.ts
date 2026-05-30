import { supabase } from "@/lib/supabase";

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type GsiCredentialResponse = {
  credential: string;
};

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GsiCredentialResponse) => void;
        auto_select?: boolean;
        ux_mode?: "popup" | "redirect";
        context?: "signin" | "signup" | "use";
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, string | number | boolean>,
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let gsiLoadPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Identity Services failed to load")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services failed to load"));
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}

export function hasGoogleClientId(): boolean {
  return Boolean(googleClientId?.trim());
}

/**
 * Sign in via Google Identity Services popup + Supabase signInWithIdToken.
 * Shows "continue to questt-ai.vercel.app" (your app) instead of supabase.co.
 */
export async function signInWithGoogleIdToken(): Promise<void> {
  const clientId = googleClientId?.trim();
  if (!clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID is not configured");
  }

  await loadGsiScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: response.credential,
          });
          if (error) finish(() => reject(error));
          else finish(() => resolve());
        } catch (err) {
          finish(() => reject(err instanceof Error ? err : new Error("Google sign in failed")));
        }
      },
      auto_select: false,
      ux_mode: "popup",
      context: "signin",
    });

    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none";
    document.body.appendChild(host);

    window.google!.accounts.id.renderButton(host, {
      type: "standard",
      theme: "outline",
      size: "large",
    });

    const btn = host.querySelector('[role="button"]') as HTMLElement | null;
    if (!btn) {
      host.remove();
      reject(new Error("Google Sign-In is unavailable"));
      return;
    }

    btn.click();
    window.setTimeout(() => host.remove(), 5000);
  });
}
