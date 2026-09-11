import { LinePoste } from "@prisma/client";
import { bilanEstEquilibre, computeDerived } from "../ratios/engine";
import {
  COMPTE_RESULTAT_EN_COURS,
  agregerParMois,
  estPosteResultat,
  type EcritureAgregable,
} from "./fec-aggregation";

function ecriture(
  date: string,
  accountCode: string,
  debit: number,
  credit: number,
  accountLabel = accountCode
): EcritureAgregable {
  return { entryDate: new Date(`${date}T00:00:00.000Z`), accountCode, accountLabel, debit, credit };
}

describe("agrégation mensuelle des écritures", () => {
  describe("nature des postes", () => {
    it("classe les comptes de gestion en postes de résultat", () => {
      expect(estPosteResultat(LinePoste.CHIFFRE_AFFAIRES)).toBe(true);
      expect(estPosteResultat(LinePoste.CHARGES_PERSONNEL)).toBe(true);
    });

    it("classe les comptes de bilan hors résultat", () => {
      expect(estPosteResultat(LinePoste.CREANCES_CLIENTS)).toBe(false);
      expect(estPosteResultat(LinePoste.CAPITAUX_PROPRES)).toBe(false);
    });
  });

  describe("flux contre stock", () => {
    // Un exercice de deux mois, volontairement minimal : en janvier une vente
    // de 1 000 encaissée en banque, en février une vente de 400 encaissée
    // aussi. Le résultat de février doit valoir 400 (le flux du mois), la
    // banque au 28 février 1 400 (le stock cumulé).
    const ecritures = [
      ecriture("2026-01-15", "512000", 1000, 0, "Banque"),
      ecriture("2026-01-15", "706000", 0, 1000, "Prestations"),
      ecriture("2026-02-10", "512000", 400, 0, "Banque"),
      ecriture("2026-02-10", "706000", 0, 400, "Prestations"),
    ];

    const { periodes } = agregerParMois(ecritures);

    it("produit une période par mois", () => {
      expect(periodes.map((p) => p.cle)).toEqual(["2026-01", "2026-02"]);
      expect(periodes[0].label).toBe("Janvier 2026");
    });

    it("borne chaque période au premier et au dernier jour du mois", () => {
      expect(periodes[0].debut.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(periodes[0].fin.toISOString()).toBe("2026-01-31T00:00:00.000Z");
      expect(periodes[1].fin.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    });

    it("ne retient que le flux du mois pour un poste de résultat", () => {
      expect(periodes[0].agregats.chiffreAffaires).toBe(1000);
      expect(periodes[1].agregats.chiffreAffaires).toBe(400);
    });

    it("cumule depuis l'ouverture pour un poste de bilan", () => {
      expect(periodes[0].agregats.disponibilites).toBe(1000);
      expect(periodes[1].agregats.disponibilites).toBe(1400);
    });
  });

  describe("sens naturel des comptes", () => {
    it("rend les charges positives (débit − crédit)", () => {
      const { periodes } = agregerParMois([
        ecriture("2026-01-10", "641000", 2000, 0, "Salaires"),
        ecriture("2026-01-10", "421000", 0, 2000, "Personnel"),
      ]);
      expect(periodes[0].agregats.chargesPersonnel).toBe(2000);
      expect(periodes[0].agregats.autresDettes).toBe(2000);
    });

    it("rend les produits positifs (crédit − débit)", () => {
      const { periodes } = agregerParMois([
        ecriture("2026-01-10", "411000", 1200, 0, "Clients"),
        ecriture("2026-01-10", "706000", 0, 1200, "Prestations"),
      ]);
      expect(periodes[0].agregats.chiffreAffaires).toBe(1200);
      expect(periodes[0].agregats.creancesClients).toBe(1200);
    });

    it("déduit les amortissements de la valeur brute des immobilisations", () => {
      // 215 brut au débit, 281 amortissement au crédit : les deux comptes
      // tombent sous le même poste, le solde obtenu est donc la valeur nette.
      const { periodes } = agregerParMois([
        ecriture("2026-01-05", "215000", 50000, 0, "Matériel"),
        ecriture("2026-01-05", "404000", 0, 50000, "Fournisseurs d'immobilisations"),
        ecriture("2026-01-31", "681100", 800, 0, "Dotation"),
        ecriture("2026-01-31", "281500", 0, 800, "Amortissement du matériel"),
      ]);
      expect(periodes[0].agregats.immobilisations).toBe(49200);
      expect(periodes[0].agregats.dotationsAmortissements).toBe(800);
    });

    it("nette les autres produits et charges d'exploitation", () => {
      const { periodes } = agregerParMois([
        ecriture("2026-01-10", "740000", 0, 5000, "Subvention"),
        ecriture("2026-01-10", "512000", 5000, 0, "Banque"),
        ecriture("2026-01-20", "651000", 1200, 0, "Redevances"),
        ecriture("2026-01-20", "512000", 0, 1200, "Banque"),
      ]);
      expect(periodes[0].agregats.autresProduitsChargesExploitation).toBe(3800);
    });
  });

  describe("résultat de l'exercice en cours", () => {
    // Le compte 120 est vide pendant l'exercice : sans ligne synthétique, le
    // bilan mensuel ne peut pas s'équilibrer.
    const ecritures = [
      // À-nouveaux : 10 000 de capital financés par la banque.
      ecriture("2026-01-01", "512000", 10000, 0, "Banque"),
      ecriture("2026-01-01", "101000", 0, 10000, "Capital"),
      // Vente de 3 000 encaissée, charges de 1 200 payées.
      ecriture("2026-01-20", "512000", 3000, 0, "Banque"),
      ecriture("2026-01-20", "706000", 0, 3000, "Prestations"),
      ecriture("2026-01-25", "606000", 1200, 0, "Achats"),
      ecriture("2026-01-25", "512000", 0, 1200, "Banque"),
    ];

    const { periodes } = agregerParMois(ecritures);
    const janvier = periodes[0];

    it("ajoute une ligne de résultat couru aux capitaux propres", () => {
      const ligne = janvier.lignes.find((l) => l.accountCode === COMPTE_RESULTAT_EN_COURS);
      expect(ligne).toBeDefined();
      expect(ligne?.poste).toBe(LinePoste.CAPITAUX_PROPRES);
      expect(ligne?.amount).toBe(1800);
    });

    it("équilibre le bilan obtenu", () => {
      // Actif : banque 11 800. Passif : capital 10 000 + résultat 1 800.
      expect(janvier.agregats.disponibilites).toBe(11800);
      expect(janvier.agregats.capitauxPropres).toBe(11800);
      expect(bilanEstEquilibre(computeDerived(janvier.agregats))).toBe(true);
    });

    it("cumule le résultat de mois en mois", () => {
      const surDeuxMois = agregerParMois([
        ...ecritures,
        ecriture("2026-02-10", "512000", 500, 0, "Banque"),
        ecriture("2026-02-10", "706000", 0, 500, "Prestations"),
      ]);
      const fevrier = surDeuxMois.periodes[1];
      // Le CA de février seul vaut 500, mais le résultat porté au bilan est
      // celui de l'exercice couru : 1 800 + 500.
      expect(fevrier.agregats.chiffreAffaires).toBe(500);
      const ligne = fevrier.lignes.find((l) => l.accountCode === COMPTE_RESULTAT_EN_COURS);
      expect(ligne?.amount).toBe(2300);
      expect(bilanEstEquilibre(computeDerived(fevrier.agregats))).toBe(true);
    });
  });

  describe("mois sans mouvement", () => {
    it("produit quand même la période, avec son bilan", () => {
      const { periodes } = agregerParMois([
        ecriture("2026-01-05", "512000", 7000, 0, "Banque"),
        ecriture("2026-01-05", "101000", 0, 7000, "Capital"),
        ecriture("2026-03-05", "512000", 1000, 0, "Banque"),
        ecriture("2026-03-05", "706000", 0, 1000, "Prestations"),
      ]);

      expect(periodes.map((p) => p.cle)).toEqual(["2026-01", "2026-02", "2026-03"]);
      // Février n'a aucun mouvement : chiffre d'affaires nul, mais la banque
      // et le capital sont toujours là.
      expect(periodes[1].agregats.chiffreAffaires).toBe(0);
      expect(periodes[1].agregats.disponibilites).toBe(7000);
      expect(periodes[1].agregats.capitauxPropres).toBe(7000);
    });
  });

  describe("détail par compte", () => {
    const { periodes } = agregerParMois([
      ecriture("2026-01-10", "706100", 0, 800, "Ventes France"),
      ecriture("2026-01-10", "706200", 0, 400, "Ventes export"),
      ecriture("2026-01-10", "411000", 1200, 0, "Clients"),
    ]);

    it("conserve une ligne par compte sous l'agrégat", () => {
      const ventes = periodes[0].lignes.filter((l) => l.poste === LinePoste.CHIFFRE_AFFAIRES);
      expect(ventes.map((l) => l.accountCode)).toEqual(["706100", "706200"]);
      expect(ventes.map((l) => l.amount)).toEqual([800, 400]);
    });

    it("fait correspondre la somme des lignes à l'agrégat du poste", () => {
      const somme = periodes[0].lignes
        .filter((l) => l.poste === LinePoste.CHIFFRE_AFFAIRES)
        .reduce((total, l) => total + l.amount, 0);
      expect(somme).toBe(periodes[0].agregats.chiffreAffaires);
    });

    it("omet les comptes soldés à zéro sur la période", () => {
      const { periodes: avecSolde } = agregerParMois([
        ecriture("2026-01-10", "512000", 500, 0, "Banque"),
        ecriture("2026-01-20", "512000", 0, 500, "Banque"),
        ecriture("2026-01-10", "706000", 0, 500, "Prestations"),
        ecriture("2026-01-20", "606000", 500, 0, "Achats"),
      ]);
      expect(avecSolde[0].lignes.some((l) => l.accountCode === "512000")).toBe(false);
    });
  });

  describe("comptes non classés", () => {
    it("les écarte des calculs et les signale", () => {
      const { periodes, comptesNonClasses } = agregerParMois([
        ecriture("2026-01-10", "512000", 1000, 0, "Banque"),
        ecriture("2026-01-10", "706000", 0, 1000, "Prestations"),
        ecriture("2026-01-15", "899000", 300, 0, "Compte d'attente exotique"),
      ]);

      expect(comptesNonClasses).toHaveLength(1);
      expect(comptesNonClasses[0].accountCode).toBe("899000");
      expect(comptesNonClasses[0].mouvement).toBe(300);
      // Le montant n'entre dans aucun agrégat : mieux vaut un trou signalé
      // qu'un chiffre faux.
      expect(periodes[0].lignes.some((l) => l.accountCode === "899000")).toBe(false);
    });
  });

  describe("cas limites", () => {
    it("rend un résultat vide plutôt que d'échouer sur zéro écriture", () => {
      expect(agregerParMois([])).toEqual({ periodes: [], comptesNonClasses: [] });
    });

    it("traite les écritures dans le désordre", () => {
      const { periodes } = agregerParMois([
        ecriture("2026-03-05", "512000", 1000, 0, "Banque"),
        ecriture("2026-01-05", "512000", 2000, 0, "Banque"),
        ecriture("2026-01-05", "101000", 0, 2000, "Capital"),
        ecriture("2026-03-05", "706000", 0, 1000, "Prestations"),
      ]);
      expect(periodes[0].cle).toBe("2026-01");
      expect(periodes[0].agregats.disponibilites).toBe(2000);
      expect(periodes[2].agregats.disponibilites).toBe(3000);
    });

    it("suit un exercice qui chevauche deux années civiles", () => {
      const { periodes } = agregerParMois([
        ecriture("2025-11-05", "512000", 1000, 0, "Banque"),
        ecriture("2025-11-05", "101000", 0, 1000, "Capital"),
        ecriture("2026-01-05", "512000", 500, 0, "Banque"),
        ecriture("2026-01-05", "706000", 0, 500, "Prestations"),
      ]);
      expect(periodes.map((p) => p.cle)).toEqual(["2025-11", "2025-12", "2026-01"]);
      expect(periodes[2].agregats.disponibilites).toBe(1500);
    });
  });
});
