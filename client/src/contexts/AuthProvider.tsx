/**
 * AuthProvider — drop-in replacement for Auth0Provider.
 *
 * Exposes the same useAuth() hook API shape that was used as useAuth0():
 *   { user, isAuthenticated, isLoading, loginWithRedirect, logout, getAccessTokenSilently }
 *
 * Backed by @supabase/supabase-js GitHub OAuth.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

/** Normalised user shape — mirrors Auth0's user object fields used in the app. */
export interface AuthUser {
  /** GitHub handle, e.g. "octocat" — was user.nickname in Auth0 */
  nickname: string;
  /** Display name — was user.name in Auth0 */
  name: string;
  /** Avatar URL — was user.picture in Auth0 */
  picture: string;
  /** Primary email */
  email: string;
  /** Raw Supabase user for advanced usage */
  _raw: User;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Kicks off GitHub OAuth redirect — mirrors loginWithRedirect() */
  loginWithRedirect: (opts?: { appState?: { returnTo?: string } }) => Promise<void>;
  /** Signs the user out — mirrors logout() */
  logout: () => Promise<void>;
  /** Returns the current JWT access token — mirrors getAccessTokenSilently() */
  getAccessTokenSilently: () => Promise<string>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function toAuthUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  return {
    nickname: meta.user_name ?? meta.preferred_username ?? user.email?.split("@")[0] ?? "",
    name: meta.full_name ?? meta.name ?? "",
    picture: meta.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.full_name ?? user.email ?? "U")}&background=0D8ABC&color=fff`,
    email: user.email ?? "",
    _raw: user,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hydrate from persisted session on mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setUser(toAuthUser(data.session.user));
      }
      setIsLoading(false);
    });

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession ? toAuthUser(newSession.user) : null);
      setIsLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loginWithRedirect = useCallback(
    async (opts?: { appState?: { returnTo?: string } }) => {
      const redirectTo = `${window.location.origin}${opts?.appState?.returnTo ? `?returnTo=${encodeURIComponent(opts.appState.returnTo)}` : ""}`;
      await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo },
      });
    },
    [],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const getAccessTokenSilently = useCallback(async (): Promise<string> => {
    // Try current session first
    if (session?.access_token) return session.access_token;

    // Force-refresh to get a fresh JWT
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) throw new Error("Session expired — please log in again.");
    return data.session.access_token;
  }, [session]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook — drop-in for useAuth0()
// ──────────────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used inside <AuthProvider>");
  return ctx;
}
