import { LinePoste } from "@prisma/client";
import { bilanEstEquilibre, computeAggregates, computeDerived } from "../ratios/engine";
import { computeSig } from "./sig";
import { bfrComplet, computeTableauFlux } from "./tableau-flux";

/**
 * Bilan d'ouverture volontairement rond et équilibré : actif 1 000
 * (immobilisations 400, stocks 100, clients 200, autres créances 50,
 * disponibilités 250) = passif 1 000 (capitaux propres 600, dettes
 * financières 250, fournisseurs 100, autres dettes 50).
 */
const OUVERTURE = computeAggregates([
  { poste: LinePoste.IMMOBILISATIONS, amount: 400 },
  { poste: LinePoste.STOCKS, amount: 100 },
  { poste: LinePoste.CREANCES_CLIENTS, amount: 200 },
  { poste: LinePoste.AUTRES_CREANCES, amount: 50 },
  { poste: LinePoste.DISPONIBILITES, amount: 250 },
  { poste: LinePoste.CAPITAUX_PROPRES, amount: 600 },
  { poste: LinePoste.DETTES_FINANCIERES, amount: 250 },
  { poste: LinePoste.DETTES_FOURNISSEURS, amount: 100 },
  { poste: LinePoste.AUTRES_DETTES, amount: 50 },
]);

describe("soldes intermédiaires de gestion", () => {
  const aggregates = computeAggregates([
    { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 1000 },
    { poste: LinePoste.ACHATS_CONSOMMES, amount: 400 },
    { poste: LinePoste.CHARGES_EXTERNES, amount: 150 },
    { poste: LinePoste.CHARGES_PERSONNEL, amount: 250 },
    { poste: LinePoste.IMPOTS_TAXES, amount: 30 },
    { poste: LinePoste.DOTATIONS_AMORTISSEMENTS, amount: 60 },
    { poste: LinePoste.CHARGES_FINANCIERES, amount: 20 },
    { poste: LinePoste.PRODUITS_FINANCIERS, amount: 5 },
    { poste: LinePoste.RESULTAT_EXCEPTIONNEL, amount: -10 },
    { poste: LinePoste.IMPOT_SOCIETES, amount: 25 },
  ]);

  const sig = computeSig(aggregates);
  const derived = computeDerived(aggregates);

  it("calcule la valeur ajoutée", () => {
    // 1000 − (400 + 150) = 450
    expect(sig.valeurAjoutee).toBe(450);
  });

  it("calcule l'excédent brut d'exploitation", () => {
    // 450 − 250 − 30 = 170
    expect(sig.excedentBrutExploitation).toBe(170);
  });

  it("calcule le résultat d'exploitation et le résultat courant", () => {
    expect(sig.resultatExploitation).toBe(110); // 170 − 60
    expect(sig.resultatCourantAvantImpots).toBe(95); // 110 + (5 − 20)
  });

  it("calcule le résultat net", () => {
    // 95 − 10 − 25 = 60
    expect(sig.resultatNet).toBe(60);
  });

  it("se raccorde exactement au moteur de ratios", () => {
    // Le même chiffre ne doit jamais différer d'un écran à l'autre.
    expect(sig.excedentBrutExploitation).toBe(derived.ebitda);
    expect(sig.resultatExploitation).toBe(derived.ebit);
    expect(sig.resultatNet).toBe(derived.resultatNet);
  });

  describe("capacité d'autofinancement", () => {
    it("vaut le résultat net augmenté des dotations", () => {
      expect(sig.capaciteAutofinancement).toBe(120); // 60 + 60
    });

    it("coïncide avec la méthode soustractive", () => {
      // EBE + résultat financier + résultat exceptionnel − IS :
      // deux chemins, un seul résultat.
      const soustractive =
        sig.excedentBrutExploitation +
        derived.resultatFinancier +
        aggregates.resultatExceptionnel -
        aggregates.impotSocietes;
      expect(sig.capaciteAutofinancement).toBe(soustractive);
    });
  });

  describe("partage de la valeur ajoutée", () => {
    it("répartit la valeur ajoutée entre ses bénéficiaires", () => {
      const partage = sig.partageValeurAjoutee;
      expect(partage).not.toBeNull();
      const salaries = partage?.find((p) => p.id === "salaries");
      expect(salaries?.montant).toBe(250);
      expect(salaries?.part).toBeCloseTo(250 / 450, 6);
    });

    it("boucle sur la valeur ajoutée", () => {
      // Salariés + État + prêteurs + entreprise = 250 + 55 + 20 + 120 = 445.
      // Le reliquat de 5 est le produit financier, qui n'est pas un emploi de
      // la valeur ajoutée : la somme ne doit donc pas être forcée à 100 %.
      const total = (sig.partageValeurAjoutee ?? []).reduce((s, p) => s + p.montant, 0);
      expect(total).toBe(445);
    });

    it("renonce au partage quand la valeur ajoutée est négative", () => {
      const deficitaire = computeAggregates([
        { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 100 },
        { poste: LinePoste.ACHATS_CONSOMMES, amount: 300 },
      ]);
      expect(computeSig(deficitaire).partageValeurAjoutee).toBeNull();
    });
  });

  it("expose chaque solde avec sa formule et sa part du chiffre d'affaires", () => {
    const ebe = sig.soldes.find((s) => s.id === "ebe");
    expect(ebe?.formule).toContain("Valeur ajoutée");
    expect(ebe?.partDuCa).toBeCloseTo(0.17, 6);
  });

  it("laisse la part du chiffre d'affaires à null quand il n'y a pas de chiffre d'affaires", () => {
    const sansCa = computeSig(computeAggregates([{ poste: LinePoste.CHARGES_PERSONNEL, amount: 10 }]));
    expect(sansCa.soldes.every((s) => s.partDuCa === null)).toBe(true);
  });
});

