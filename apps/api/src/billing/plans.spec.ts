import {
  PLANS,
  PLANS_PUBLICS,
  PLAN_IDS,
  PLAN_PAR_DEFAUT,
  accesOuvert,
  planApplicable,
  demandeAction,
  estPlanConnu,
  verifierQuota,
} from "./plans";

describe("catalogue des formules", () => {
  it("n'expose aucun montant : les prix vivent dans Stripe", () => {
    const serialise = JSON.stringify(PLANS);
    // Ce qu'on interdit, c'est un *montant* — pas le mot « price », qui est
    // légitime dans un nom de variable d'environnement. Un montant écrit ici
    // finirait par diverger de celui réellement factué par Stripe, et c'est
    // le client qui le découvrirait sur son relevé.
    expect(serialise).not.toMatch(/€|\bEUR\b/);
    expect(serialise).not.toMatch(/"(prix|montant|amount|price|tarif)"\s*:\s*\d/i);

    PLAN_IDS.forEach((id) => {
      const tarif = PLANS[id].variableTarif;
      // On ne garde qu'un nom de variable d'environnement, jamais sa valeur.
      if (tarif !== null) expect(tarif).toMatch(/^STRIPE_PRICE_[A-Z]+$/);
    });
  });

  it("n'attache aucun tarif à l'essai, qui ne passe par aucun paiement", () => {
    expect(PLANS.essai.variableTarif).toBeNull();
    expect(PLAN_PAR_DEFAUT).toBe("essai");
  });

  it("ouvre la consolidation seulement aux formules à plusieurs entités", () => {
    PLAN_IDS.forEach((id) => {
      const { quotas } = PLANS[id];
      if (quotas.consolidation) {
        // Consolider une entité unique n'a pas de sens : ce serait vendre
        // une fonction qui ne peut rien produire.
        expect(quotas.entites === null || quotas.entites > 1).toBe(true);
      }
    });
  });

  it("reconnaît les formules du catalogue et rejette les autres", () => {
    expect(estPlanConnu("cabinet")).toBe(true);
    expect(estPlanConnu("entreprise")).toBe(false);
  });
});

describe("accès selon le statut", () => {
  it("laisse l'accès ouvert pendant la relance d'un impayé", () => {
    // Couper au premier échec de carte punit un client solvable.
    expect(accesOuvert("impaye")).toBe(true);
    expect(demandeAction("impaye")).toBe(true);
  });

  it("ferme l'accès une fois l'abonnement résilié", () => {
    expect(accesOuvert("resilie")).toBe(false);
  });

  it("ouvre l'accès pendant l'essai et l'abonnement actif", () => {
    expect(accesOuvert("essai")).toBe(true);
    expect(accesOuvert("actif")).toBe(true);
    expect(demandeAction("actif")).toBe(false);
  });
});

describe("verifierQuota", () => {
  it("laisse passer tant que la limite n'est pas atteinte", () => {
    expect(verifierQuota(PLANS.cabinet, "entites", 14)).toBeNull();
  });

  it("bloque à la limite, et non une création au-delà", () => {
    // Le quota compte ce qui existe déjà : à 15 entités sur 15, la
    // quinzième existe, donc la seizième est refusée.
    const depassement = verifierQuota(PLANS.cabinet, "entites", 15);
    expect(depassement).toEqual({
      quota: "entites",
      libelle: "entités",
      limite: 15,
      actuel: 15,
    });
  });

  it("accorde le libellé au nombre", () => {
    // « La formule permet 1 entités » fait douter du reste, et on parle ici
    // de facturation.
    expect(verifierQuota(PLANS.essai, "entites", 1)?.libelle).toBe("entité");
    expect(verifierQuota(PLANS.solo, "utilisateurs", 2)?.libelle).toBe("utilisateurs");
    expect(verifierQuota(PLANS.essai, "periodes", 12)?.libelle).toBe("périodes par entité");
  });

  it("ne limite rien quand la formule est sans limite", () => {
    expect(verifierQuota(PLANS.groupe, "entites", 4000)).toBeNull();
    expect(verifierQuota(PLANS.groupe, "utilisateurs", 900)).toBeNull();
  });

  it("nomme la limite atteinte plutôt que de renvoyer un simple refus", () => {
    const depassement = verifierQuota(PLANS.solo, "utilisateurs", 2);
    // Sans le libellé et les chiffres, le message se réduirait à
    // « formule insuffisante », qui n'aide ni à décider ni à acheter.
    expect(depassement?.libelle).toBe("utilisateurs");
    expect(depassement?.limite).toBe(2);
  });
});

