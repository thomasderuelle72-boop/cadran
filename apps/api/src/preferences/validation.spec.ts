import { VALIDATEURS, cleConnue } from "./validation";

describe("modèles du cabinet", () => {
  const valider = VALIDATEURS.evolution;

  it("accepte une liste de lignes et en retire les doublons", () => {
    expect(valider({ lignes: ["ca", "rn", "ca"] })).toEqual({ valide: true, valeur: { lignes: ["ca", "rn"] } });
  });

  it("refuse ce qui n'est pas une liste d'identifiants", () => {
    expect(valider({ lignes: [] }).valide).toBe(false);
    expect(valider({ lignes: ["<script>"] }).valide).toBe(false);
    expect(valider(["ca"]).valide).toBe(false);
    expect(valider(null).valide).toBe(false);
  });

  it("ne connaît que les clés déclarées", () => {
    expect(cleConnue("evolution")).toBe(true);
    expect(cleConnue("constructor")).toBe(false);
    expect(cleConnue("__proto__")).toBe(false);
  });
});
