import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, X } from "lucide-react";
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-on-muted/70">
        {label}
      </span>
      {children}
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-line/70 bg-surface px-3.5 text-sm text-on-surface outline-none transition-all duration-150 placeholder:text-on-muted/40 focus:border-accent/50 focus:ring-2 focus:ring-accent/10";

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
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => firstRef.current?.focus(), 80);
  }, [open, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setOpen(false);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() || undefined } },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
        setOpen(false);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: "signin" | "signup") {
    if (m === mode) return;
    setMode(m);
    setEmail("");
    setPassword("");
    setName("");
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(className)}
        onClick={() => { setOpen(true); setMode("signin"); }}
      >
        {trigger}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-void/80 backdrop-blur-lg"
              onClick={() => setOpen(false)}
            />

            {/* Card */}
            <motion.div
              className="relative z-10 w-full max-w-[400px]"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative overflow-hidden rounded-2xl border border-line/50 bg-surface-elevated shadow-[0_24px_80px_rgba(0,0,0,0.5)]">

                {/* Subtle glow behind the card */}
                <div className="pointer-events-none absolute -top-24 left-1/2 size-48 -translate-x-1/2 rounded-full bg-accent/8 blur-3xl" />

                {/* Close */}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 z-10 flex size-7 items-center justify-center rounded-lg text-on-muted/60 transition-colors hover:bg-surface-muted hover:text-on-surface"
                  aria-label="Close"
                >
                  <X className="size-3.5" />
                </button>

                {/* Brand */}
                <div className="flex flex-col items-center px-8 pt-8 pb-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                    <span className="font-display text-sm font-semibold tracking-wide text-on-surface">
                      Quest
                    </span>
                  </div>

                  {/* Mode tabs */}
                  <div className="flex w-full rounded-xl border border-line/60 bg-surface/60 p-1">
                    {(["signin", "signup"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => switchMode(m)}
                        className={cn(
                          "flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-150",
                          mode === m
                            ? "bg-surface-elevated text-on-surface shadow-sm"
                            : "text-on-muted hover:text-on-surface",
                        )}
                      >
                        {m === "signin" ? "Sign in" : "Sign up"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-8 pb-8">

                  <AnimatePresence mode="wait">
                    {mode === "signup" && (
                      <motion.div
                        key="name"
                        initial={{ opacity: 0, height: 0, marginBottom: -8 }}
                        animate={{ opacity: 1, height: "auto", marginBottom: 0 }}
                        exit={{ opacity: 0, height: 0, marginBottom: -8 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <Field label="Name">
                          <input
                            ref={mode === "signup" ? firstRef : undefined}
                            type="text"
                            placeholder="Your name (optional)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputCls}
                          />
                        </Field>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Field label="Email">
                    <input
                      ref={mode === "signin" ? firstRef : undefined}
                      type="email"
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Password">
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                        required
                        minLength={6}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={cn(inputCls, "pr-11")}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-muted/50 transition-colors hover:text-on-surface"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword
                          ? <EyeOff className="size-4" />
                          : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Field>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="mt-1 h-11 w-full text-sm font-semibold"
                  >
                    {loading
                      ? <span className="flex items-center gap-2">
                          <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          {mode === "signin" ? "Signing in…" : "Creating account…"}
                        </span>
                      : mode === "signin" ? "Sign in" : "Create account"}
                  </Button>

                  <p className="text-center text-xs text-on-muted/60">
                    {mode === "signin"
                      ? "New here? "
                      : "Already have an account? "}
                    <button
                      type="button"
                      className="font-medium text-accent/80 underline-offset-2 hover:text-accent hover:underline"
                      onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                    >
                      {mode === "signin" ? "Create a free account" : "Sign in instead"}
                    </button>
                  </p>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
