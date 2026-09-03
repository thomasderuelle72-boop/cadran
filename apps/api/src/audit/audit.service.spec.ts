import { summarizePayload } from "./audit.service";

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
