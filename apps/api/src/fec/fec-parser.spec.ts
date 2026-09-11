import { fecEstEquilibre, lireDate, lireMontant, parseFec } from "./fec-parser";

const EN_TETE =
  "JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|" +
  "PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise";

/** Deux écritures équilibrées : une vente de 1 200 encaissée sur un client. */
const FICHIER_MINIMAL = [
  EN_TETE,
  "VTE|Ventes|VT001|20260115|411000|Clients|C001|Dupont SA|F2026-001|20260115|Facture 001|1200,00|0,00|AA|20260220|20260115||",
  "VTE|Ventes|VT001|20260115|706000|Prestations de services|||F2026-001|20260115|Facture 001|0,00|1200,00|||20260115||",
].join("\n");

describe("parseur FEC", () => {
  describe("lecture des montants", () => {
    it("lit la virgule décimale", () => {
      expect(lireMontant("1200,50")).toBe(1200.5);
    });

    it("ignore les espaces de séparation des milliers, insécables compris", () => {
      expect(lireMontant("1 200,50")).toBe(1200.5);
      expect(lireMontant("1 200,50")).toBe(1200.5);
    });

    it("traite une cellule vide comme un zéro", () => {
      expect(lireMontant("")).toBe(0);
      expect(lireMontant("   ")).toBe(0);
    });

    it("signale un montant illisible plutôt que de renvoyer NaN", () => {
      expect(lireMontant("mille")).toBeNull();
    });
  });

  describe("lecture des dates", () => {
    it("lit le format AAAAMMJJ en UTC", () => {
      const date = lireDate("20260115");
      expect(date?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    });

    it("refuse une date qui déborde de son mois", () => {
      // Sans contrôle, le 31 février deviendrait silencieusement le 3 mars.
      expect(lireDate("20260231")).toBeNull();
    });

    it("refuse un format non conforme", () => {
      expect(lireDate("15/01/2026")).toBeNull();
      expect(lireDate("")).toBeNull();
    });
  });

  describe("fichier conforme", () => {
    const resultat = parseFec(FICHIER_MINIMAL);

    it("lit toutes les écritures", () => {
      expect(resultat.erreurs).toEqual([]);
      expect(resultat.ecritures).toHaveLength(2);
    });

    it("détecte le séparateur pipe", () => {
      expect(resultat.separateur).toBe("|");
    });

    it("conserve le tiers et le lettrage, qui sont la matière de la balance âgée", () => {
      const ligneClient = resultat.ecritures[0];
      expect(ligneClient.auxAccountCode).toBe("C001");
      expect(ligneClient.auxAccountLabel).toBe("Dupont SA");
      expect(ligneClient.lettering).toBe("AA");
      expect(ligneClient.letteringDate?.toISOString()).toBe("2026-02-20T00:00:00.000Z");
    });

    it("laisse à null les colonnes facultatives vides plutôt qu'une chaîne vide", () => {
      const ligneProduit = resultat.ecritures[1];
      expect(ligneProduit.auxAccountCode).toBeNull();
      expect(ligneProduit.lettering).toBeNull();
      expect(ligneProduit.letteringDate).toBeNull();
    });

    it("totalise et constate l'équilibre", () => {
      expect(resultat.totalDebit).toBe(1200);
      expect(resultat.totalCredit).toBe(1200);
      expect(resultat.ecart).toBe(0);
      expect(fecEstEquilibre(resultat)).toBe(true);
    });

    it("déduit l'exercice de la dernière date d'écriture", () => {
      expect(resultat.exercice).toBe(2026);
      expect(resultat.debutExercice?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
      expect(resultat.finExercice?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    });
  });

  describe("tolérance de format", () => {
    it("accepte la tabulation comme séparateur", () => {
      const tabule = FICHIER_MINIMAL.split("|").join("\t");
      const resultat = parseFec(tabule);
      expect(resultat.separateur).toBe("\t");
      expect(resultat.ecritures).toHaveLength(2);
    });

    it("accepte le point-virgule, utilisé par certains exports", () => {
      const resultat = parseFec(FICHIER_MINIMAL.split("|").join(";"));
      expect(resultat.separateur).toBe(";");
      expect(resultat.ecritures).toHaveLength(2);
    });

    it("accepte un ordre de colonnes différent de celui de l'arrêté", () => {
      const enTeteInverse =
        "EcritureDate|JournalCode|JournalLib|EcritureNum|CompteNum|CompteLib|CompAuxNum|CompAuxLib|" +
        "PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise";
      const contenu = [
        enTeteInverse,
        "20260115|VTE|Ventes|VT001|706000|Prestations|||F1|20260115|Facture|0,00|1200,00|||20260115||",
      ].join("\n");
      const resultat = parseFec(contenu);
      expect(resultat.erreurs).toEqual([]);
      expect(resultat.ecritures[0].accountCode).toBe("706000");
      expect(resultat.ecritures[0].credit).toBe(1200);
    });

    it("accepte la variante Montant + Sens et la ramène en débit/crédit", () => {
      const enTete =
        "JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|" +
        "PieceRef|PieceDate|EcritureLib|Montant|Sens|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise";
      const contenu = [
        enTete,
        "VTE|Ventes|1|20260115|411000|Clients|||F1|20260115|Facture|1200,00|D|||20260115||",
        "VTE|Ventes|1|20260115|706000|Prestations|||F1|20260115|Facture|1200,00|C|||20260115||",
      ].join("\n");
      const resultat = parseFec(contenu);
      expect(resultat.erreurs).toEqual([]);
      expect(resultat.ecritures[0].debit).toBe(1200);
      expect(resultat.ecritures[0].credit).toBe(0);
      expect(resultat.ecritures[1].credit).toBe(1200);
      expect(resultat.ecart).toBe(0);
    });

    it("tolère un BOM, les accents et la casse dans l'en-tête", () => {
      const contenu = ["﻿" + EN_TETE.toUpperCase(), FICHIER_MINIMAL.split("\n")[1]].join("\n");
      const resultat = parseFec(contenu);
      expect(resultat.ecritures).toHaveLength(1);
    });

    it("ignore les lignes vides", () => {
      const contenu = FICHIER_MINIMAL.split("\n").join("\n\n") + "\n\n";
      expect(parseFec(contenu).ecritures).toHaveLength(2);
    });

    it("accepte les fins de ligne Windows", () => {
      expect(parseFec(FICHIER_MINIMAL.split("\n").join("\r\n")).ecritures).toHaveLength(2);
    });
  });

  describe("signalement des anomalies", () => {
    it("rejette un en-tête incomplet en nommant les colonnes absentes", () => {
      const resultat = parseFec("JournalCode|EcritureDate|CompteNum|Debit|Credit\nVTE|20260115|706|0,00|10,00");
      expect(resultat.ecritures).toHaveLength(0);
      expect(resultat.erreurs[0].message).toContain("JournalLib");
      expect(resultat.erreurs[0].message).toContain("18");
    });

    it("écarte la ligne fautive et poursuit la lecture du fichier", () => {
      const contenu = [
        EN_TETE,
        "VTE|Ventes|1|PAS_UNE_DATE|706000|Prestations|||F1|20260115|Facture|0,00|1200,00|||20260115||",
        FICHIER_MINIMAL.split("\n")[2],
      ].join("\n");
      const resultat = parseFec(contenu);
      expect(resultat.ecritures).toHaveLength(1);
      expect(resultat.erreurs).toHaveLength(1);
      expect(resultat.erreurs[0].ligne).toBe(2);
      expect(resultat.erreurs[0].message).toContain("AAAAMMJJ");
    });

    it("signale une ligne sans numéro de compte", () => {
      const contenu = [
        EN_TETE,
        "VTE|Ventes|1|20260115||Sans compte|||F1|20260115|Facture|0,00|1200,00|||20260115||",
      ].join("\n");
      expect(parseFec(contenu).erreurs[0].message).toContain("Numéro de compte");
    });

    it("constate le déséquilibre d'un fichier tronqué", () => {
      const contenu = [EN_TETE, FICHIER_MINIMAL.split("\n")[1]].join("\n");
      const resultat = parseFec(contenu);
      expect(resultat.ecart).toBe(1200);
      expect(fecEstEquilibre(resultat)).toBe(false);
    });

    it("rend un résultat exploitable sur un fichier vide", () => {
      const resultat = parseFec("");
      expect(resultat.ecritures).toEqual([]);
      expect(resultat.erreurs[0].message).toContain("vide");
    });
  });
});
