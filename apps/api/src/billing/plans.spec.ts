import {
  PLANS,
  PLAN_IDS,
  PLAN_PAR_DEFAUT,
  accesOuvert,
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
