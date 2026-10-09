import { describe, expect, it } from "vitest";
import type { SerieExercice } from "../api/types";
import {
  base100,
  exerciceEnCours,
  exercicesComplets,
  lireEvolution,
  lireRentabilite,
  lireStructure,
  lireTresorerie,
  montantCourt,
  pourcentSigne,
  rythmeEnCours,
  tauxAnnuelMoyen,
  variation,
} from "./evolution";

function exercice(annee: number, valeurs: Record<string, number | null>, complet = true, jours = 365): SerieExercice {
  return { annee, label: String(annee), reel: true, complet, jours, valeurs };
}

/** Une entreprise saine : 1 M€ de CA, 12 % de marge d'EBITDA, peu de dette. */
function sain(annee: number, ca: number, autres: Record<string, number | null> = {}): SerieExercice {
  return exercice(annee, {
    "agregat.chiffreAffaires": ca,
    "agregat.achatsConsommes": ca * 0.4,
    "agregat.chargesExternes": ca * 0.18,
    "agregat.chargesPersonnel": ca * 0.28,
    "agregat.impotsTaxes": ca * 0.02,
    "ratio.marge_ebitda": 0.12,
    "derive.ebitda": ca * 0.12,
    "derive.resultatNet": ca * 0.05,
    "agregat.capitauxPropres": 300_000,
    "agregat.dettesFinancieres": 150_000,
    "ratio.autonomie_financiere": 0.45,
    "derive.tresorerieNette": 80_000,
    "derive.fondsDeRoulement": 200_000,
    "derive.bfr": 120_000,
    ...autres,
  });
}

describe("écriture des nombres", () => {
  it("abrège les montants à la française", () => {
    expect(montantCourt(948_000)).toBe("948 k€");
    expect(montantCourt(1_250_000)).toBe("1,3 M€");
    expect(montantCourt(-15_150)).toBe("−15 k€");
  });

  it("signe les pourcentages avec une virgule", () => {
    expect(pourcentSigne(0.048)).toBe("+4,8 %");
    expect(pourcentSigne(-0.117)).toBe("−11,7 %");
    expect(pourcentSigne(0.0001)).toBe("0,0 %");
  });
});

describe("calculs", () => {
  it("ne donne pas de pourcentage sur une base négative", () => {
    // Partir d'une perte de 12 600 € pour arriver à 15 150 € n'est pas « +220 % ».
    expect(variation(-12_600, 15_150)).toEqual({ montant: 27_750, taux: null });
    expect(variation(100, 110).taux).toBeCloseTo(0.1);
  });

  it("calcule un taux de croissance annuel moyen", () => {
    expect(tauxAnnuelMoyen(1_000, 1_331, 3)).toBeCloseTo(0.1);
    expect(tauxAnnuelMoyen(0, 1_331, 3)).toBeNull();
  });

  it("met en base 100 au premier exercice", () => {
    const ex = [sain(2023, 1_000_000), sain(2024, 1_100_000)];
    expect(base100(ex, (e) => e.valeurs["agregat.chiffreAffaires"])).toEqual([100, 110.00000000000001]);
  });
});

describe("exercices comparés", () => {
  const series = [sain(2023, 1_000_000), sain(2024, 1_100_000), exercice(2026, { "agregat.chiffreAffaires": 900_000 }, false, 273), sain(2025, 1_200_000)];

  it("ne compare que les exercices complets, dans l'ordre", () => {
    expect(exercicesComplets(series).map((e) => e.annee)).toEqual([2023, 2024, 2025]);
    expect(exercicesComplets(series, 2).map((e) => e.annee)).toEqual([2024, 2025]);
  });

  it("met l'exercice en cours à part, au rythme mensuel", () => {
    expect(exerciceEnCours(series)?.annee).toBe(2026);
    const rythme = rythmeEnCours(series)!;
    expect(rythme.mois).toBe(9);
    // 900 000 € en 273 jours contre 1,2 M€ en 365 : à peu près le même rythme.
    expect(rythme.ecart).toBeCloseTo(900_000 / 273 / (1_200_000 / 365) - 1, 5);
  });

  it("n'a rien à dire sur un seul exercice", () => {
    expect(lireEvolution([sain(2025, 1_000_000)])).toEqual([]);
  });
});

