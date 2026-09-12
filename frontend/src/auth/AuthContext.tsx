import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, apiErrorMessage, registerAuthHandlers, setAccessToken } from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// module-level, not component state, so StrictMode's double-invoked mount
// effect can't fire this twice. the refresh token is single-use, so two
// concurrent calls would race and one clobbers the other's result
let initialRefreshPromise: Promise<void> | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshSession(): Promise<string | null> {
    try {
      const res = await api.post("/auth/refresh");
      setAccessToken(res.data.data.accessToken);
      setUser(res.data.data.user);
      return res.data.data.accessToken;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }

  useEffect(() => {
    registerAuthHandlers(refreshSession, () => {
      setAccessToken(null);
      setUser(null);
    });
    // On first load there's no access token in memory yet, so try to
    // silently mint one from the httpOnly refresh cookie.
    if (!initialRefreshPromise) {
      initialRefreshPromise = refreshSession().then(() => undefined);
    }
    initialRefreshPromise.finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    setAccessToken(res.data.data.accessToken);
    setUser(res.data.data.user);
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { apiErrorMessage };
