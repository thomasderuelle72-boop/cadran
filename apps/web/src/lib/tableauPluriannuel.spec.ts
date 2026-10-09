import { describe, expect, it } from "vitest";
import type { SerieExercice } from "../api/types";
import { LIGNES, ecartLigne, lignesRetenues } from "./tableauPluriannuel";

const ligne = (id: string) => LIGNES.find((l) => l.id === id)!;

const exercice: SerieExercice = {
  annee: 2025,
  label: "2025",
  reel: true,
  complet: true,
  valeurs: {
    "agregat.chiffreAffaires": 948_000,
    "agregat.achatsConsommes": 455_000,
    "agregat.chargesExternes": 138_000,
    "derive.resultatNet": 15_150,
    "agregat.dotationsAmortissements": 41_000,
    "agregat.resultatCessions": null,
  },
};

describe("tableau pluriannuel", () => {
  it("calcule la valeur ajoutée et la capacité d'autofinancement", () => {
    expect(ligne("va").calcul(exercice)).toBe(355_000);
    // Résultat net + dotations, sans résultat de cession à retirer.
    expect(ligne("caf").calcul(exercice)).toBe(56_150);
  });

  it("garde l'ordre du tableau et ignore les lignes inconnues", () => {
    expect(lignesRetenues(["rn", "ca", "inventee"]).map((l) => l.id)).toEqual(["ca", "rn"]);
    expect(lignesRetenues([]).length).toBe(LIGNES.filter((l) => l.parDefaut).length);
  });

  it("écrit l'écart dans l'unité de la ligne, et dit s'il est favorable", () => {
    expect(ecartLigne(ligne("ca"), 905_000, 948_000)).toEqual({ texte: "+43 k€ · +4,8 %", lecture: "favorable" });
    expect(ecartLigne(ligne("achats"), 400_000, 455_000)?.lecture).toBe("defavorable");
    expect(ecartLigne(ligne("margeEbitda"), 0.012, 0.081)).toEqual({ texte: "+6,9 pts", lecture: "favorable" });
    expect(ecartLigne(ligne("dso"), 65, 55)).toEqual({ texte: "−10 j", lecture: "favorable" });
    // Pas de pourcentage depuis une perte.
    expect(ecartLigne(ligne("rn"), -12_600, 15_150)?.texte).toBe("+28 k€");
    expect(ecartLigne(ligne("stocks"), 100_000, 100_000)).toEqual({ texte: "=", lecture: "neutre" });
  });
});