describe("les quatre lectures", () => {
  it("lit une croissance régulière comme saine, et le dit en taux annuel", () => {
    const [activite] = lireEvolution([sain(2022, 1_000_000), sain(2023, 1_100_000), sain(2024, 1_210_000), sain(2025, 1_331_000)]);
    expect(activite).toMatchObject({ theme: "activite", etat: "sain", resume: "en hausse" });
    expect(activite.phrases[0]).toContain("+33,1 %, soit +10,0 % par an");
    expect(activite.phrases[1]).toBe("Sur le dernier exercice : +10,0 %.");
  });

  it("voit l'effet ciseaux quand les charges vont plus vite que les ventes", () => {
    const avant = sain(2023, 1_000_000);
    const apres = sain(2025, 1_050_000, {
      "agregat.chargesExternes": 260_000,
      "ratio.marge_ebitda": 0.035,
    });
    const lecture = lireRentabilite([avant, apres])!;
    expect(lecture.etat).toBe("fragile");
    expect(lecture.phrases[0]).toContain("de 12,0 % à 3,5 %");
    expect(lecture.phrases[0]).toContain("−8,5 points");
    expect(lecture.phrases.join(" ")).toContain("effet ciseaux");
  });

  it("signale un dernier exercice en perte même quand la marge tient", () => {
    const lecture = lireRentabilite([sain(2024, 1_000_000), sain(2025, 1_000_000, { "derive.resultatNet": -12_000 })])!;
    expect(lecture).toMatchObject({ etat: "a_surveiller", resume: "dernier exercice en perte" });
    expect(lecture.phrases.at(-1)).toBe("Le dernier exercice se solde par une perte de 12 k€.");
  });

  it("rappelle l'obligation de reconstituer des capitaux propres négatifs", () => {
    const lecture = lireStructure([sain(2024, 1_000_000), sain(2025, 1_000_000, { "agregat.capitauxPropres": -40_000 })])!;
    expect(lecture.etat).toBe("fragile");
    expect(lecture.phrases.join(" ")).toContain("L223-42");
  });

  it("mesure la dette en années d'EBITDA", () => {
    const lecture = lireStructure([sain(2024, 1_000_000), sain(2025, 1_000_000, { "agregat.dettesFinancieres": 600_000 })])!;
    // 600 000 € pour 120 000 € d'EBITDA : 5 ans.
    expect(lecture).toMatchObject({ etat: "fragile", resume: "endettement lourd" });
    expect(lecture.phrases[1]).toContain("5,0 années d'EBITDA");
  });

  it("chiffre ce que le cycle d'exploitation immobilise de plus", () => {
    const lecture = lireTresorerie([
      sain(2024, 1_000_000, { "derive.bfr": 100_000 }),
      sain(2025, 1_000_000, { "derive.bfr": 160_000, "derive.tresorerieNette": 30_000 }),
    ])!;
    // De 37 à 58 jours : 60 000 € de plus, et une trésorerie qui baisse.
    expect(lecture.etat).toBe("a_surveiller");
    expect(lecture.phrases.at(-1)).toContain("de 37 à 58 jours");
    expect(lecture.phrases.at(-1)).toContain("immobilise 60 k€ de plus");
  });

  it("dit une trésorerie négative fragile", () => {
    const lecture = lireTresorerie([sain(2024, 1_000_000), sain(2025, 1_000_000, { "derive.tresorerieNette": -5_000 })])!;
    expect(lecture).toMatchObject({ etat: "fragile", resume: "négative" });
  });
});
