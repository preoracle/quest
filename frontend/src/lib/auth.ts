/** OAuth redirect target — must match Supabase Auth → URL Configuration → Redirect URLs. */
export function authCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

/** Best display label for a Supabase user (Google profile name, then email). */
export function userDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "name"] as const) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (user.email) return user.email.split("@")[0] ?? "User";
  return "User";
}
