import {
  COOKIE_CSRF,
  COOKIE_SESSION,
  DUREE_SESSION_MS,
  METHODES_SANS_EFFET,
  csrfValide,
  emettreCsrf,
  optionsCsrf,
  optionsSession,
  origineAutorisee,
} from "./session";

describe("cookie de session", () => {
  it("reste hors de portée du JavaScript", () => {
    // La raison d'être du changement : une injection ne doit pas pouvoir
    // lire la session.
    expect(optionsSession(true).httpOnly).toBe(true);
    expect(optionsSession(false).httpOnly).toBe(true);
  });

  it("franchit la frontière de site en production, et seulement chiffré", () => {
    // Le frontend est sur vercel.app, l'API sur up.railway.app : sans
    // SameSite=None le cookie ne serait jamais envoyé. Les navigateurs
    // refusent None sans Secure.
    const prod = optionsSession(true);
    expect(prod.sameSite).toBe("none");
    expect(prod.secure).toBe(true);
  });

  it("reste en Lax et en clair en développement", () => {
    // Sur localhost tout est même site malgré les ports ; Secure
    // empêcherait le cookie de s'installer en HTTP.
    const dev = optionsSession(false);
    expect(dev.sameSite).toBe("lax");
    expect(dev.secure).toBe(false);
  });

  it("expire avec le jeton qu'il transporte", () => {
    expect(optionsSession(true).maxAge).toBe(DUREE_SESSION_MS);
    expect(DUREE_SESSION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("porte un nom distinct de celui du jeton anti-CSRF", () => {
    expect(COOKIE_SESSION).not.toBe(COOKIE_CSRF);
  });
});

describe("cookie anti-CSRF", () => {
  it("est lisible par le JavaScript, sinon il ne sert à rien", () => {
    // Le double envoi suppose que l'application puisse recopier la valeur
    // dans un en-tête.
    expect(optionsCsrf(true).httpOnly).toBe(false);
  });

  it("partage les autres attributs du cookie de session", () => {
    const { httpOnly: _ignore, ...resteCsrf } = optionsCsrf(true);
    const { httpOnly: _autre, ...resteSession } = optionsSession(true);
    expect(resteCsrf).toEqual(resteSession);
  });

  it("émet une valeur imprévisible et longue", () => {
    const a = emettreCsrf();
    const b = emettreCsrf();
    expect(a).not.toBe(b);
    // 32 octets en base64url : 43 caractères, sans remplissage.
    expect(a).toHaveLength(43);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("validation du double envoi", () => {
  const jeton = emettreCsrf();

  it("accepte deux valeurs identiques", () => {
    expect(csrfValide(jeton, jeton)).toBe(true);
  });

  it("refuse une valeur différente de même longueur", () => {
    expect(csrfValide(jeton, emettreCsrf())).toBe(false);
  });

  it("refuse un en-tête absent", () => {
    // Le cas normal d'une falsification : le site tiers ne peut pas lire le
    // cookie, donc il n'envoie pas l'en-tête.
    expect(csrfValide(jeton, undefined)).toBe(false);
    expect(csrfValide(jeton, "")).toBe(false);
  });

  it("refuse un cookie absent", () => {
    expect(csrfValide(undefined, jeton)).toBe(false);
    expect(csrfValide("", "")).toBe(false);
  });

  it("refuse des longueurs différentes sans lever", () => {
    // timingSafeEqual exige des tampons de même taille : comparer sans
    // vérifier d'abord lèverait une exception, donc un 500 au lieu d'un 403.
    expect(() => csrfValide(jeton, jeton.slice(0, 10))).not.toThrow();
    expect(csrfValide(jeton, jeton.slice(0, 10))).toBe(false);
  });

  it("refuse des valeurs non textuelles", () => {
    expect(csrfValide({ a: 1 }, jeton)).toBe(false);
    expect(csrfValide(jeton, ["x"])).toBe(false);
  });
});

describe("contrôle de l'origine", () => {
  const autorisees = ["https://cadran-cyan.vercel.app", "http://localhost:5173"];

  it("accepte une origine de la liste", () => {
    expect(origineAutorisee("https://cadran-cyan.vercel.app", autorisees)).toBe(true);
  });

  it("refuse une origine étrangère", () => {
    expect(origineAutorisee("https://cadran-cyan.vercel.app.attaquant.fr", autorisees)).toBe(false);
    expect(origineAutorisee("https://attaquant.fr", autorisees)).toBe(false);
  });

  it("accepte une requête sans origine", () => {
    // Les clients hors navigateur n'envoient pas cet en-tête, et aucun
    // cookie ne leur est attaché automatiquement.
    expect(origineAutorisee(undefined, autorisees)).toBe(true);
  });
});

describe("méthodes exemptées", () => {
  it("couvre exactement les méthodes sans effet de bord", () => {
    expect([...METHODES_SANS_EFFET].sort()).toEqual(["GET", "HEAD", "OPTIONS"]);
  });

  it("n'exempte aucune méthode modifiante", () => {
    for (const methode of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(METHODES_SANS_EFFET.has(methode)).toBe(false);
    }
  });
});
