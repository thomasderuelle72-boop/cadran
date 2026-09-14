import { defineConfig } from "vitest/config";

/*
 * Les specs du frontend tournaient dans le vide : elles compilaient, mais
 * aucun lanceur ne les exécutait. Un test qui ne s'exécute jamais est pire
 * qu'un test absent — il rassure à tort.
 *
 * Environnement « node » et non « jsdom » : ce qui est testé ici, ce sont des
 * fonctions pures (grille tarifaire, calculs de remise). Charger un DOM
 * complet pour cela ralentirait la suite sans rien vérifier de plus.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.spec.ts"],
  },
});
