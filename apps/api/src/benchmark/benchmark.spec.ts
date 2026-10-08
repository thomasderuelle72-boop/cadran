import { computeDerived, lireAgregats } from "../ratios/engine";
import { RATIOS_SECTORIELS, type Contexte } from "./ratios-sectoriels";
import { lire, quartDe, quartilesValides, situer } from "./position";
import { codesSecteur } from "./secteurs";
import { validerImport } from "./import-reference";
import { comparer, type ReferenceSecteur } from "./comparaison";

/*
 * Toutes les valeurs de référence de ce fichier sont inventées. Aucune donnée
 * de la Banque de France n'est versionnée tant que sa réutilisation n'est pas
 * autorisée par écrit — y compris dans les tests.
 */

function contexte(valeurs: Partial<Parameters<typeof lireAgregats>[0] & object> = {}, extra: Partial<Contexte> = {}): Contexte {
  const aggregates = lireAgregats({
    chiffreAffaires: 1_200_000,
    achatsConsommes: 400_000,
    chargesExternes: 200_000,
    chargesPersonnel: 360_000,
    impotsTaxes: 20_000,
    dotationsAmortissements: 50_000,
    chargesFinancieres: 12_000,
    creancesClients: 240_000,
    dettesFournisseurs: 108_000,
    stocks: 60_000,
    autresCreances: 20_000,
    autresDettes: 70_000,
    disponibilites: 90_000,
    capitauxPropres: 400_000,
    dettesFinancieres: 200_000,
    immobilisations: 438_000,
    ...valeurs,
  });
  return { aggregates, derived: computeDerived(aggregates), precedent: null, effectif: 10, ...extra };
}

function ratio(id: string, c: Contexte): number | null {
  const definition = RATIOS_SECTORIELS.find((r) => r.id === id);
  if (!definition) throw new Error(`ratio ${id} absent`);
  return definition.calculer(c);
}

describe("ratios calculés à la manière de la Banque de France", () => {
  it("calcule le délai clients sur le chiffre d'affaires TTC et 360 jours", () => {
    // 240 000 / (1 200 000 × 1,2) × 360 = 60 jours. Notre DSO habituel, sur le
    // HT et 365 jours, donnerait 73 : c'est précisément l'écart qui rendait la
    // comparaison directe fausse.
    expect(ratio("delai_clients", contexte())).toBeCloseTo(60, 6);
  });

  it("calcule le taux de marge sur la valeur ajoutée, pas sur le chiffre d'affaires", () => {
    // VA = 1 200 000 − 400 000 − 200 000 = 600 000 ; EBE = 600 000 − 360 000 − 20 000 = 220 000.
    expect(ratio("taux_marge", contexte())).toBeCloseTo((220_000 / 600_000) * 100, 6);
    expect(ratio("taux_ebg", contexte())).toBeCloseTo((220_000 / 1_200_000) * 100, 6);
  });

  it("ne calcule pas un ratio dont le dénominateur est nul ou négatif, comme les fascicules", () => {
    expect(ratio("endettement_brut", contexte({ capitauxPropres: -10_000 }))).toBeNull();
    expect(ratio("poids_interets", contexte({ chargesPersonnel: 900_000 }))).toBeNull();
  });

  it("exige l'exercice précédent pour un taux de variation", () => {
    expect(ratio("variation_ca", contexte())).toBeNull();
    const precedent = { aggregates: lireAgregats({ chiffreAffaires: 1_000_000 }) };
    expect(ratio("variation_ca", contexte({}, { precedent }))).toBeCloseTo(20, 6);
  });

  it("exige un effectif pour les ratios par salarié", () => {
    expect(ratio("cout_mo", contexte({}, { effectif: null }))).toBeNull();
    expect(ratio("cout_mo", contexte({}, { effectif: 10 }))).toBeCloseTo(36, 6);
  });

  it("dit pour chaque ratio approché ce qui le sépare de la définition publiée", () => {
    for (const r of RATIOS_SECTORIELS) {
      if (r.comparabilite === "approchee") expect(r.ecart?.length).toBeGreaterThan(20);
      else expect(r.ecart).toBeUndefined();
    }
  });
});

describe("position dans les quartiles", () => {
  const q = { q1: 10, q2: 20, q3: 30 };

  it("range une valeur dans son quart, bornes comprises dans le quart supérieur", () => {
    expect(quartDe(5, q)).toBe(1);
    expect(quartDe(10, q)).toBe(2);
    expect(quartDe(20, q)).toBe(3);
    expect(quartDe(30, q)).toBe(4);
  });

  it("lit les extrêmes selon le sens du ratio", () => {
    expect(lire(4, "haut_favorable")).toBe("favorable");
    expect(lire(1, "haut_favorable")).toBe("defavorable");
    // Un délai clients parmi les plus longs n'est pas « parmi les meilleurs ».
    expect(lire(4, "bas_favorable")).toBe("defavorable");
    expect(lire(1, "bas_favorable")).toBe("favorable");
  });

  it("ne juge pas une position ordinaire", () => {
    expect(lire(2, "haut_favorable")).toBe("intermediaire");
    expect(lire(3, "bas_favorable")).toBe("intermediaire");
  });

  it("ne juge jamais un ratio de structure", () => {
    expect(lire(4, "neutre")).toBe("neutre");
    expect(lire(1, "neutre")).toBe("neutre");
  });

  it("décrit la position sans la juger", () => {
    expect(situer(35, q, "bas_favorable").phrase).toBe("Parmi les 25 % les plus élevés du secteur");
  });

  it("refuse des quartiles dans le désordre", () => {
    expect(quartilesValides({ q1: 30, q2: 20, q3: 10 })).toBe(false);
    expect(quartilesValides({ q1: 1, q2: Number.NaN, q3: 3 })).toBe(false);
    expect(quartilesValides({ q1: 1, q2: 1, q3: 1 })).toBe(true);
  });
});

