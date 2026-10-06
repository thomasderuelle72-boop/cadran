import { summarizePayload } from "./audit.service";
import { premiereValeur } from "./audit.interceptor";

describe("résumé des corps de requête pour la piste d'audit", () => {
  it("n'écrit jamais un secret dans le journal", () => {
    const summary = summarizePayload({
      email: "camille@exemple.fr",
      password: "SuperSecret123!",
      passwordHash: "$2a$10$abc",
      accessToken: "eyJhbGci",
    }) as Record<string, unknown>;

    expect(summary.email).toBe("camille@exemple.fr");
    expect(summary).not.toHaveProperty("password");
    expect(summary).not.toHaveProperty("passwordHash");
    expect(summary).not.toHaveProperty("accessToken");
  });

  it("écarte aussi les secrets nommés en français", () => {
    // Les routes de réinitialisation nomment leurs champs `motDePasse` et
    // `jeton` : un filtre qui ne connaît que l'anglais les écrit en clair.
    const summary = summarizePayload({
      jeton: "a1b2c3d4e5",
      motDePasse: "SuperSecret123!",
      empreinte: "sha256:…",
      iban: "FR7630006000011234567890189",
      nom: "Cabinet Berthier",
    }) as Record<string, unknown>;

    expect(summary).toEqual({ nom: "Cabinet Berthier" });
  });

  it("remplace un import volumineux par son volume", () => {
    const items = Array.from({ length: 4200 }, (_, i) => ({ accountCode: String(i), amount: i }));
    expect(summarizePayload({ items })).toEqual({ items: { nombre: 4200 } });
  });

  it("tronque les chaînes très longues et limite la profondeur", () => {
    const summary = summarizePayload({
      label: "x".repeat(500),
      a: { b: { c: { d: "trop profond" } } },
    }) as Record<string, unknown>;

    expect(String(summary.label)).toHaveLength(201);
    expect(summary.a).toEqual({ b: { c: "…" } });
  });
});

describe("normalisation des paramètres de route", () => {
  it("laisse passer une valeur simple", () => {
    expect(premiereValeur({ id: "abc", periodId: "def" })).toEqual({ id: "abc", periodId: "def" });
  });

  it("ne retient que la première valeur d'un tableau", () => {
    // Express 5 autorise un paramètre à valoir un tableau. Écrire « a,b »
    // dans targetId désignerait, à la relecture d'un incident, un
    // identifiant qui n'existe pas.
    expect(premiereValeur({ id: ["a", "b"] })).toEqual({ id: "a" });
  });

  it("écarte un tableau vide plutôt que d'écrire une chaîne vide", () => {
    expect(premiereValeur({ id: [] })).toEqual({});
  });

  it("supporte l'absence de paramètres", () => {
    expect(premiereValeur(undefined)).toEqual({});
  });
});