describe("formule interne et droits de l'administrateur de plateforme", () => {
  it("ne propose pas la formule interne au catalogue public", () => {
    // Elle ne se vend pas : l'afficher sur la page de tarifs promettrait un
    // accès illimité que personne ne peut souscrire.
    expect(PLANS_PUBLICS).not.toContain("interne");
    expect(PLANS_PUBLICS).toEqual(["essai", "solo", "cabinet", "groupe"]);
  });

  it("ne borne ni les entités, ni les utilisateurs, ni les périodes en interne", () => {
    const quotas = PLANS.interne.quotas;
    expect(quotas.entites).toBeNull();
    expect(quotas.utilisateurs).toBeNull();
    expect(quotas.periodes).toBeNull();
    expect(verifierQuota(PLANS.interne, "entites", 10_000)).toBeNull();
  });

  it("inclut toutes les fonctions en interne", () => {
    expect(PLANS.interne.quotas.consolidation).toBe(true);
    expect(PLANS.interne.quotas.fec).toBe(true);
    expect(PLANS.interne.quotas.marqueDocuments).toBe(true);
  });

  it("n'attache aucun tarif Stripe à la formule interne", () => {
    // Un tarif la rendrait souscriptible, donc vendable par accident.
    expect(PLANS.interne.variableTarif).toBeNull();
  });

  it("garde l'accès ouvert en interne, quel que soit le statut", () => {
    /*
     * Aucun événement Stripe ne traverse la formule interne : un statut
     * « resilie » ne peut y venir que d'une anomalie, et il fermerait l'accès
     * de la seule personne capable de le rouvrir.
     */
    expect(accesOuvert("resilie", "interne")).toBe(true);
    expect(accesOuvert("resilie", "solo")).toBe(false);
    expect(accesOuvert("resilie")).toBe(false);
  });
});

describe("planApplicable", () => {
  it("laisse la formule intacte pour un utilisateur ordinaire", () => {
    expect(planApplicable("solo", false)).toEqual(PLANS.solo);
  });

  it("délie les fonctions pour un administrateur chez un client", () => {
    // Consulter une consolidation ou importer un FEC pour reproduire un bogue
    // ne laisse rien derrière soi : le refuser n'empêche que le dépannage.
    const applicable = planApplicable("solo", true);
    expect(PLANS.solo.quotas.consolidation).toBe(false);
    expect(applicable.quotas.consolidation).toBe(true);
    expect(applicable.quotas.marqueDocuments).toBe(true);
    expect(applicable.quotas.questionsConseil).toBeGreaterThan(
      PLANS.solo.quotas.questionsConseil
    );
  });

  it("ne délie PAS les stocks du client", () => {
    /*
     * La règle qui compte. Une entité créée en accès support survit au départ
     * de l'administrateur : le client en formule Indépendant se retrouverait
     * à deux entités là où il en a droit à une, verrait un dépassement qu'il
     * n'a pas provoqué, et sa prochaine création lui serait refusée sans
     * explication. Pour créer au-delà, on change d'abord sa formule — un
     * geste visible, qui laisse une trace.
     */
    const applicable = planApplicable("solo", true);
    expect(applicable.quotas.entites).toBe(1);
    expect(applicable.quotas.utilisateurs).toBe(2);
    expect(verifierQuota(applicable, "entites", 1)).not.toBeNull();
  });

  it("ne diminue jamais un quota en déliant", () => {
    // Groupe accorde plus de questions que le plancher administrateur : le
    // délier ne doit pas le rabaisser.
    const groupe = planApplicable("groupe", true);
    expect(groupe.quotas.questionsConseil).toBeGreaterThanOrEqual(
      PLANS.groupe.quotas.questionsConseil
    );
  });
});
