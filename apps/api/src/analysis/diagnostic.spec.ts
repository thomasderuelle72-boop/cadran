import { LinePoste } from "@prisma/client";
import { computeAggregates, computeDerived } from "../ratios/engine";
import { computeDiagnostic, scoreAltman, scoreConanHolder } from "./scores";
import {
  PART_VARIABLE_DEFAUT,
  computeBfrNormatif,
  computeSeuilRentabilite,
  joursEntreDates,
} from "./structure";

/** Entreprise saine, chiffres ronds, bilan équilibré à 1 000. */
const SAINE = computeAggregates([
  { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 1200 },
  { poste: LinePoste.ACHATS_CONSOMMES, amount: 480 },
  { poste: LinePoste.CHARGES_EXTERNES, amount: 180 },
  { poste: LinePoste.CHARGES_PERSONNEL, amount: 300 },
  { poste: LinePoste.IMPOTS_TAXES, amount: 24 },
  { poste: LinePoste.DOTATIONS_AMORTISSEMENTS, amount: 60 },
  { poste: LinePoste.CHARGES_FINANCIERES, amount: 12 },
  { poste: LinePoste.IMPOT_SOCIETES, amount: 36 },
  { poste: LinePoste.IMMOBILISATIONS, amount: 400 },
  { poste: LinePoste.STOCKS, amount: 100 },
  { poste: LinePoste.CREANCES_CLIENTS, amount: 250 },
  { poste: LinePoste.AUTRES_CREANCES, amount: 50 },
  { poste: LinePoste.DISPONIBILITES, amount: 200 },
  { poste: LinePoste.CAPITAUX_PROPRES, amount: 600 },
  { poste: LinePoste.DETTES_FINANCIERES, amount: 200 },
  { poste: LinePoste.DETTES_FOURNISSEURS, amount: 150 },
  { poste: LinePoste.AUTRES_DETTES, amount: 50 },
]);

/** Même taille, mais endettée, déficitaire et sans trésorerie. */
const FRAGILE = computeAggregates([
  { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 800 },
  { poste: LinePoste.ACHATS_CONSOMMES, amount: 420 },
  { poste: LinePoste.CHARGES_EXTERNES, amount: 200 },
  { poste: LinePoste.CHARGES_PERSONNEL, amount: 280 },
  { poste: LinePoste.IMPOTS_TAXES, amount: 20 },
  { poste: LinePoste.DOTATIONS_AMORTISSEMENTS, amount: 70 },
  { poste: LinePoste.CHARGES_FINANCIERES, amount: 60 },
  { poste: LinePoste.IMMOBILISATIONS, amount: 500 },
  { poste: LinePoste.STOCKS, amount: 180 },
  { poste: LinePoste.CREANCES_CLIENTS, amount: 290 },
  { poste: LinePoste.DISPONIBILITES, amount: 30 },
  { poste: LinePoste.CAPITAUX_PROPRES, amount: 60 },
  { poste: LinePoste.DETTES_FINANCIERES, amount: 640 },
  { poste: LinePoste.DETTES_FOURNISSEURS, amount: 220 },
  { poste: LinePoste.AUTRES_DETTES, amount: 80 },
]);

const ENTREES_SAINE = {
  aggregates: SAINE,
  derived: computeDerived(SAINE),
  reservesEtReportANouveau: 350,
  joursPeriode: 365,
};

const ENTREES_FRAGILE = {
  aggregates: FRAGILE,
  derived: computeDerived(FRAGILE),
  reservesEtReportANouveau: -120,
  joursPeriode: 365,
};

