import { describe, expect, it } from "vitest";
import { entetes } from "./parseFile";

/**
 * Les en-têtes d'un export comptable, qui ne sont jamais aussi propres que
 * dans un exemple.
 *
 * Ces cas viennent de vrais fichiers : une colonne de séparation sans titre,
 * un « Libellé » répété entre le compte et l'écriture, une en-tête entourée
 * d'espaces. Chacun, mal traité, fait disparaître une colonne du fichier
 * importé sans que rien ne le signale — et une colonne perdue à l'import,
 * c'est un poste qui manque au bilan.
 */
describe("noms de colonnes", () => {
  it("garde les en-têtes telles quelles", () => {
    expect(entetes(["Compte", "Libellé", "Débit"])).toEqual(["Compte", "Libellé", "Débit"]);
  });

  it("numérote une colonne sans titre plutôt que de la perdre", () => {
    expect(entetes(["Compte", null, "Débit"])).toEqual(["Compte", "Colonne 2", "Débit"]);
    expect(entetes(["Compte", "   ", "Débit"])).toEqual(["Compte", "Colonne 2", "Débit"]);
  });

  it("distingue deux colonnes homonymes", () => {
    // Sans cela, la seconde écrase la première et une colonne disparaît.
    expect(entetes(["Libellé", "Montant", "Libellé"])).toEqual([
      "Libellé",
      "Montant",
      "Libellé (2)",
    ]);
  });

  it("distingue au-delà de deux", () => {
    expect(entetes(["A", "A", "A"])).toEqual(["A", "A (2)", "A (3)"]);
  });

  it("retire les espaces autour du titre", () => {
    expect(entetes(["  Compte  "])).toEqual(["Compte"]);
  });

  it("accepte un en-tête numérique", () => {
    // Un export qui titre ses colonnes par l'année : 2023, 2024, 2025.
    expect(entetes([2023, 2024])).toEqual(["2023", "2024"]);
  });
});
