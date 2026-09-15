import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sessionProbable } from "../api/client";
import { useDeconnexion, useMe } from "../api/hooks";
import type { AuthUser } from "../api/types";

interface AuthContextValue {
  user: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Plus de jeton en paramètre : il est arrivé en cookie, hors de portée. */
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  /*
   * L'autorité, c'est le serveur : le cookie de session est `httpOnly`, donc
   * invisible ici. On n'a plus qu'un indice de présence (le cookie anti-CSRF,
   * posé et retiré avec lui) pour éviter d'appeler /auth/me au nom d'un
   * visiteur anonyme. Que l'utilisateur soit réellement connecté, seule la
   * réponse de /auth/me le dit.
   */
  const [sessionOuverte, setSessionOuverte] = useState(sessionProbable);
  const { data: user, isLoading } = useMe(sessionOuverte);
  const deconnexion = useDeconnexion();
  const queryClient = useQueryClient();

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: sessionOuverte && isLoading,
      isAuthenticated: sessionOuverte && !!user,
      login: () => setSessionOuverte(true),
      logout: () => {
        /*
         * Un cookie `httpOnly` ne s'efface pas depuis le JavaScript : il faut
         * que le serveur demande sa suppression. L'état local est remis à
         * zéro sans attendre la réponse — une déconnexion doit paraître
         * immédiate — et le cache est vidé pour qu'aucune donnée du compte
         * quitté ne subsiste à l'écran.
         */
        setSessionOuverte(false);
        queryClient.clear();
        deconnexion.mutate();
      },
    }),
    [user, isLoading, sessionOuverte, deconnexion, queryClient]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
