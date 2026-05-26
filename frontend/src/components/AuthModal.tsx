import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AuthModalProps {
  trigger?: string;
  size?: "sm" | "lg" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

/** Sign-in / sign-up modal backed by Supabase Auth. */
export function AuthModal({
  trigger = "Sign in",
  size = "sm",
  variant = "default",
  className,
}: AuthModalProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setOpen(false);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
        setOpen(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(className)}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-line bg-surface-elevated p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-6 text-center text-lg font-semibold text-on-surface">
              {mode === "signin" ? "Sign in to Quest" : "Create your account"}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-void px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-muted focus:border-accent"
              />
              <input
                type="password"
                placeholder="Password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-line bg-void px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-muted focus:border-accent"
              />
              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-on-muted">
              {mode === "signin" ? "No account?" : "Already have one?"}{" "}
              <button
                type="button"
                className="text-accent underline-offset-2 hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
