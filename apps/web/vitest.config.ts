import { defineConfig } from "vitest/config";

/*
 * Les specs du frontend tournaient dans le vide : elles compilaient, mais
 * aucun lanceur ne les exécutait. Un test qui ne s'exécute jamais est pire
 * qu'un test absent — il rassure à tort.
 *
 * Les specs importent describe/it/expect explicitement plutôt que de les
 * recevoir en globales : ainsi ce qu'elles utilisent est typé par le paquet
 * qui le fournit. En globales, le typage passait en local par @types/jest,
 * remonté à la racine depuis l'API — un paquet dont le frontend ne dépend
 * pas. Vercel n'installe que l'espace de travail du frontend : la
 * compilation y échouait, alors qu'elle passait sur ma machine.
 *
 * Environnement « node » et non « jsdom » : ce qui est testé ici, ce sont des
 * fonctions pures (grille tarifaire, calculs de remise). Charger un DOM
 * complet pour cela ralentirait la suite sans rien vérifier de plus.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
