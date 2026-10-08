import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, marquerSessionOuverte, oublierSession, sessionProbable } from "../api/client";
import { requeteMoi, useDeconnexion, useMe } from "../api/hooks";
import type { AuthUser } from "../api/types";

interface AuthContextValue {
  user: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * À appeler une fois la connexion acceptée par l'API. Relit l'identité
   * auprès du serveur et répond `false` si la session n'est pas reconnue —
   * c'est-à-dire si le navigateur a refusé le cookie qu'on vient de poser.
   */
  login: () => Promise<boolean>;
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
  const { data: user, isLoading, error, refetch } = useMe(sessionOuverte);
  const deconnexion = useDeconnexion();
  const queryClient = useQueryClient();

  /*
   * Le serveur dit que la session n'existe plus (cookie expiré, effacé) : on
   * retire la marque. Restée en place, elle faisait croire à chaque visite
   * qu'une session était ouverte, et c'est ce qui bloquait la connexion
   * suivante — voir login.
   */
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      oublierSession();
      setSessionOuverte(false);
    }
  }, [error]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: sessionOuverte && isLoading,
      isAuthenticated: sessionOuverte && !!user,
      login: async () => {
        /*
         * L'identité est relue ici, explicitement, et non laissée à useMe.
         *
         * Quand la marque de session survivait à un cookie expiré, useMe
         * interrogeait /auth/me dès l'ouverture de la page, recevait un 401
         * et le gardait : il ne relance pas une requête en échec. La
         * connexion réussissait, mais l'identité en cache restait « inconnu »,
         * l'application renvoyait sur l'écran de connexion — et l'utilisateur
         * concluait que son mot de passe était faux. Relire ici remplace ce
         * 401 par la bonne réponse, quel que soit l'état précédent.
         *
         * La marque, elle, remplace l'ancien indice tiré d'un cookie lisible,
         * que ce domaine ne voyait jamais.
         */
        marquerSessionOuverte();
        try {
          await queryClient.fetchQuery(requeteMoi);
        } catch (erreur) {
          if (erreur instanceof ApiError && erreur.status === 401) {
            oublierSession();
            setSessionOuverte(false);
            return false;
          }
          throw erreur;
        }
        setSessionOuverte(true);
        return true;
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
