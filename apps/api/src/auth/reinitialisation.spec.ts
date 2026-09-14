import {
  VALIDITE_JETON_MS,
  emettreJeton,
  empreinteDe,
  empreintesEgales,
  verifierJeton,
} from "./reinitialisation";

describe("emettreJeton", () => {
  it("ne renvoie jamais deux fois le même jeton", () => {
    const jetons = new Set(Array.from({ length: 200 }, () => emettreJeton().jetonClair));
    expect(jetons.size).toBe(200);
  });

  it("sépare le jeton envoyé de l'empreinte conservée", () => {
    const { jetonClair, empreinte } = emettreJeton();
    // Le point central : la base ne doit jamais contenir le jeton lui-même,
    // sinon une fuite de la table donne l'accès à tous les comptes.
    expect(empreinte).not.toBe(jetonClair);
    expect(empreinte).toHaveLength(64);
    expect(empreinte).toBe(empreinteDe(jetonClair));
  });

  it("produit un jeton transportable dans une URL", () => {
    // base64url : pas de +, / ni = à réencoder, donc pas de jeton cassé par
    // un client de messagerie qui reformate le lien.
    expect(emettreJeton().jetonClair).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("expire une heure après l'émission", () => {
    const maintenant = new Date("2026-09-14T10:00:00Z");
    const { expireLe } = emettreJeton(maintenant);
    expect(expireLe.getTime() - maintenant.getTime()).toBe(VALIDITE_JETON_MS);
  });
});

describe("empreintesEgales", () => {
  it("reconnaît deux empreintes identiques", () => {
    const e = empreinteDe("abc");
    expect(empreintesEgales(e, e)).toBe(true);
  });

  it("rejette des empreintes différentes, et des longueurs différentes", () => {
    expect(empreintesEgales(empreinteDe("abc"), empreinteDe("abd"))).toBe(false);
    // timingSafeEqual lève sur des longueurs inégales : on retourne false
    // plutôt que de laisser l'exception remonter.
    expect(empreintesEgales("court", empreinteDe("abc"))).toBe(false);
  });
});

describe("verifierJeton", () => {
  const maintenant = new Date("2026-09-14T12:00:00Z");
  const emis = emettreJeton(maintenant);
  const enBase = { empreinte: emis.empreinte, expireLe: emis.expireLe, utiliseLe: null };

  it("accepte un jeton valide", () => {
    expect(verifierJeton(emis.jetonClair, enBase, maintenant)).toEqual({ valide: true });
  });

  it("refuse un jeton absent de la base", () => {
    expect(verifierJeton(emis.jetonClair, null, maintenant)).toEqual({
      valide: false,
      motif: "introuvable",
    });
  });

  it("refuse un jeton qui ne correspond pas à l'empreinte", () => {
    const autre = emettreJeton(maintenant);
    expect(verifierJeton(autre.jetonClair, enBase, maintenant)).toEqual({
      valide: false,
      motif: "introuvable",
    });
  });

  it("refuse un jeton déjà utilisé", () => {
    // Sans cela, un lien intercepté resterait valable après le changement de
    // mot de passe légitime.
    const utilise = { ...enBase, utiliseLe: new Date("2026-09-14T12:10:00Z") };
    expect(verifierJeton(emis.jetonClair, utilise, maintenant)).toEqual({
      valide: false,
      motif: "deja-utilise",
    });
  });

  it("refuse un jeton expiré, y compris à la seconde exacte", () => {
    const apres = new Date(emis.expireLe.getTime());
    expect(verifierJeton(emis.jetonClair, enBase, apres)).toEqual({
      valide: false,
      motif: "expire",
    });
    const bienApres = new Date(emis.expireLe.getTime() + 1000);
    expect(verifierJeton(emis.jetonClair, enBase, bienApres)).toEqual({
      valide: false,
      motif: "expire",
    });
  });

  it("reste valide juste avant l'expiration", () => {
    const juste = new Date(emis.expireLe.getTime() - 1);
    expect(verifierJeton(emis.jetonClair, enBase, juste)).toEqual({ valide: true });
  });
});
