import { Aggregates } from "../ratios/engine";
import {
  HYPOTHESES_PAR_DEFAUT,
  Hypotheses,
  assainirHypotheses,
  projeter,
} from "./previsionnel";

function depart(valeurs: Partial<Aggregates> = {}): Aggregates {
  return {
    chiffreAffaires: 1_000_000,
    achatsConsommes: 400_000,
    chargesExternes: 150_000,
    chargesPersonnel: 300_000,
    impotsTaxes: 10_000,
    dotationsAmortissements: 40_000,
    autresProduitsChargesExploitation: 0,
    chargesFinancieres: 8_000,
    produitsFinanciers: 0,
    resultatExceptionnel: 0,
    resultatCessions: 0,
    impotSocietes: 23_000,
    stocks: 33_000,
    creancesClients: 123_000,
    autresCreances: 20_000,
    disponibilites: 90_000,
    capitauxPropres: 400_000,
    dettesFinancieres: 200_000,
    dettesFournisseurs: 49_000,
    autresDettes: 30_000,
    immobilisations: 413_000,
    ...valeurs,
  };
}

const hypotheses = (modifications: Partial<Hypotheses> = {}): Hypotheses => ({
  ...HYPOTHESES_PAR_DEFAUT,
  ...modifications,
});

describe("projection d'exercices", () => {
  it("équilibre le bilan de chaque exercice projeté", () => {
    /*
     * L'invariant du modèle. La trésorerie étant la variable d'ajustement, un
     * écart de bilan non nul signifierait une erreur dans le calcul des
     * autres postes — et tous les ratios qui en découlent seraient faux sans
     * que rien ne le signale.
     */
    const exercices = projeter(
      { annee: 2025, aggregates: depart() },
      hypotheses({ horizon: 5, investissements: 120_000, nouveauxEmprunts: 80_000 })
    );
    expect(exercices).toHaveLength(5);
    for (const exercice of exercices) {
      expect(Math.abs(exercice.derived.ecartBilan)).toBeLessThan(0.01);
    }
  });

  it("compose la croissance d'une année sur l'autre", () => {
    const exercices = projeter(
      { annee: 2025, aggregates: depart() },
      hypotheses({ horizon: 3, croissanceCa: 0.1 })
    );
    expect(exercices[0].aggregates.chiffreAffaires).toBeCloseTo(1_100_000, 0);
    expect(exercices[1].aggregates.chiffreAffaires).toBeCloseTo(1_210_000, 0);
    expect(exercices[2].aggregates.chiffreAffaires).toBeCloseTo(1_331_000, 0);
  });

  it("respecte les délais saisis : le ratio projeté retrouve l'hypothèse", () => {
    // Si l'inverse du calcul n'est pas exact, l'utilisateur saisit 30 jours
    // et lit 32 sur le graphique — et cesse de croire au reste.
    const exercices = projeter(
      { annee: 2025, aggregates: depart() },
      hypotheses({ horizon: 2, dso: 30, dpo: 60, dio: 15 })
    );
    for (const exercice of exercices) {
      expect(exercice.ratios.find((r) => r.id === "dso")?.value).toBeCloseTo(30, 1);
      expect(exercice.ratios.find((r) => r.id === "dpo")?.value).toBeCloseTo(60, 1);
      expect(exercice.ratios.find((r) => r.id === "dio")?.value).toBeCloseTo(15, 1);
    }
  });

  it("présente un manque de trésorerie comme un besoin de financement", () => {
    /*
     * Un investissement lourd sans financement : la trésorerie projetée passe
     * sous zéro. Ce n'est pas une anomalie de calcul, c'est le résultat qu'on
     * vient chercher — et il doit être nommé.
     */
    const exercices = projeter(
      { annee: 2025, aggregates: depart() },
      hypotheses({ horizon: 2, investissements: 900_000, dividendes: 100_000 })
    );
    expect(exercices[1].aggregates.disponibilites).toBeLessThan(0);
    expect(exercices[1].besoinFinancement).toBeCloseTo(-exercices[1].aggregates.disponibilites, 2);
    // Et le bilan tient quand même : le besoin est une information, pas une
    // incohérence.
    expect(Math.abs(exercices[1].derived.ecartBilan)).toBeLessThan(0.01);
  });

  it("ne facture pas d'impôt sur une perte", () => {
    const exercices = projeter(
      { annee: 2025, aggregates: depart() },
      hypotheses({ horizon: 1, partAchats: 1.5 })
    );
    expect(exercices[0].derived.resultatNet).toBeLessThan(0);
    expect(exercices[0].aggregates.impotSocietes).toBe(0);
  });

  it("reporte le résultat aux capitaux propres, dividendes déduits", () => {
    const exercices = projeter(
      { annee: 2025, aggregates: depart() },
      hypotheses({ horizon: 1, dividendes: 20_000 })
    );
    const attendu = 400_000 + exercices[0].derived.resultatNet - 20_000;
    expect(exercices[0].aggregates.capitauxPropres).toBeCloseTo(attendu, 1);
  });

  it("fait vivre la dette au rythme des emprunts et des remboursements", () => {
    const exercices = projeter(
      { annee: 2025, aggregates: depart() },
      hypotheses({ horizon: 3, nouveauxEmprunts: 50_000, remboursements: 30_000 })
    );
    expect(exercices[0].aggregates.dettesFinancieres).toBeCloseTo(220_000, 1);
    expect(exercices[1].aggregates.dettesFinancieres).toBeCloseTo(240_000, 1);
    // Les intérêts portent sur l'encours d'ouverture, pas de clôture.
    expect(exercices[1].aggregates.chargesFinancieres).toBeCloseTo(220_000 * 0.04, 1);
  });

  it("ne laisse pas la dette ni les immobilisations devenir négatives", () => {
    const exercices = projeter(
      { annee: 2025, aggregates: depart() },
      hypotheses({ horizon: 3, remboursements: 500_000, investissements: 0, dureeAmortissement: 1 })
    );
    for (const exercice of exercices) {
      expect(exercice.aggregates.dettesFinancieres).toBeGreaterThanOrEqual(0);
      expect(exercice.aggregates.immobilisations).toBeGreaterThanOrEqual(0);
    }
  });

  it("mesure la croissance par rapport à l'exercice qui précède réellement", () => {
    const exercices = projeter(
      { annee: 2025, aggregates: depart() },
      hypotheses({ horizon: 2, croissanceCa: 0.08 })
    );
    expect(exercices[0].ratios.find((r) => r.id === "croissance_ca")?.value).toBeCloseTo(0.08, 4);
    expect(exercices[1].ratios.find((r) => r.id === "croissance_ca")?.value).toBeCloseTo(0.08, 4);
  });

  it("numérote les exercices à partir du dernier réalisé", () => {
    const exercices = projeter({ annee: 2025, aggregates: depart() }, hypotheses({ horizon: 3 }));
    expect(exercices.map((e) => e.annee)).toEqual([2026, 2027, 2028]);
  });

  it("ne projette rien sur un horizon nul", () => {
    expect(projeter({ annee: 2025, aggregates: depart() }, hypotheses({ horizon: 0 }))).toEqual([]);
  });

  it("ne produit jamais de NaN, même sur un point de départ vide", () => {
    // Une entité sans aucune donnée importée : le prévisionnel doit rendre
    // des zéros, pas des NaN qui s'afficheraient en « — » partout sans dire
    // pourquoi.
    const vide = depart(
      Object.fromEntries(
        Object.keys(depart()).map((cle) => [cle, 0])
      ) as unknown as Partial<Aggregates>
    );
    const exercices = projeter({ annee: 2025, aggregates: vide }, hypotheses({ horizon: 2 }));
    for (const exercice of exercices) {
      for (const valeur of Object.values(exercice.aggregates)) {
        expect(Number.isFinite(valeur)).toBe(true);
      }
    }
  });
});

