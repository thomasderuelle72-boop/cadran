import { LinePoste } from "@prisma/client";
import { suggestPoste } from "./pcg-mapping";
import { computeDerived, lireAgregats } from "../ratios/engine";
import { agregerParMois, type EcritureAgregable } from "../fec/fec-aggregation";
import { computeSig } from "../analysis/sig";
import { computeTableauFlux } from "../analysis/tableau-flux";

/**
 * La table de correspondance face à la réforme du PCG (règlement ANC 2022-06,
 * exercices ouverts depuis le 1er janvier 2025).
 *
 * L'enjeu n'est pas la nomenclature pour elle-même. C'est qu'une même
 * opération — revendre un camion, amortir une subvention — doit donner le même
 * EBITDA et la même CAF qu'elle ait été comptabilisée en 2024 ou en 2025.
 * Sans cela, le pluriannuel compare deux définitions différentes, et la
 * différence ressemble à une variation d'activité.
 */

describe("table de correspondance PCG", () => {
  describe("cessions d'immobilisations", () => {
    it("isole la cession, avant comme après la réforme", () => {
      // Après : 757 / 657 pour le corporel et l'incorporel.
      expect(suggestPoste("757000")).toBe(LinePoste.RESULTAT_CESSIONS);
      expect(suggestPoste("657000")).toBe(LinePoste.RESULTAT_CESSIONS);
      // Avant : 775 / 675.
      expect(suggestPoste("775200")).toBe(LinePoste.RESULTAT_CESSIONS);
      expect(suggestPoste("675200")).toBe(LinePoste.RESULTAT_CESSIONS);
    });

    it("isole les cessions d'immobilisations financières de la réforme", () => {
      expect(suggestPoste("767100")).toBe(LinePoste.RESULTAT_CESSIONS);
      expect(suggestPoste("667100")).toBe(LinePoste.RESULTAT_CESSIONS);
      expect(suggestPoste("767200")).toBe(LinePoste.RESULTAT_CESSIONS);
      expect(suggestPoste("667200")).toBe(LinePoste.RESULTAT_CESSIONS);
    });

    it("laisse au financier les cessions de valeurs mobilières de placement", () => {
      // 767 et 667 sans sous-compte gardent leur sens historique : ce sont
      // des produits et charges nets sur VMP, pas des cessions d'actif.
      expect(suggestPoste("767000")).toBe(LinePoste.PRODUITS_FINANCIERS);
      expect(suggestPoste("667000")).toBe(LinePoste.CHARGES_FINANCIERES);
    });

    it("ne détourne pas le reste des classes 65 et 75", () => {
      expect(suggestPoste("651000")).toBe(LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION);
      expect(suggestPoste("758700")).toBe(LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION);
    });
  });

  describe("subventions d'investissement", () => {
    it("traite la quote-part virée au résultat comme une reprise de dotation", () => {
      // 747 après la réforme, 777 avant : dans les deux cas, elle vient en
      // déduction des dotations — ni dans l'EBITDA, ni dans la CAF.
      expect(suggestPoste("747000")).toBe(LinePoste.DOTATIONS_AMORTISSEMENTS);
      expect(suggestPoste("777000")).toBe(LinePoste.DOTATIONS_AMORTISSEMENTS);
    });

    it("laisse les subventions d'exploitation dans l'exploitation", () => {
      expect(suggestPoste("740000")).toBe(LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION);
    });
  });

  describe("comptes supprimés par la réforme", () => {
    it("reconnaît les transferts de charges des exercices antérieurs", () => {
      // Absents de la table, ils remontaient en comptes non classés.
      expect(suggestPoste("791000")).toBe(LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION);
      expect(suggestPoste("796000")).toBe(LinePoste.PRODUITS_FINANCIERS);
      expect(suggestPoste("797000")).toBe(LinePoste.RESULTAT_EXCEPTIONNEL);
    });
  });

  describe("dotations et reprises", () => {
    it("range chaque dotation dans le résultat de sa nature", () => {
      expect(suggestPoste("681100")).toBe(LinePoste.DOTATIONS_AMORTISSEMENTS);
      expect(suggestPoste("686600")).toBe(LinePoste.CHARGES_FINANCIERES);
      expect(suggestPoste("687100")).toBe(LinePoste.RESULTAT_EXCEPTIONNEL);
    });

    it("reconnaît les reprises, que la table ignorait", () => {
      expect(suggestPoste("781700")).toBe(LinePoste.DOTATIONS_AMORTISSEMENTS);
      expect(suggestPoste("786600")).toBe(LinePoste.PRODUITS_FINANCIERS);
      expect(suggestPoste("787600")).toBe(LinePoste.RESULTAT_EXCEPTIONNEL);
    });
  });
});

/*
 * Une même PME, le même exercice, deux tenues comptables : l'une avant la
 * réforme, l'autre après. Ventes 100 000, salaires 60 000, dotations 10 000,
 * et la revente d'un véhicule 15 000 € pour une valeur nette comptable de
 * 9 000 € — soit 6 000 € de plus-value — plus 2 000 € de quote-part de
 * subvention d'investissement.
 */
function ecriture(accountCode: string, debit: number, credit: number): EcritureAgregable {
  return {
    entryDate: new Date("2025-06-30T00:00:00.000Z"),
    accountCode,
    accountLabel: accountCode,
    debit,
    credit,
  };
}