describe("tableau de flux de trésorerie", () => {
  /**
   * Clôture construite à la main pour que chaque flux soit vérifiable :
   * résultat net 60, dotations 60 (donc CAF 120), une acquisition de 100,
   * un remboursement d'emprunt de 50, un dividende de 30, et un BFR qui
   * gonfle de 40.
   */
  const CLOTURE = computeAggregates([
    { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 1000 },
    { poste: LinePoste.ACHATS_CONSOMMES, amount: 400 },
    { poste: LinePoste.CHARGES_EXTERNES, amount: 150 },
    { poste: LinePoste.CHARGES_PERSONNEL, amount: 250 },
    { poste: LinePoste.IMPOTS_TAXES, amount: 30 },
    { poste: LinePoste.DOTATIONS_AMORTISSEMENTS, amount: 60 },
    { poste: LinePoste.CHARGES_FINANCIERES, amount: 20 },
    { poste: LinePoste.PRODUITS_FINANCIERS, amount: 5 },
    { poste: LinePoste.RESULTAT_EXCEPTIONNEL, amount: -10 },
    { poste: LinePoste.IMPOT_SOCIETES, amount: 25 },
    // Bilan : immobilisations 400 + 100 d'acquisition − 60 d'amortissement.
    { poste: LinePoste.IMMOBILISATIONS, amount: 440 },
    { poste: LinePoste.STOCKS, amount: 140 },
    { poste: LinePoste.CREANCES_CLIENTS, amount: 200 },
    { poste: LinePoste.AUTRES_CREANCES, amount: 50 },
    { poste: LinePoste.DISPONIBILITES, amount: 130 },
    // Capitaux propres : 600 + 60 de résultat − 30 de dividende.
    { poste: LinePoste.CAPITAUX_PROPRES, amount: 630 },
    { poste: LinePoste.DETTES_FINANCIERES, amount: 200 },
    { poste: LinePoste.DETTES_FOURNISSEURS, amount: 100 },
    { poste: LinePoste.AUTRES_DETTES, amount: 30 },
  ]);

  const flux = computeTableauFlux(OUVERTURE, CLOTURE);

  it("part de deux bilans équilibrés", () => {
    expect(bilanEstEquilibre(computeDerived(OUVERTURE))).toBe(true);
    expect(bilanEstEquilibre(computeDerived(CLOTURE))).toBe(true);
  });

  it("prend en compte les autres créances et dettes dans le besoin en fonds de roulement", () => {
    // 100 + 200 + 50 − 100 − 50 = 200 à l'ouverture,
    // 140 + 200 + 50 − 100 − 30 = 260 à la clôture.
    expect(bfrComplet(OUVERTURE)).toBe(200);
    expect(bfrComplet(CLOTURE)).toBe(260);
  });

  it("calcule le flux d'exploitation", () => {
    // CAF 120 − variation de BFR 60 = 60
    expect(flux.fluxExploitation).toBe(60);
  });

  it("neutralise l'amortissement dans le flux d'investissement", () => {
    // Immobilisations nettes +40, dotations 60 : 100 réellement acquis.
    expect(flux.fluxInvestissement).toBe(-100);
  });

  it("sépare le remboursement d'emprunt du dividende", () => {
    const financement = flux.sections.find((s) => s.id === "financement");
    expect(financement?.lignes.find((l) => l.id === "dettes_financieres")?.montant).toBe(-50);
    expect(financement?.lignes.find((l) => l.id === "capital")?.montant).toBe(-30);
    expect(flux.fluxFinancement).toBe(-80);
  });

  it("réconcilie exactement avec la variation des disponibilités", () => {
    // 60 − 100 − 80 = −120, et la trésorerie passe bien de 250 à 130.
    expect(flux.variationTresorerie).toBe(-120);
    expect(flux.tresorerieCloture - flux.tresorerieOuverture).toBe(-120);
    expect(flux.ecartReconciliation).toBe(0);
  });

  it("dénonce un bilan déséquilibré par un écart de réconciliation", () => {
    // On ajoute 25 aux disponibilités sans contrepartie : le bilan ne boucle
    // plus, et le tableau doit le dire plutôt que de présenter un total faux.
    const fausse = { ...CLOTURE, disponibilites: CLOTURE.disponibilites + 25 };
    const resultat = computeTableauFlux(OUVERTURE, fausse);
    expect(bilanEstEquilibre(computeDerived(fausse))).toBe(false);
    expect(resultat.ecartReconciliation).toBe(-25);
  });

  it("explique le sens de la variation du besoin en fonds de roulement", () => {
    const exploitation = flux.sections.find((s) => s.id === "exploitation");
    const ligne = exploitation?.lignes.find((l) => l.id === "variation_bfr");
    expect(ligne?.montant).toBe(-60);
    expect(ligne?.explication).toContain("immobilisé");
  });

  it("tient sur deux bilans identiques : aucun flux", () => {
    const immobile = computeTableauFlux(OUVERTURE, OUVERTURE);
    expect(immobile.fluxExploitation).toBe(0);
    expect(immobile.fluxInvestissement).toBe(0);
    expect(immobile.fluxFinancement).toBe(0);
    expect(immobile.ecartReconciliation).toBe(0);
  });
});
