import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setToken, fetchTopics, fetchDue, fetchProgressSummary } from "@/api/client";
import { queryClient } from "@/lib/queryClient";
import { analytics } from "@/lib/analytics";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

/** Eagerly warm the most-used queries so the Dashboard renders instantly. */
function prefetchDashboard() {
  queryClient.prefetchQuery({
    queryKey: ["topics", "", false],
    queryFn: () => fetchTopics({ q: "", includeArchived: false }),
    staleTime: 30_000,
  });
  queryClient.prefetchQuery({
    queryKey: ["due"],
    queryFn: () => fetchDue(),
    staleTime: 60_000,
  });
  queryClient.prefetchQuery({
    queryKey: ["progress-summary"],
    queryFn: () => fetchProgressSummary(),
    staleTime: 30_000,
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setToken(data.session?.access_token ?? null);
      setLoading(false);
      if (data.session?.user) {
        analytics.identify(data.session.user.id, data.session.user.user_metadata?.full_name);
        prefetchDashboard();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setToken(s?.access_token ?? null);
      // Flush cache so queries re-run with the new auth token
      queryClient.invalidateQueries();
      if (s?.user) {
        analytics.identify(s.user.id, s.user.user_metadata?.full_name);
        prefetchDashboard();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
