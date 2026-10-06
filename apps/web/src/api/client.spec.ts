import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { marquerSessionOuverte, memoriserCsrf, obtenirCsrf, oublierSession, sessionProbable } from "./client";

/*
 * Ce qui est éprouvé ici, c'est la manière dont le client obtient son jeton
 * anti-CSRF.
 *
 * L'ancienne version le lisait dans `document.cookie`. Elle était testée, et
 * les tests passaient : ils vérifiaient l'analyse d'une chaîne de cookies,
 * pas la question qui comptait — ce cookie est-il seulement visible depuis
 * cette origine ? Il ne l'était pas, l'interface et l'API étant sur deux
 * domaines, et toute requête modifiante partait sans en-tête.
 *
 * Les tests portent donc désormais sur le chemin réel : mémoire, stockage de
 * session, puis appel à l'API.
 */

function stockageFactice(): Storage {
  const donnees = new Map<string, string>();
  return {
    getItem: (c) => donnees.get(c) ?? null,
    setItem: (c, v) => void donnees.set(c, v),
    removeItem: (c) => void donnees.delete(c),
    clear: () => donnees.clear(),
    key: () => null,
    get length() {
      return donnees.size;
    },
  } as Storage;
}

/** Un stockage indisponible : navigation privée, stockage désactivé. */
function stockageEnPanne(): Storage {
  const lever = () => {
    throw new DOMException("refusé");
  };
  return { getItem: lever, setItem: lever, removeItem: lever, clear: lever, key: lever, length: 0 } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal("sessionStorage", stockageFactice());
  vi.stubGlobal("localStorage", stockageFactice());
  oublierSession();
});

afterEach(() => vi.unstubAllGlobals());

describe("obtention du jeton anti-CSRF", () => {
  it("rend le jeton mémorisé sans rappeler l'API", async () => {
    const appel = vi.fn();
    vi.stubGlobal("fetch", appel);

    memoriserCsrf("jeton-de-connexion");
    expect(await obtenirCsrf()).toBe("jeton-de-connexion");
    expect(appel).not.toHaveBeenCalled();
  });

  it("le redemande à l'API quand il manque", async () => {
    // Le cas du rechargement de page, ou d'un nouvel onglet : sans ce recours
    // on ne pouvait plus rien modifier jusqu'à la reconnexion.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jetonCsrf: "jeton-du-serveur" }) })
    );

    expect(await obtenirCsrf()).toBe("jeton-du-serveur");
    // Et il est retenu : le second appel ne repart pas sur le réseau.
    const second = vi.fn();
    vi.stubGlobal("fetch", second);
    expect(await obtenirCsrf()).toBe("jeton-du-serveur");
    expect(second).not.toHaveBeenCalled();
  });

  it("le retrouve dans le stockage de session après un rechargement", async () => {
    memoriserCsrf("jeton-persistant");
    // Un rechargement vide la mémoire du module, pas le stockage.
    oublierMemoireSeulement();
    const appel = vi.fn();
    vi.stubGlobal("fetch", appel);

    expect(await obtenirCsrf()).toBe("jeton-persistant");
    expect(appel).not.toHaveBeenCalled();
  });

  it("ne renvoie rien quand l'API refuse, sans lever", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(obtenirCsrf()).resolves.toBeNull();
  });

  it("survit à une panne réseau", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(obtenirCsrf()).resolves.toBeNull();
  });

  it("fonctionne sans stockage disponible", async () => {
    // En navigation privée, lire ou écrire peut lever. L'application doit
    // continuer : le jeton vit alors en mémoire seulement.
    vi.stubGlobal("sessionStorage", stockageEnPanne());
    vi.stubGlobal("localStorage", stockageEnPanne());
    const appel = vi.fn();
    vi.stubGlobal("fetch", appel);

    expect(() => memoriserCsrf("jeton-en-memoire")).not.toThrow();
    expect(await obtenirCsrf()).toBe("jeton-en-memoire");
    expect(appel).not.toHaveBeenCalled();
  });
});

describe("marque de session ouverte", () => {
  it("est posée et retirée explicitement", () => {
    expect(sessionProbable()).toBe(false);
    marquerSessionOuverte();
    expect(sessionProbable()).toBe(true);
    oublierSession();
    expect(sessionProbable()).toBe(false);
  });

  it("ne ment pas quand le stockage est indisponible", () => {
    vi.stubGlobal("localStorage", stockageEnPanne());
    expect(() => marquerSessionOuverte()).not.toThrow();
    // Sans stockage, on ne sait pas : on répond non, et /auth/me tranchera.
    expect(sessionProbable()).toBe(false);
  });
});

/** Simule un rechargement de page : la mémoire du module repart à zéro, le
 *  stockage de session non. */
function oublierMemoireSeulement() {
  const garde = sessionStorage.getItem("cadran_csrf");
  oublierSession();
  if (garde) sessionStorage.setItem("cadran_csrf", garde);
}
