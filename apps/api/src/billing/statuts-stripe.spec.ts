import { estEvenementSuivi, planDepuisTarif, statutDepuisStripe } from "./statuts-stripe";

describe("statutDepuisStripe", () => {
  it("garde l'accès ouvert sur un impayé, pendant les relances", () => {
    // Le point central : une carte expirée ne doit pas couper l'accès d'un
    // client solvable au premier échec.
    expect(statutDepuisStripe("past_due")).toBe("impaye");
    expect(statutDepuisStripe("unpaid")).toBe("impaye");
  });

  it("distingue l'impayé du premier paiement jamais abouti", () => {
    // `incomplete` n'a jamais rien payé : il n'y a pas de confiance acquise.
    expect(statutDepuisStripe("incomplete")).toBe("incomplet");
  });

  it("ferme l'accès sur une résiliation ou un essai jamais confirmé", () => {
    expect(statutDepuisStripe("canceled")).toBe("resilie");
    expect(statutDepuisStripe("incomplete_expired")).toBe("resilie");
  });

  it("traduit l'essai et l'abonnement actif", () => {
    expect(statutDepuisStripe("trialing")).toBe("essai");
    expect(statutDepuisStripe("active")).toBe("actif");
  });

  it("ferme la porte sur un état inconnu plutôt que de l'ouvrir", () => {
    // Stripe peut ajouter un état ; mieux vaut un faux blocage réparable
    // qu'un accès accordé par défaut.
    expect(statutDepuisStripe("paused")).toBe("incomplet");
    expect(statutDepuisStripe("")).toBe("incomplet");
  });
});

describe("planDepuisTarif", () => {
  const env = {
    STRIPE_PRICE_SOLO: "price_test_solo",
    STRIPE_PRICE_CABINET: "price_test_cabinet",
    STRIPE_PRICE_GROUPE: "price_test_groupe",
  };

  it("retrouve la formule facturée", () => {
    expect(planDepuisTarif("price_test_cabinet", env)).toBe("cabinet");
    expect(planDepuisTarif("price_test_groupe", env)).toBe("groupe");
  });

  it("ne devine rien sur un tarif inconnu", () => {
    // Un tarif créé à la main dans Stripe ne doit pas être rattaché au
    // hasard à une formule : mieux vaut null, que l'appelant devra traiter.
    expect(planDepuisTarif("price_inconnu", env)).toBeNull();
    expect(planDepuisTarif(null, env)).toBeNull();
    expect(planDepuisTarif(undefined, env)).toBeNull();
  });

  it("ne confond pas deux environnements", () => {
    // Les identifiants diffèrent entre test et production : un tarif de test
    // ne doit rien valoir face à un environnement de production.
    const prod = { STRIPE_PRICE_SOLO: "price_live_solo" };
    expect(planDepuisTarif("price_test_solo", prod)).toBeNull();
  });
});

describe("EVENEMENTS_SUIVIS", () => {
  it("retient la fin de paiement, qui est le seul moment où l'accès s'accorde", () => {
    expect(estEvenementSuivi("checkout.session.completed")).toBe(true);
  });

  it("retient l'échec de prélèvement, qui déclenche la relance", () => {
    expect(estEvenementSuivi("invoice.payment_failed")).toBe(true);
  });

  it("ignore le reste", () => {
    // Stripe émet plus de deux cents événements : s'abonner largement noie
    // les quelques-uns qui portent un vrai changement d'état.
    expect(estEvenementSuivi("customer.created")).toBe(false);
    expect(estEvenementSuivi("charge.succeeded")).toBe(false);
  });
});