describe("scores de fragilité", () => {
  describe("Z' d'Altman", () => {
    const sain = scoreAltman(ENTREES_SAINE);

    it("expose chaque composante avec sa formule et son coefficient", () => {
      expect(sain.composantes.map((c) => c.id)).toEqual(["x1", "x2", "x3", "x4", "x5"]);
      const x3 = sain.composantes.find((c) => c.id === "x3");
      expect(x3?.coefficient).toBe(3.107);
      expect(x3?.formule).toContain("EBIT");
    });

    it("fait du score la somme exacte des contributions", () => {
      const somme = sain.composantes.reduce((total, c) => total + (c.contribution ?? 0), 0);
      expect(sain.valeur).toBeCloseTo(somme, 4);
    });

    it("annualise les flux rapportés à un poste de bilan", () => {
      // Les mêmes chiffres lus sur un trimestre ne doivent pas diviser par
      // quatre la rotation de l'actif ni la rentabilité économique : sans
      // cela, une entreprise saine tombe en zone de danger dès qu'on la
      // regarde au mois.
      const trimestre = scoreAltman({ ...ENTREES_SAINE, joursPeriode: 91 });
      const annuel = scoreAltman({ ...ENTREES_SAINE, joursPeriode: 365 });
      for (const id of ["x3", "x5"]) {
        const surTrimestre = trimestre.composantes.find((c) => c.id === id)?.valeur ?? 0;
        const surAnnee = annuel.composantes.find((c) => c.id === id)?.valeur ?? 0;
        expect(surTrimestre).toBeCloseTo(surAnnee * (365 / 91), 3);
      }
    });

    it("laisse inchangées les composantes qui ne mêlent pas flux et stock", () => {
      const trimestre = scoreAltman({ ...ENTREES_SAINE, joursPeriode: 91 });
      const annuel = scoreAltman({ ...ENTREES_SAINE, joursPeriode: 365 });
      for (const id of ["x1", "x2", "x4"]) {
        expect(trimestre.composantes.find((c) => c.id === id)?.valeur).toBe(
          annuel.composantes.find((c) => c.id === id)?.valeur
        );
      }
    });

    it("classe l'entreprise saine hors de la zone de danger", () => {
      expect(sain.zone).not.toBe("danger");
      expect(sain.valeur).toBeGreaterThan(sain.seuilDanger);
    });

    it("classe l'entreprise fragile en zone de danger", () => {
      const fragile = scoreAltman(ENTREES_FRAGILE);
      expect(fragile.valeur).toBeLessThan(fragile.seuilDanger);
      expect(fragile.zone).toBe("danger");
    });

    it("se déclare indisponible plutôt que d'approcher les réserves", () => {
      const sansReserves = scoreAltman({ ...ENTREES_SAINE, reservesEtReportANouveau: null });
      expect(sansReserves.valeur).toBeNull();
      expect(sansReserves.zone).toBe("indisponible");
      expect(sansReserves.motifIndisponibilite).toContain("grand livre");
    });

    it("énonce ses limites", () => {
      expect(sain.limites).toContain("structure");
    });
  });

  describe("Conan & Holder", () => {
    const sain = scoreConanHolder(ENTREES_SAINE);

    it("pèse négativement le coût de la dette et la part du personnel", () => {
      expect(sain.composantes.find((c) => c.id === "r4")?.coefficient).toBe(-0.87);
      expect(sain.composantes.find((c) => c.id === "r5")?.coefficient).toBe(-0.1);
    });

    it("sépare l'entreprise saine de l'entreprise fragile", () => {
      const fragile = scoreConanHolder(ENTREES_FRAGILE);
      expect(sain.valeur).not.toBeNull();
      expect(fragile.valeur).not.toBeNull();
      expect(sain.valeur!).toBeGreaterThan(fragile.valeur!);
    });

    it("applique les seuils publiés, qui s'expriment en pourcentage", () => {
      // Le score dépasse rarement l'unité : porter les seuils en unités
      // (4 et 9, comme on le lit parfois) classerait en danger n'importe
      // quelle entreprise, y compris une très saine.
      expect(sain.seuilDanger).toBe(0.04);
      expect(sain.seuilSain).toBe(0.09);
      expect(sain.zone).toBe("sain");
      expect(scoreConanHolder(ENTREES_FRAGILE).zone).toBe("danger");
    });

    it("signale une entreprise hors du domaine de calibration du modèle", () => {
      // 1 200 € de chiffre d'affaires annuel est très en dessous du plancher
      // de 1,5 M€ sur lequel le modèle a été établi.
      expect(sain.avertissementCalibration).toContain("1,5 à 75 M€");
    });

    it("ne signale rien quand l'entreprise est dans le domaine", () => {
      const dansLeDomaine = scoreConanHolder({
        ...ENTREES_SAINE,
        aggregates: { ...SAINE, chiffreAffaires: 12_000_000 },
      });
      expect(dansLeDomaine.avertissementCalibration).toBeNull();
    });

    it("annualise l'excédent brut avant de le rapporter aux dettes", () => {
      // R1 rapporte un flux à un stock : sans annualisation, un mois
      // d'excédent face à la dette entière classerait n'importe qui en danger.
      const mois = scoreConanHolder({ ...ENTREES_SAINE, joursPeriode: 31 });
      const annuel = scoreConanHolder({ ...ENTREES_SAINE, joursPeriode: 365 });
      expect(mois.composantes.find((c) => c.id === "r1")?.valeur).toBeCloseTo(
        (annuel.composantes.find((c) => c.id === "r1")?.valeur ?? 0) * (365 / 31),
        2
      );
    });

    it("laisse inchangés les rapports de flux à flux", () => {
      // R4 et R5 comparent deux flux de même durée : ils sont invariants.
      const mois = scoreConanHolder({ ...ENTREES_SAINE, joursPeriode: 31 });
      const annuel = scoreConanHolder({ ...ENTREES_SAINE, joursPeriode: 365 });
      for (const id of ["r4", "r5"]) {
        expect(mois.composantes.find((c) => c.id === id)?.valeur).toBe(
          annuel.composantes.find((c) => c.id === id)?.valeur
        );
      }
    });

    it("n'a pas besoin des réserves accumulées", () => {
      const sansReserves = scoreConanHolder({ ...ENTREES_SAINE, reservesEtReportANouveau: null });
      expect(sansReserves.valeur).not.toBeNull();
    });
  });

  describe("lecture d'ensemble", () => {
    it("relève la convergence des deux modèles sur une entreprise solide", () => {
      // SAINE tombe à 2,896 chez Altman, à quatre millièmes du seuil de 2,9 :
      // c'est un cas limite, utile ailleurs mais impropre à tester la
      // convergence. On prend ici une entreprise franchement solide.
      const solide = computeAggregates([
        { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 1600 },
        { poste: LinePoste.ACHATS_CONSOMMES, amount: 560 },
        { poste: LinePoste.CHARGES_EXTERNES, amount: 200 },
        { poste: LinePoste.CHARGES_PERSONNEL, amount: 340 },
        { poste: LinePoste.DOTATIONS_AMORTISSEMENTS, amount: 60 },
        { poste: LinePoste.IMPOT_SOCIETES, amount: 90 },
        { poste: LinePoste.IMMOBILISATIONS, amount: 300 },
        { poste: LinePoste.STOCKS, amount: 80 },
        { poste: LinePoste.CREANCES_CLIENTS, amount: 220 },
        { poste: LinePoste.DISPONIBILITES, amount: 400 },
        { poste: LinePoste.CAPITAUX_PROPRES, amount: 850 },
        { poste: LinePoste.DETTES_FOURNISSEURS, amount: 150 },
      ]);
      const diagnostic = computeDiagnostic({
        aggregates: solide,
        derived: computeDerived(solide),
        reservesEtReportANouveau: 500,
        joursPeriode: 365,
      });
      expect(diagnostic.scores.every((s) => s.zone === "sain")).toBe(true);
      expect(diagnostic.convergence).toBe("convergente");
      expect(diagnostic.commentaire).toContain("saine");
    });

    it("relève la divergence quand les deux modèles ne disent pas la même chose", () => {
      // Sur SAINE, Altman reste en zone grise quand Conan & Holder conclut au
      // vert : la divergence est elle-même une information, et le commentaire
      // doit dire pourquoi les deux modèles ne regardent pas la même chose.
      const diagnostic = computeDiagnostic(ENTREES_SAINE);
      expect(diagnostic.convergence).toBe("divergente");
      expect(diagnostic.commentaire).toContain("ne pèsent pas les mêmes choses");
    });

    it("relève la convergence des deux modèles sur une entreprise fragile", () => {
      const diagnostic = computeDiagnostic(ENTREES_FRAGILE);
      expect(diagnostic.scores).toHaveLength(2);
      expect(diagnostic.convergence).toBe("convergente");
      expect(diagnostic.commentaire).toContain("danger");
    });

    it("signale qu'un seul modèle est calculable", () => {
      const diagnostic = computeDiagnostic({ ...ENTREES_SAINE, reservesEtReportANouveau: null });
      expect(diagnostic.convergence).toBe("partielle");
      expect(diagnostic.commentaire).toContain("Conan");
    });
  });
});

