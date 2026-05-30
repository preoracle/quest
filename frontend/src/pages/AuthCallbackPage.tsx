import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { InlineLoader } from "@/components/InlineLoader";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") ?? params.get("error");
    if (oauthError) {
      setError(oauthError);
      return;
    }

    let settled = false;
    const finish = (ok: boolean, message?: string) => {
      if (settled) return;
      settled = true;
      if (ok) {
        navigate("/dashboard", { replace: true });
      } else {
        setError(message ?? "Sign in failed. Please try again.");
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        finish(true);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(true);
    });

    const timeout = window.setTimeout(() => {
      finish(false, "Sign in timed out. Please try again.");
    }, 15000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
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
