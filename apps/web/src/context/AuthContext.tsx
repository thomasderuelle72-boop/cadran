import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { marquerSessionOuverte, oublierSession, sessionProbable } from "../api/client";
import { useDeconnexion, useMe } from "../api/hooks";
import type { AuthUser } from "../api/types";

interface AuthContextValue {
  user: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Plus de jeton en paramètre : il est arrivé en cookie, hors de portée. */
  login: () => void;
  logout: () => void;
  /**
   * Relit l'identité depuis le serveur, et vide le reste du cache.
   *
   * Appelé quand la session change d'organisation sans passer par une
   * connexion — l'entrée et la sortie d'un accès support. Sans le vidage, les
   * écrans continueraient d'afficher les chiffres de l'organisation quittée,
   * ce qui est la confusion exacte que l'accès support doit éviter.
   */
  refresh: () => Promise<void>;
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
  const { data: user, isLoading, refetch } = useMe(sessionOuverte);
  const deconnexion = useDeconnexion();
  const queryClient = useQueryClient();

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: sessionOuverte && isLoading,
      isAuthenticated: sessionOuverte && !!user,
      login: () => {
        /* La marque remplace l'ancien indice tiré d'un cookie lisible, que
         * ce domaine ne voyait jamais : tout le monde paraissait déconnecté
         * au rechargement, et l'application repartait sur l'écran de
         * connexion alors que la session était bien ouverte. */
        marquerSessionOuverte();
        setSessionOuverte(true);
      },
      logout: () => {
        /*
         * Un cookie `httpOnly` ne s'efface pas depuis le JavaScript : il faut
         * que le serveur demande sa suppression. L'état local est remis à
         * zéro sans attendre la réponse — une déconnexion doit paraître
         * immédiate — et le cache est vidé pour qu'aucune donnée du compte
         * quitté ne subsiste à l'écran.
         */
        setSessionOuverte(false);
        oublierSession();
        queryClient.clear();
        deconnexion.mutate();
      },
      refresh: async () => {
        /* L'identité est retirée du vidage puis relue : la vider avec le
         * reste ferait repasser l'application par l'écran de connexion le
         * temps d'un aller-retour. */
        queryClient.removeQueries({ predicate: (requete) => requete.queryKey[0] !== "me" });
        await refetch();
      },
    }),
    [user, isLoading, sessionOuverte, deconnexion, queryClient, refetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