describe("assainissement des hypothèses", () => {
  it("borne une saisie absurde au lieu de la propager", () => {
    const propres = assainirHypotheses({ dso: 99_999, partAchats: 12, horizon: 99 });
    expect(propres.dso).toBe(365);
    expect(propres.partAchats).toBe(2);
    expect(propres.horizon).toBe(10);
  });

  it("retombe sur la valeur par défaut pour un champ absent ou non numérique", () => {
    const propres = assainirHypotheses({ croissanceCa: Number.NaN });
    expect(propres.croissanceCa).toBe(HYPOTHESES_PAR_DEFAUT.croissanceCa);
    expect(propres.tauxIS).toBe(HYPOTHESES_PAR_DEFAUT.tauxIS);
  });

  it("accepte une décroissance, qui est un scénario légitime", () => {
    expect(assainirHypotheses({ croissanceCa: -0.2 }).croissanceCa).toBe(-0.2);
  });

  it("refuse un investissement ou un dividende négatif", () => {
    // Un investissement négatif est une cession : elle ne se saisit pas ici,
    // et l'accepter inverserait silencieusement le sens du poste.
    expect(assainirHypotheses({ investissements: -50_000 }).investissements).toBe(0);
    expect(assainirHypotheses({ dividendes: -1 }).dividendes).toBe(0);
  });
});
