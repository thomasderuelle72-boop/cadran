import { describe, expect, it } from "vitest";
import type { Aggregates, Derived, Period, RatioValue } from "../api/types";
import { ecart, etapesCascade, etatIndicateurs, periodesComparables } from "./tableauDeBord";

function periode(id: string, debut: string, fin: string): Period {
  return { id, label: id, startDate: debut, endDate: fin, status: "CLOTUREE" };
}

const PERIODES = [
  periode("ex2024", "2024-01-01", "2024-12-31"),
  periode("ex2025", "2025-01-01", "2025-12-31"),
  periode("t1", "2026-01-01", "2026-03-31"),
  periode("t2", "2026-04-01", "2026-06-30"),
  periode("t3", "2026-07-01", "2026-09-30"),
];

describe("périodes comparables", () => {
  it("ne compare un trimestre qu'à des trimestres", () => {
    expect(periodesComparables(PERIODES, "t3").map((p) => p.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("ne compare un exercice qu'à des exercices, sans les périodes postérieures", () => {
    expect(periodesComparables(PERIODES, "ex2025").map((p) => p.id)).toEqual(["ex2024", "ex2025"]);
  });

  it("ne renvoie rien pour une période inconnue", () => {
    expect(periodesComparables(PERIODES, "absente")).toEqual([]);
  });
});

describe("écart", () => {
  it("donne un pourcentage sur une base positive", () => {
    expect(ecart(110, 100)).toEqual({ absolu: 10, pourcentage: 0.1 });
  });

  it("refuse le pourcentage sur une base nulle ou négative", () => {
    // D'une perte à un bénéfice, « +250 % » ne voudrait rien dire.
    expect(ecart(3000, -2000)).toEqual({ absolu: 5000, pourcentage: null });
    expect(ecart(10, 0)?.pourcentage).toBeNull();
  });

  it("n'invente pas d'écart sans période précédente", () => {
    expect(ecart(100, null)).toBeNull();
    expect(ecart(100, undefined)).toBeNull();
  });
});

function ratio(id: string, status: RatioValue["status"], value: number | null = 1): RatioValue {
  return { id, label: id, category: "RENTABILITE", formula: "", unit: "ratio", value, status, interpretation: "" };
}

describe("état des indicateurs", () => {
  it("compte les seuls indicateurs jugés", () => {
    const etat = etatIndicateurs([ratio("a", "bon"), ratio("b", "neutre"), ratio("c", "bon", null), ratio("d", "attention")]);
    expect(etat).toMatchObject({ bon: 1, attention: 1, critique: 0, total: 2 });
  });

  it("met les critiques avant ceux à surveiller", () => {
    const etat = etatIndicateurs([ratio("a", "attention"), ratio("b", "critique"), ratio("c", "bon")]);
    expect(etat.aSurveiller.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("rend un verdict qui s'énonce en une phrase", () => {
    const bons = Array.from({ length: 16 }, (_, i) => ratio(`b${i}`, "bon"));
    expect(etatIndicateurs(bons).verdict).toBe("sain");
    expect(etatIndicateurs([...bons, ratio("c", "critique")]).verdict).toBe("a_surveiller");
    expect(etatIndicateurs([...bons, ratio("c1", "critique"), ratio("c2", "critique")]).verdict).toBe("fragile");
    const attentions = Array.from({ length: 6 }, (_, i) => ratio(`a${i}`, "attention"));
    expect(etatIndicateurs([...bons, ...attentions]).verdict).toBe("a_surveiller");
  });
});

describe("cascade du chiffre d'affaires au résultat net", () => {
  const a = {
    chiffreAffaires: 512_000,
    achatsConsommes: 214_000,
    chargesExternes: 69_000,
    chargesPersonnel: 126_000,
    impotsTaxes: 10_100,
    impotSocietes: 11_200,
  } as Aggregates;
  const d = { ebitda: 92_900, ebit: 77_700, resultatNet: 61_600 } as Derived;

  it("retombe exactement sur les totaux du serveur", () => {
    const etapes = etapesCascade(a, d);
    const totaux = etapes.filter((e) => e.nature === "total").map((e) => [e.libelle, e.montant]);
    expect(totaux).toEqual([
      ["Chiffre d'affaires", 512_000],
      ["Valeur ajoutée", 229_000],
      ["EBITDA", 92_900],
      ["Résultat net", 61_600],
    ]);
  });

  it("enchaîne chaque variation depuis le total précédent", () => {
    // La somme des variations relie le chiffre d'affaires au résultat net :
    // aucune barre ne flotte sans attache.
    const etapes = etapesCascade(a, d);
    const variations = etapes.filter((e) => e.nature === "variation").reduce((s, e) => s + e.montant, 0);
    expect(a.chiffreAffaires + variations).toBeCloseTo(61_600, 6);
    const impot = etapes.find((e) => e.libelle === "Impôt sur les sociétés");
    expect(impot?.montant).toBeCloseTo(-11_200, 6);
  });

  it("dessine une perte sous zéro", () => {
    const perte = etapesCascade(a, { ebitda: 5_000, ebit: -10_000, resultatNet: -14_000 } as Derived);
    const net = perte.at(-1)!;
    expect(net).toMatchObject({ montant: -14_000, bas: -14_000, haut: 0 });
  });
});
