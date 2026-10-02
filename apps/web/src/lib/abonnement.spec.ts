import { describe, expect, it } from "vitest";
import {
  type EtatAbonnement,
  joursRestants,
  libelleBouton,
  lireStatut,
  partUtilisee,
  quotaAtteint,
  resiliationPossible,
  sensChangement,
} from "./abonnement";

const MAINTENANT = new Date("2026-10-02T12:00:00Z");

function etat(modifications: Partial<EtatAbonnement> = {}): EtatAbonnement {
  return {
    plan: {
      id: "solo",
      label: "Indépendant",
      promesse: "…",
      quotas: { entites: 1, utilisateurs: 2, periodes: null, consolidation: false, fec: true },
    },
    statut: "actif",
    accesOuvert: true,
    demandeAction: false,
    finPeriode: "2026-11-02T12:00:00Z",
    resiliationDemandee: false,
    paiementDisponible: true,
    consommation: { entites: 1, utilisateurs: 1 },
    ...modifications,
  };
}

describe("jours restants", () => {
  it("arrondit au supérieur", () => {
    // Six heures restantes, c'est encore « 1 jour » : annoncer 0 ferait
    // croire à une perte d'accès déjà survenue.
    expect(joursRestants("2026-10-02T18:00:00Z", MAINTENANT)).toBe(1);
  });

  it("rend un nombre négatif ou nul pour une échéance passée", () => {
    expect(joursRestants("2026-10-01T12:00:00Z", MAINTENANT)).toBe(-1);
    expect(joursRestants("2026-10-02T12:00:00Z", MAINTENANT)).toBe(0);
  });

  it("rend null sans date, et sur une date illisible", () => {
    expect(joursRestants(null, MAINTENANT)).toBeNull();
    expect(joursRestants("pas une date", MAINTENANT)).toBeNull();
  });
});

describe("lecture du statut", () => {
  it("fait passer l'impayé avant tout le reste", () => {
    // Seul cas où l'accès est encore ouvert mais va se fermer, et où un
    // geste de l'utilisateur l'empêche.
    const lu = lireStatut(etat({ statut: "impaye", demandeAction: true }), MAINTENANT);
    expect(lu.ton).toBe("attention");
    expect(lu.titre).toBe("Paiement en échec");
    expect(lu.action).toBe("Mettre à jour le moyen de paiement");
  });

  it("rassure sur l'accès pendant un impayé", () => {
    // L'accès reste ouvert : le dire évite une panique inutile.
    expect(lireStatut(etat({ statut: "impaye" }), MAINTENANT).explication).toMatch(/reste ouvert/);
  });

  it("alerte sur un essai qui touche à sa fin", () => {
    const lu = lireStatut(
      etat({ statut: "essai", finPeriode: "2026-10-04T12:00:00Z" }),
      MAINTENANT,
    );
    expect(lu.ton).toBe("attention");
    expect(lu.titre).toBe("Essai — 2 jours restants");
  });

  it("reste neutre sur un essai qui a le temps", () => {
    const lu = lireStatut(
      etat({ statut: "essai", finPeriode: "2026-10-12T12:00:00Z" }),
      MAINTENANT,
    );
    expect(lu.ton).toBe("neutre");
    expect(lu.titre).toBe("Essai — 10 jours restants");
  });

  it("accorde le singulier au dernier jour", () => {
    const lu = lireStatut(
      etat({ statut: "essai", finPeriode: "2026-10-03T12:00:00Z" }),
      MAINTENANT,
    );
    expect(lu.titre).toBe("Essai — 1 jour restant");
  });

  it("promet qu'aucun prélèvement ne suivra l'essai", () => {
    // C'est l'engagement des conditions générales : l'essai ne bascule pas
    // en abonnement payant. L'écran doit le redire.
    expect(lireStatut(etat({ statut: "essai" }), MAINTENANT).explication).toMatch(
      /[Aa]ucun paiement ne sera prélevé/,
    );
  });

  it("traite un essai expiré comme critique, sans menacer les données", () => {
    const lu = lireStatut(
      etat({ statut: "essai", finPeriode: "2026-09-20T12:00:00Z" }),
      MAINTENANT,
    );
    expect(lu.ton).toBe("critique");
    expect(lu.explication).toMatch(/données sont conservées/);
  });

  it("distingue une résiliation enregistrée d'un abonnement actif", () => {
    const resilie = lireStatut(etat({ resiliationDemandee: true }), MAINTENANT);
    expect(resilie.ton).toBe("attention");
    expect(resilie.titre).toBe("Résiliation enregistrée");
    expect(resilie.action).toBe("Annuler la résiliation");

    const actif = lireStatut(etat(), MAINTENANT);
    expect(actif.ton).toBe("neutre");
    expect(actif.titre).toBe("Abonnement actif");
    expect(actif.action).toBeNull();
  });

  it("donne la date d'échéance en toutes lettres", () => {
    expect(lireStatut(etat(), MAINTENANT).explication).toContain("2 novembre 2026");
  });
});

