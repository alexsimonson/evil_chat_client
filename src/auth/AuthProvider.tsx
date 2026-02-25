import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "../types";
import { api } from "../api";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "authed"; user: User }
  | { status: "anon"; user: null };

type AuthCtx = {
  state: AuthState;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setUser: (user: User) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  async function refreshMe() {
    try {
      const { user } = await api.me();
      setState({ status: "authed", user });
    } catch {
      setState({ status: "anon", user: null });
    }
  }

  async function login(email: string, password: string) {
    const { user } = await api.login(email, password);
    setState({ status: "authed", user });
  }

  async function logout() {
    await api.logout();
    setState({ status: "anon", user: null });
  }

  function setUser(user: User) {
    setState({ status: "authed", user });
  }

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ 
      state, 
      user: state.status === "authed" ? state.user : null,
      login, 
      logout, 
      refreshMe,
      setUser,
    }), 
    [state]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