describe("seuil de rentabilité", () => {
  /**
   * Cas calculable de tête : 1 000 de chiffre d'affaires, 400 de charges
   * strictement variables et 300 de charges strictement fixes. Le taux de
   * marge sur coût variable vaut 60 %, le seuil 500.
   */
  const SIMPLE = computeAggregates([
    { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 1000 },
    { poste: LinePoste.ACHATS_CONSOMMES, amount: 400 },
    { poste: LinePoste.CHARGES_EXTERNES, amount: 100 },
    { poste: LinePoste.IMPOTS_TAXES, amount: 100 },
    { poste: LinePoste.DOTATIONS_AMORTISSEMENTS, amount: 100 },
  ]);

  const seuil = computeSeuilRentabilite(SIMPLE, 365, {
    CHARGES_EXTERNES: 0,
  });

  it("ventile chaque poste de charge entre fixe et variable", () => {
    const achats = seuil.ventilation.find((v) => v.poste === LinePoste.ACHATS_CONSOMMES);
    expect(achats?.variable).toBe(400);
    expect(achats?.fixe).toBe(0);
    const dotations = seuil.ventilation.find((v) => v.poste === LinePoste.DOTATIONS_AMORTISSEMENTS);
    expect(dotations?.variable).toBe(0);
    expect(dotations?.fixe).toBe(100);
  });

  it("calcule la marge sur coût variable et son taux", () => {
    expect(seuil.chargesVariables).toBe(400);
    expect(seuil.chargesFixes).toBe(300);
    expect(seuil.margeSurCoutVariable).toBe(600);
    expect(seuil.tauxMargeSurCoutVariable).toBeCloseTo(0.6, 6);
  });

  it("calcule le seuil, la marge et l'indice de sécurité", () => {
    expect(seuil.seuilRentabilite).toBeCloseTo(500, 6);
    expect(seuil.margeSecurite).toBeCloseTo(500, 6);
    expect(seuil.indiceSecurite).toBeCloseTo(0.5, 6);
  });

  it("place le point mort dans la période", () => {
    // Le seuil vaut la moitié du chiffre d'affaires : il est atteint à
    // mi-parcours.
    expect(seuil.pointMortJours).toBeCloseTo(182.5, 6);
  });

  it("calcule le levier opérationnel", () => {
    // Marge 600 / résultat 300 : une hausse de 1 % du chiffre d'affaires
    // fait progresser le résultat de 2 %.
    expect(seuil.levierOperationnel).toBeCloseTo(2, 6);
  });

  it("applique les hypothèses par défaut quand aucune n'est fournie", () => {
    const parDefaut = computeSeuilRentabilite(SIMPLE, 365);
    const externes = parDefaut.ventilation.find((v) => v.poste === LinePoste.CHARGES_EXTERNES);
    expect(externes?.partVariable).toBe(PART_VARIABLE_DEFAUT.CHARGES_EXTERNES);
    expect(externes?.variable).toBeCloseTo(30, 6);
  });

  it("renonce au seuil quand la marge sur coût variable est négative", () => {
    // Vendre plus creuse alors la perte : annoncer un seuil serait un
    // contresens.
    const deficitaire = computeAggregates([
      { poste: LinePoste.CHIFFRE_AFFAIRES, amount: 100 },
      { poste: LinePoste.ACHATS_CONSOMMES, amount: 140 },
    ]);
    const resultat = computeSeuilRentabilite(deficitaire, 365);
    expect(resultat.tauxMargeSurCoutVariable).toBeLessThan(0);
    expect(resultat.seuilRentabilite).toBeNull();
    expect(resultat.pointMortJours).toBeNull();
  });

  it("tient sans chiffre d'affaires", () => {
    const vide = computeSeuilRentabilite(computeAggregates([]), 365);
    expect(vide.tauxMargeSurCoutVariable).toBeNull();
    expect(vide.seuilRentabilite).toBeNull();
  });
});

