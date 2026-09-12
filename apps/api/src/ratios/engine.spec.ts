import {
  RATIO_IDS,
  bilanEstEquilibre,
  computeAggregates,
  computeDerived,
  computeRatios,
} from "./engine";
import { LinePoste } from "@prisma/client";

describe("moteur de calcul des ratios", () => {
  // Cas simple et vérifiable à la main : une entreprise qui vend 1000,
  // achète 400, paie 200 de charges externes et 150 de personnel, avec un
  // bilan volontairement rond pour pouvoir recalculer chaque ratio de tête.
  const lineItems = [
    { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 1000 },
    { poste: LinePoste.ACHATS_CONSOMMES, amount: 400 },
    { poste: LinePoste.CHARGES_EXTERNES, amount: 200 },
    { poste: LinePoste.CHARGES_PERSONNEL, amount: 150 },
    { poste: LinePoste.DOTATIONS_AMORTISSEMENTS, amount: 50 },
    { poste: LinePoste.CHARGES_FINANCIERES, amount: 20 },
    { poste: LinePoste.IMPOT_SOCIETES, amount: 30 },
    { poste: LinePoste.STOCKS, amount: 100 },
    { poste: LinePoste.CREANCES_CLIENTS, amount: 200 },
    { poste: LinePoste.DISPONIBILITES, amount: 150 },
    { poste: LinePoste.DETTES_FOURNISSEURS, amount: 120 },
    { poste: LinePoste.CAPITAUX_PROPRES, amount: 500 },
    { poste: LinePoste.DETTES_FINANCIERES, amount: 200 },
    { poste: LinePoste.IMMOBILISATIONS, amount: 300 },
  ];

  const aggregates = computeAggregates(lineItems);
  const derived = computeDerived(aggregates);

  it("calcule l'EBITDA et l'EBIT correctement", () => {
    // EBITDA = 1000 - 400 - 200 - 150 = 250
    expect(derived.ebitda).toBe(250);
    // EBIT = 250 - 50 = 200
    expect(derived.ebit).toBe(200);
  });

  it("calcule le résultat net correctement", () => {
    // Résultat financier = 0 - 20 = -20 ; Résultat net = 200 - 20 + 0 - 30 = 150
    expect(derived.resultatFinancier).toBe(-20);
    expect(derived.resultatNet).toBe(150);
  });

  it("calcule le FR, le BFR et la trésorerie nette correctement", () => {
    // Ressources stables = 500 + 200 = 700 ; Emplois stables = 300 ; FR = 400
    expect(derived.fondsDeRoulement).toBe(400);
    // BFR = (100 + 200) - 120 = 180
    expect(derived.bfr).toBe(180);
    // Trésorerie nette = 400 - 180 = 220 (cohérent avec les 150 de disponibilités
    // + les autres postes court terme non cash pris en compte dans le FR/BFR)
    expect(derived.tresorerieNette).toBe(220);
  });

  it("calcule les ratios de rentabilité et de liquidité avec le bon statut", () => {
    const ratios = computeRatios(aggregates, derived);
    const margeEbitda = ratios.find((r) => r.id === "marge_ebitda")!;
    expect(margeEbitda.value).toBeCloseTo(0.25);
    expect(margeEbitda.status).toBe("bon");

    const liquiditeGenerale = ratios.find((r) => r.id === "liquidite_generale")!;
    // Actif circulant = 100+200+150=450 ; Passif circulant = 120 ; ratio = 3.75
    expect(liquiditeGenerale.value).toBeCloseTo(3.75);
    expect(liquiditeGenerale.status).toBe("bon");
  });

  it("retourne null (et un statut neutre) plutôt que de diviser par zéro", () => {
    const emptyAggregates = computeAggregates([]);
    const emptyDerived = computeDerived(emptyAggregates);
    const ratios = computeRatios(emptyAggregates, emptyDerived);
    const margeBrute = ratios.find((r) => r.id === "marge_brute")!;
    expect(margeBrute.value).toBeNull();
    expect(margeBrute.status).toBe("neutre");
  });

  it("détecte un bilan déséquilibré", () => {
    // Actif = 300 + 100 + 200 + 150 = 750 ; passif = 500 + 200 + 120 = 820.
    expect(derived.totalActif).toBe(750);
    expect(derived.totalPassif).toBe(820);
    expect(derived.ecartBilan).toBe(-70);
    expect(bilanEstEquilibre(derived)).toBe(false);
  });

  it("tolère un écart d'arrondi mais pas un poste mal classé", () => {
    const equilibre = computeDerived(
      computeAggregates([
        { poste: LinePoste.IMMOBILISATIONS, amount: 300 },
        { poste: LinePoste.DISPONIBILITES, amount: 200.4 },
        { poste: LinePoste.CAPITAUX_PROPRES, amount: 500 },
      ])
    );
    expect(bilanEstEquilibre(equilibre)).toBe(true);

    const desequilibre = computeDerived(
      computeAggregates([
        { poste: LinePoste.IMMOBILISATIONS, amount: 300 },
        { poste: LinePoste.CAPITAUX_PROPRES, amount: 500 },
      ])
    );
    expect(bilanEstEquilibre(desequilibre)).toBe(false);
  });

  it("calcule la croissance du CA par rapport à la période précédente", () => {
    const previousAggregates = computeAggregates([{ poste: LinePoste.CHIFFRE_AFFAIRES, amount: 800 }]);
    const ratios = computeRatios(aggregates, derived, { aggregates: previousAggregates });
    const croissance = ratios.find((r) => r.id === "croissance_ca")!;
    expect(croissance.value).toBeCloseTo(0.25);
    expect(croissance.status).toBe("bon");
  });
});

