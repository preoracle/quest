/** OAuth redirect target — must match Supabase Auth → URL Configuration → Redirect URLs. */
export function authCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}
