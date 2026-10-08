import { MOIS_AVANT_DONNEES_ANCIENNES, evaluerDossier, moisEntre, type FaitsDossier } from "./etat";

const SAIN: FaitsDossier = {
  aDesDonnees: true,
  periodesImportees: 4,
  capitauxPropres: 400_000,
  tresorerieNette: 90_000,
  resultatNet: 35_000,
  alertesOuvertes: 0,
  actionsEnRetard: 0,
  moisDepuisDernieresDonnees: 2,
};

describe("état d'un dossier dans le portefeuille", () => {
  it("déclare sain un dossier sans aucun motif", () => {
    expect(evaluerDossier(SAIN)).toEqual({ etat: "sain", motifs: [] });
  });

  it("dit qu'un dossier n'a pas de données plutôt que de le déclarer sain", () => {
    // Un dossier vide n'a aucun motif d'inquiétude — et aucune raison d'être
    // rassurant. Le confondre avec un dossier sain masquerait un oubli d'import.
    const evaluation = evaluerDossier({ ...SAIN, aDesDonnees: false, periodesImportees: 0 });
    expect(evaluation).toEqual({ etat: "incomplet", motifs: ["Aucune donnée importée"] });
  });

  it("distingue un dossier vide d'un dossier sans exercice complet", () => {
    // Deux trimestres importés : il ne manque pas un import, il manque du temps.
    const evaluation = evaluerDossier({ ...SAIN, aDesDonnees: false, periodesImportees: 2 });
    expect(evaluation.motifs).toEqual(["Pas encore d'exercice complet — 2 périodes importées"]);
  });

  describe("critique", () => {
    it("pour des capitaux propres négatifs", () => {
      const evaluation = evaluerDossier({ ...SAIN, capitauxPropres: -5_000 });
      expect(evaluation.etat).toBe("critique");
      expect(evaluation.motifs).toEqual(["Capitaux propres négatifs"]);
    });

    it("pour une trésorerie nette négative", () => {
      expect(evaluerDossier({ ...SAIN, tresorerieNette: -1 }).etat).toBe("critique");
    });

    it("garde les motifs secondaires, après les critiques", () => {
      // Le collaborateur doit voir d'abord ce qui menace la continuité, mais
      // aussi le reste : il ouvrira le dossier une fois, pas deux.
      const evaluation = evaluerDossier({
        ...SAIN,
        tresorerieNette: -20_000,
        resultatNet: -12_000,
        alertesOuvertes: 2,
      });
      expect(evaluation.motifs).toEqual([
        "Trésorerie nette négative",
        "Dernier exercice déficitaire",
        "2 alertes non traitées",
      ]);
    });
  });

  describe("à surveiller", () => {
    it("pour une perte, qui n'est pas à elle seule une menace", () => {
      const evaluation = evaluerDossier({ ...SAIN, resultatNet: -1_000 });
      expect(evaluation.etat).toBe("a_surveiller");
    });

    it("accorde les motifs au nombre", () => {
      expect(evaluerDossier({ ...SAIN, alertesOuvertes: 1 }).motifs).toEqual([
        "1 alerte non traitée",
      ]);
      expect(evaluerDossier({ ...SAIN, actionsEnRetard: 3 }).motifs).toEqual([
        "3 actions en retard",
      ]);
    });

    it("signale des données trop anciennes pour dire la situation présente", () => {
      const evaluation = evaluerDossier({
        ...SAIN,
        moisDepuisDernieresDonnees: MOIS_AVANT_DONNEES_ANCIENNES + 1,
      });
      expect(evaluation.etat).toBe("a_surveiller");
      expect(evaluation.motifs[0]).toContain("14 mois");
    });

    it("laisse sain un dossier dont les comptes annuels arrivent dans les délais", () => {
      // Douze mois après la clôture, les comptes de l'année suivante ne sont
      // pas encore là : c'est normal, pas inquiétant.
      expect(evaluerDossier({ ...SAIN, moisDepuisDernieresDonnees: 12 }).etat).toBe("sain");
    });
  });

  it("ne tire rien d'une donnée absente", () => {
    // Une valeur inconnue n'est ni bonne ni mauvaise : elle ne produit aucun
    // motif, plutôt qu'un faux « critique ».
    expect(
      evaluerDossier({
        ...SAIN,
        capitauxPropres: null,
        tresorerieNette: null,
        resultatNet: null,
        moisDepuisDernieresDonnees: null,
      }).etat,
    ).toBe("sain");
  });
});

describe("mois écoulés", () => {
  it("compte les mois entiers", () => {
    expect(moisEntre(new Date("2025-12-31"), new Date("2026-10-08"))).toBe(9);
    expect(moisEntre(new Date("2026-01-15"), new Date("2026-03-14"))).toBe(1);
    expect(moisEntre(new Date("2026-01-15"), new Date("2026-03-15"))).toBe(2);
  });

  it("ne devient jamais négatif", () => {
    expect(moisEntre(new Date("2026-10-08"), new Date("2026-01-01"))).toBe(0);
  });
});