describe("catalogue des identifiants de ratios", () => {
  // RATIO_IDS sert à valider les saisies qui désignent un ratio (règles
  // d'alerte, indicateur d'un plan d'action). S'il divergeait du moteur, une
  // règle pourrait viser un ratio inexistant et ne jamais se déclencher, ou
  // un ratio réel serait refusé à la saisie.
  it("correspond exactement, et dans l'ordre, à ce que produit le moteur", () => {
    const aggregates = computeAggregates([{ poste: LinePoste.CHIFFRE_AFFAIRES, amount: 1000 }]);
    const produits = computeRatios(aggregates, computeDerived(aggregates)).map((r) => r.id);
    expect(produits).toEqual([...RATIO_IDS]);
  });
});

describe("ratios de rotation sur une période plus courte qu'un exercice", () => {
  // 100 de créances pour 1 000 de chiffre d'affaires : un dixième du CA de la
  // période reste à encaisser. Sur un exercice, cela fait 36,5 jours ; sur un
  // trimestre, 9 jours — pas 36,5. Multiplier systématiquement par 365 gonflait
  // le délai d'un facteur quatre sur un trimestre et douze sur un mois.
  const aggregates = computeAggregates([
    { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 1000 },
    { poste: LinePoste.ACHATS_CONSOMMES, amount: 500 },
    { poste: LinePoste.CREANCES_CLIENTS, amount: 100 },
    { poste: LinePoste.DETTES_FOURNISSEURS, amount: 50 },
    { poste: LinePoste.STOCKS, amount: 75 },
  ]);
  const derived = computeDerived(aggregates);

  const jours = (id: string, joursPeriode?: number) =>
    computeRatios(aggregates, derived, null, joursPeriode).find((r) => r.id === id)?.value ?? null;

  it("rapporte le délai client à la durée réelle de la période", () => {
    expect(jours("dso", 365)).toBeCloseTo(36.5, 6);
    expect(jours("dso", 90)).toBeCloseTo(9, 6);
    expect(jours("dso", 31)).toBeCloseTo(3.1, 6);
  });

  it("applique la même durée au délai fournisseurs et à la rotation des stocks", () => {
    expect(jours("dpo", 90)).toBeCloseTo(9, 6);
    expect(jours("dio", 90)).toBeCloseTo(13.5, 6);
  });

  it("compose le cycle de conversion sur les trois délais corrigés", () => {
    // 9 + 13,5 − 9 = 13,5
    expect(jours("cycle_conversion_cash", 90)).toBeCloseTo(13.5, 6);
  });

  it("suppose un exercice complet quand la durée n'est pas fournie", () => {
    expect(jours("dso")).toBeCloseTo(36.5, 6);
  });

  it("retombe sur l'exercice plutôt que de diviser par zéro", () => {
    expect(jours("dso", 0)).toBeCloseTo(36.5, 6);
  });

  it("affiche la durée retenue dans la formule, pour que le chiffre soit relisible", () => {
    const dso = computeRatios(aggregates, derived, null, 90).find((r) => r.id === "dso");
    expect(dso?.formula).toContain("90 jours");
  });

  it("laisse les ratios sans dimension temporelle inchangés", () => {
    const surAnnee = computeRatios(aggregates, derived, null, 365);
    const surTrimestre = computeRatios(aggregates, derived, null, 90);
    for (const id of ["marge_brute", "liquidite_generale", "gearing", "autonomie_financiere"]) {
      expect(surTrimestre.find((r) => r.id === id)?.value).toBe(
        surAnnee.find((r) => r.id === id)?.value
      );
    }
  });
});