describe("quotas", () => {
  it("rend null pour une formule illimitée", () => {
    // Et non 0 : une jauge vide laisserait croire à une limite lointaine.
    expect(partUtilisee(12, null)).toBeNull();
    expect(quotaAtteint(9999, null)).toBe(false);
  });

  it("plafonne la part à 1 même en cas de dépassement", () => {
    // Un dépassement peut exister après une rétrogradation de formule.
    expect(partUtilisee(3, 1)).toBe(1);
  });

  it("reconnaît un quota atteint", () => {
    expect(quotaAtteint(1, 1)).toBe(true);
    expect(quotaAtteint(0, 1)).toBe(false);
  });
});

describe("sens du changement de formule", () => {
  it("ordonne les formules", () => {
    expect(sensChangement("solo", "cabinet")).toBe("superieure");
    expect(sensChangement("cabinet", "solo")).toBe("inferieure");
    expect(sensChangement("groupe", "groupe")).toBe("actuelle");
  });
});

describe("libellé du bouton", () => {
  it("n'offre jamais de souscrire à l'essai", () => {
    expect(libelleBouton(etat(), "essai", MAINTENANT)).toEqual({
      texte: "Accordé à l'inscription",
      actif: false,
    });
  });

  it("désactive la formule en cours", () => {
    expect(libelleBouton(etat(), "solo", MAINTENANT).actif).toBe(false);
  });

  it("dit « choisir » et non « passer à » depuis un essai", () => {
    // « Passer à » suppose qu'on paie déjà quelque chose.
    const depuisEssai = etat({ statut: "essai", plan: { ...etat().plan, id: "essai" } });
    expect(libelleBouton(depuisEssai, "cabinet", MAINTENANT).texte).toBe("Choisir cette formule");
  });

  it("dit « choisir » après une résiliation", () => {
    const resilie = etat({ statut: "resilie" });
    expect(libelleBouton(resilie, "cabinet", MAINTENANT).texte).toBe("Choisir cette formule");
  });

  it("distingue montée et descente sur un abonnement actif", () => {
    expect(libelleBouton(etat(), "cabinet", MAINTENANT).texte).toBe("Passer à cette formule");
    const depuisGroupe = etat({ plan: { ...etat().plan, id: "groupe" } });
    expect(libelleBouton(depuisGroupe, "solo", MAINTENANT).texte).toBe(
      "Revenir à cette formule",
    );
  });
});

describe("résiliation en ligne", () => {
  it("est possible sur un abonnement actif et payant", () => {
    // C'est l'obligation de l'article L. 215-1-1, reprise dans les CGV.
    expect(resiliationPossible(etat()).possible).toBe(true);
  });

  it("explique qu'un essai n'a rien à résilier", () => {
    const motif = resiliationPossible(etat({ statut: "essai" })).motif;
    expect(motif).toMatch(/essai/);
    expect(motif).toMatch(/[Aa]ucun prélèvement/);
  });

  it("ne la propose pas deux fois", () => {
    expect(resiliationPossible(etat({ resiliationDemandee: true })).possible).toBe(false);
    expect(resiliationPossible(etat({ statut: "resilie" })).possible).toBe(false);
  });

  it("donne une voie de repli quand le paiement est indisponible", () => {
    // Une promesse contractuelle dont l'interface ne dit rien est un
    // manquement : si le bouton ne peut pas marcher, il faut un autre
    // chemin, et un délai annoncé.
    const repli = resiliationPossible(etat({ paiementDisponible: false }));
    expect(repli.possible).toBe(false);
    expect(repli.motif).toMatch(/Écrivez-nous/);
    expect(repli.motif).toMatch(/48 heures/);
  });
});