describe("secteur d'un code NAF", () => {
  it("lit la division et la section sous toutes les écritures courantes", () => {
    expect(codesSecteur("2599B")).toEqual({ division: "25", section: "C" });
    expect(codesSecteur("25.99B")).toEqual({ division: "25", section: "C" });
    expect(codesSecteur("56.10A")).toEqual({ division: "56", section: "I" });
    expect(codesSecteur("4711D")).toEqual({ division: "47", section: "G" });
  });

  it("place les divisions charnières dans la bonne section", () => {
    expect(codesSecteur("0111Z")?.section).toBe("A");
    expect(codesSecteur("3511Z")?.section).toBe("D");
    expect(codesSecteur("3600Z")?.section).toBe("E");
    expect(codesSecteur("8411Z")?.section).toBe("O");
    expect(codesSecteur("9900Z")?.section).toBe("U");
  });

  it("refuse ce qui n'est pas un code NAF plutôt que de deviner", () => {
    expect(codesSecteur(null)).toBeNull();
    expect(codesSecteur("ABC")).toBeNull();
    expect(codesSecteur("00")).toBeNull();
  });
});

describe("import d'un référentiel", () => {
  const valide = {
    source: "BANQUE_DE_FRANCE",
    millesime: 2024,
    miseAJour: "2025-11-27",
    secteurs: [
      {
        code: "25",
        libelle: "Secteur d'essai",
        ratios: { taux_marge: { q1: 10, q2: 20, q3: 30, n: 500 }, taille_ca: { q1: 2000, q2: 3500, q3: 7000 } },
      },
    ],
  };

  it("accepte un fichier conforme", () => {
    const verdict = validerImport(valide);
    expect(verdict.valide).toBe(true);
    if (verdict.valide) {
      expect(verdict.secteurs).toBe(1);
      expect(verdict.lignes).toHaveLength(2);
    }
  });

  it("exige la date de mise à jour, que la source impose d'afficher", () => {
    const verdict = validerImport({ ...valide, miseAJour: undefined });
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) expect(verdict.motif).toContain("mise à jour");
  });

  it("refuse des quartiles inversés, qui classeraient tout le monde à l'envers", () => {
    const verdict = validerImport({
      ...valide,
      secteurs: [{ ...valide.secteurs[0], ratios: { taux_marge: { q1: 30, q2: 20, q3: 10 } } }],
    });
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) expect(verdict.motif).toContain("Q1 ≤ Q2 ≤ Q3");
  });

  it("refuse un ratio inconnu au lieu de l'ignorer", () => {
    const verdict = validerImport({
      ...valide,
      secteurs: [{ ...valide.secteurs[0], ratios: { invente: { q1: 1, q2: 2, q3: 3 } } }],
    });
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) expect(verdict.motif).toContain("invente");
  });

  it("refuse un secteur en double et un code mal formé", () => {
    expect(validerImport({ ...valide, secteurs: [valide.secteurs[0], valide.secteurs[0]] }).valide).toBe(false);
    expect(validerImport({ ...valide, secteurs: [{ ...valide.secteurs[0], code: "2599B" }] }).valide).toBe(false);
  });

  it("refuse une source inconnue", () => {
    expect(validerImport({ ...valide, source: "AUTRE" }).valide).toBe(false);
  });
});

describe("comparaison d'un dossier à son secteur", () => {
  function reference(niveau: "division" | "section" = "division"): ReferenceSecteur {
    return {
      source: "BANQUE_DE_FRANCE",
      millesime: 2024,
      miseAJour: new Date("2025-11-27T00:00:00Z"),
      codeSecteur: niveau === "division" ? "25" : "C",
      libelleSecteur: "Secteur d'essai",
      niveau,
      valeurs: new Map([
        ["delai_clients", { q1: 40, q2: 55, q3: 75, nombreEntreprises: 500 }],
        ["taille_ca", { q1: 2_000, q2: 3_500, q3: 7_000, nombreEntreprises: null }],
      ]),
    };
  }

  it("porte la mention exigée par la source : nom, date, provenance", () => {
    const { source } = comparer(reference(), contexte());
    expect(source.mention).toContain("Banque de France");
    expect(source.mention).toContain("27 novembre 2025");
    expect(source.mention).toContain("site institutionnel");
  });

  it("situe un ratio qui a une référence, et pas les autres", () => {
    const { ratios } = comparer(reference(), contexte());
    const delai = ratios.find((r) => r.id === "delai_clients");
    expect(delai?.position).toEqual({ quart: 3, lecture: "intermediaire", phrase: "Au-dessus de la médiane du secteur" });
    expect(ratios.find((r) => r.id === "taux_marge")?.position).toBeNull();
  });

  it("prévient quand le dossier est plus petit que l'échantillon", () => {
    // 1,2 M€ face à un premier quartile de 2 M€.
    const { avertissements } = comparer(reference(), contexte());
    expect(avertissements.some((a) => a.includes("trois quarts"))).toBe(true);
  });

  it("prévient quand la comparaison se fait à la section", () => {
    const { avertissements } = comparer(reference("section"), contexte());
    expect(avertissements.some((a) => a.includes("section C"))).toBe(true);
  });

  it("prévient quand l'effectif manque", () => {
    const { avertissements } = comparer(reference(), contexte({}, { effectif: null }));
    expect(avertissements.some((a) => a.includes("Effectif"))).toBe(true);
  });
});