describe("besoin en fonds de roulement normatif", () => {
  const derived = computeDerived(SAINE);
  const bfr = computeBfrNormatif(SAINE, derived, 365);

  it("reprend le besoin en fonds de roulement du moteur de ratios", () => {
    // 100 de stocks + 250 de créances − 150 de fournisseurs
    expect(bfr.bfr).toBe(200);
    expect(bfr.bfr).toBe(derived.bfr);
  });

  it("l'exprime en jours de chiffre d'affaires", () => {
    // 1 200 / 365 ≈ 3,288 € par jour ; 200 / 3,288 ≈ 60,8 jours
    expect(bfr.caJournalier).toBeCloseTo(1200 / 365, 6);
    expect(bfr.bfrEnJours).toBeCloseTo(200 / (1200 / 365), 4);
  });

  it("décompose le besoin poste par poste, dettes fournisseurs en négatif", () => {
    const fournisseurs = bfr.composantes.find((c) => c.id === "fournisseurs");
    expect(fournisseurs?.montant).toBe(-150);
    expect(fournisseurs?.jours).toBeLessThan(0);
    const somme = bfr.composantes.reduce((total, c) => total + c.montant, 0);
    expect(somme).toBe(bfr.bfr);
  });

  it("chiffre la trésorerie qu'immobiliserait la croissance", () => {
    const cinquante = bfr.besoinCroissance.find((c) => c.croissance === 0.5);
    expect(cinquante?.caSupplementaire).toBe(600);
    // Croître de moitié immobilise la moitié du BFR en plus, avant
    // d'encaisser le premier euro de marge supplémentaire.
    expect(cinquante?.besoin).toBe(100);
  });

  it("ne projette rien sans chiffre d'affaires", () => {
    const sansCa = computeAggregates([{ poste: LinePoste.STOCKS, amount: 50 }]);
    const resultat = computeBfrNormatif(sansCa, computeDerived(sansCa), 365);
    expect(resultat.bfrEnJours).toBeNull();
    expect(resultat.besoinCroissance).toEqual([]);
  });
});

describe("durée d'une période", () => {
  it("compte les deux bornes", () => {
    expect(joursEntreDates(new Date("2026-01-01"), new Date("2026-01-31"))).toBe(31);
    expect(joursEntreDates(new Date("2026-01-01"), new Date("2026-03-31"))).toBe(90);
  });

  it("ne descend jamais sous un jour", () => {
    expect(joursEntreDates(new Date("2026-01-10"), new Date("2026-01-10"))).toBe(1);
    expect(joursEntreDates(new Date("2026-01-10"), new Date("2026-01-01"))).toBe(1);
  });
});
