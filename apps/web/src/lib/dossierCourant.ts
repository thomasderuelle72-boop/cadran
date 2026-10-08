import { useEffect, useSyncExternalStore } from "react";

/**
 * Le dossier sur lequel on travaille, partagé entre tous les écrans.
 *
 * Chaque écran tenait sa propre sélection et repartait du premier dossier de
 * la liste. Dans un cabinet de quinze dossiers, choisir « Bastide » au tableau
 * de bord puis ouvrir le diagnostic ramenait sur « Atelier Nova » : on lisait
 * les chiffres d'un client en croyant regarder ceux d'un autre. C'est aussi ce
 * qui rendait impossible d'ouvrir un dossier depuis le portefeuille.
 *
 * Le choix est mémorisé dans le navigateur, pour survivre à un rechargement.
 * Ce n'est qu'une commodité : si le stockage est indisponible (navigation
 * privée, cookies bloqués), on retombe sur le premier dossier, comme avant.
 * Et un identifiant mémorisé qui n'appartient pas à l'organisation en cours —
 * après une session support chez un client, par exemple — est ignoré : l'API
 * refuserait de toute façon de servir un dossier d'une autre organisation.
 */

const CLE = "cadran.dossier-courant";

function lire(): string | null {
  try {
    return window.localStorage.getItem(CLE);
  } catch {
    return null;
  }
}

let courant: string | null = typeof window === "undefined" ? null : lire();
const abonnes = new Set<() => void>();

export function choisirDossier(id: string): void {
  if (!id || id === courant) return;
  courant = id;
  try {
    window.localStorage.setItem(CLE, id);
  } catch {
    // Stockage indisponible : le choix vaut pour la session de la page.
  }
  abonnes.forEach((prevenir) => prevenir());
}

function sAbonner(prevenir: () => void): () => void {
  abonnes.add(prevenir);
  return () => abonnes.delete(prevenir);
}

/**
 * Le dossier courant, validé contre la liste des dossiers de l'organisation.
 *
 * Renvoie une chaîne vide tant que la liste n'est pas chargée, comme le
 * faisaient les écrans jusqu'ici.
 */
export function useDossierCourant(
  entites: ReadonlyArray<{ id: string }> | undefined,
): [string, (id: string) => void] {
  const memorise = useSyncExternalStore(
    sAbonner,
    () => courant,
    () => null,
  );
  const connu = memorise !== null && entites?.some((e) => e.id === memorise);
  const dossier = connu ? memorise : (entites?.[0]?.id ?? "");

  useEffect(() => {
    if (dossier && dossier !== courant) choisirDossier(dossier);
  }, [dossier]);

  return [dossier, choisirDossier];
}