function exercice(plan: "avant" | "apres") {
  const produitCession = plan === "apres" ? "757000" : "775200";
  const valeurComptable = plan === "apres" ? "657000" : "675200";
  const subvention = plan === "apres" ? "747000" : "777000";

  const { periodes } = agregerParMois([
    ecriture("706000", 0, 100_000),
    ecriture("512000", 100_000, 0),
    ecriture("641000", 60_000, 0),
    ecriture("512000", 0, 60_000),
    ecriture("681100", 10_000, 0),
    ecriture("281800", 0, 10_000),
    // Cession : sortie de la valeur comptable, encaissement du prix.
    ecriture(valeurComptable, 9_000, 0),
    ecriture("218200", 0, 9_000),
    ecriture("512000", 15_000, 0),
    ecriture(produitCession, 0, 15_000),
    // Quote-part de subvention virée au résultat.
    ecriture("139000", 2_000, 0),
    ecriture(subvention, 0, 2_000),
  ]);
  return periodes[0].agregats;
}

describe("une cession, avant et après la réforme", () => {
  const avant = exercice("avant");
  const apres = exercice("apres");

  it("donne exactement les mêmes agrégats sous les deux plans comptables", () => {
    expect(apres).toEqual(avant);
  });

  it("isole la plus-value, nette de la valeur comptable", () => {
    expect(apres.resultatCessions).toBe(6_000);
  });

  it("garde l'EBITDA hors de la cession et de la subvention", () => {
    // Ventes 100 000 − salaires 60 000. Avant ce correctif, la réforme y
    // aurait ajouté 6 000 de plus-value et 2 000 de subvention.
    expect(computeDerived(apres).ebitda).toBe(40_000);
  });

  it("garde la plus-value dans le résultat net", () => {
    // 40 000 − (10 000 − 2 000) de dotations nettes + 6 000 de cession.
    expect(computeDerived(apres).resultatNet).toBe(38_000);
  });

  it("retire la plus-value et la subvention de la CAF", () => {
    // La CAF est l'EBITDA ici, faute de résultat financier et d'impôt :
    // ni la plus-value ni la quote-part de subvention ne se renouvellent.
    const sig = computeSig(apres);
    const caf = sig.soldes.find((s) => s.id === "caf");
    expect(caf?.valeur).toBe(40_000);
  });
});

describe("tableau des flux avec une cession", () => {
  const vide = { ...exercice("apres") };
  for (const cle of Object.keys(vide) as (keyof typeof vide)[]) vide[cle] = 0;
  const ouverture = { ...vide, immobilisations: 50_000, capitauxPropres: 50_000 };
  const cloture = {
    ...vide,
    chiffreAffaires: 100_000,
    chargesPersonnel: 60_000,
    dotationsAmortissements: 10_000,
    resultatCessions: 6_000,
    // 50 000 − 9 000 cédés − 10 000 amortis.
    immobilisations: 31_000,
    // 40 000 d'exploitation + 15 000 de prix de cession.
    disponibilites: 55_000,
    capitauxPropres: 50_000 + 36_000,
  };
  const flux = computeTableauFlux(ouverture, cloture);
  const section = (id: string) => flux.sections.find((s) => s.id === id);

  it("place l'exploitation hors plus-value", () => {
    expect(section("exploitation")?.total).toBe(40_000);
  });

  it("retrouve le prix de cession encaissé en investissement", () => {
    expect(section("investissement")?.total).toBe(15_000);
  });

  it("ne change pas la variation de trésorerie totale", () => {
    // 40 000 d'exploitation + 15 000 de cession = 55 000, exactement ce que
    // la banque a constaté : la plus-value a changé de section, pas de total.
    expect(flux.variationTresorerie).toBe(55_000);
    expect(flux.ecartReconciliation).toBe(0);
  });
});

describe("relecture des agrégats enregistrés avant le nouveau poste", () => {
  it("complète le poste manquant à zéro au lieu de produire NaN", () => {
    // Un enregistrement antérieur à RESULTAT_CESSIONS : le champ n'existe pas.
    const ancien: Record<string, number> = {
      ...computeAggregatesVides(),
      chiffreAffaires: 100_000,
      chargesPersonnel: 60_000,
    };
    delete ancien.resultatCessions;

    // Relu tel quel, le résultat net devient NaN : c'est ce que la
    // production aurait affiché sur chaque dossier existant.
    expect(Number.isNaN(computeDerived(ancien as never).resultatNet)).toBe(true);

    const relu = lireAgregats(ancien);
    expect(relu.resultatCessions).toBe(0);
    expect(computeDerived(relu).resultatNet).toBe(40_000);
  });

  it("écarte ce qui n'est pas un nombre fini", () => {
    const relu = lireAgregats({ chiffreAffaires: "12", chargesPersonnel: Number.NaN });
    expect(relu.chiffreAffaires).toBe(0);
    expect(relu.chargesPersonnel).toBe(0);
  });

  it("supporte un enregistrement vide ou absent", () => {
    expect(lireAgregats(null).chiffreAffaires).toBe(0);
    expect(lireAgregats(undefined).resultatCessions).toBe(0);
  });
});

function computeAggregatesVides() {
  return lireAgregats({});
}
