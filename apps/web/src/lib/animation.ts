import { useEffect, useRef, useState } from "react";

/** Le système demande-t-il de limiter les animations ? */
export function mouvementReduit(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Un nombre qui rejoint sa valeur en glissant, plutôt que de sauter.
 *
 * Au changement de période, on voit le chiffre monter ou descendre : le sens
 * de la variation se lit avant même le chiffre. L'effet dure 0,7 s, s'arrête
 * net sur la valeur exacte, et disparaît pour qui a demandé moins
 * d'animations à son système.
 */
export function useCompteur(cible: number, duree = 700): number {
  const [affiche, setAffiche] = useState(() => (mouvementReduit() ? cible : 0));
  const courant = useRef(affiche);

  useEffect(() => {
    const depart = courant.current;
    if (mouvementReduit() || depart === cible || !Number.isFinite(cible)) {
      courant.current = cible;
      setAffiche(cible);
      return;
    }
    const debut = performance.now();
    let image = 0;
    const pas = (maintenant: number) => {
      const avancee = Math.min(1, (maintenant - debut) / duree);
      // Départ vif, arrivée douce : l'œil voit le mouvement, puis la valeur.
      const valeur = depart + (cible - depart) * (1 - Math.pow(1 - avancee, 3));
      courant.current = valeur;
      setAffiche(avancee === 1 ? cible : valeur);
      if (avancee < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [cible, duree]);

  return affiche;
}

/**
 * Vrai une image après le montage : de quoi déclencher une transition CSS
 * depuis l'état initial (une jauge qui se remplit, une barre qui s'étend).
 */
export function useMonte(): boolean {
  const [monte, setMonte] = useState(false);
  useEffect(() => {
    const image = requestAnimationFrame(() => setMonte(true));
    return () => cancelAnimationFrame(image);
  }, []);
  return monte;
}
