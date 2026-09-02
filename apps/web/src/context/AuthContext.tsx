import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { getToken, setToken as persistToken } from "../api/client";
import { useMe } from "../api/hooks";
import type { AuthUser } from "../api/types";

interface AuthContextValue {
  user: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState(() => !!getToken());
  const { data: user, isLoading } = useMe(hasToken);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: hasToken && isLoading,
      isAuthenticated: hasToken && !!user,
      login: (token, loggedInUser) => {
        persistToken(token);
        setHasToken(true);
        // useMe se rechargera au prochain rendu grâce à `enabled`; on force un accès
        // immédiat en renseignant la donnée en cache serait plus élégant mais un
        // simple re-fetch suffit pour le MVP.
        void loggedInUser;
      },
      logout: () => {
        persistToken(null);
        setHasToken(false);
      },
    }),
    [user, isLoading, hasToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
