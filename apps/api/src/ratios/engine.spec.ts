import { computeAggregates, computeDerived, computeRatios } from "./engine";
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

  it("calcule la croissance du CA par rapport à la période précédente", () => {
    const previousAggregates = computeAggregates([{ poste: LinePoste.CHIFFRE_AFFAIRES, amount: 800 }]);
    const ratios = computeRatios(aggregates, derived, { aggregates: previousAggregates });
    const croissance = ratios.find((r) => r.id === "croissance_ca")!;
    expect(croissance.value).toBeCloseTo(0.25);
    expect(croissance.status).toBe("bon");
  });
});
