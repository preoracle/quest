import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { InlineLoader } from "@/components/InlineLoader";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error_description") ?? params.get("error");
      if (oauthError) {
        if (!cancelled) setError(oauthError);
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session) {
        navigate("/dashboard", { replace: true });
      } else {
        setError("Sign in failed. Please try again.");
      }
    }

    void handleCallback();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-sm text-sm text-on-muted">{error}</p>
        <Link to="/" className="text-sm font-medium text-accent hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <InlineLoader label="Signing you in" />
    </div>
  );
}
