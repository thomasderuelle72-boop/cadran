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

  it("valide un modèle de rapport et refuse une section inconnue ou un texte démesuré", () => {
    const valider = VALIDATEURS.rapport;
    const modele = { sections: ["garde", "synthese", "garde"], titre: "Rapport {exercice}", mot: "Bonjour", conclusion: "{conclusion_auto}" };
    expect(valider(modele)).toEqual({ valide: true, valeur: { ...modele, sections: ["garde", "synthese"] } });
    expect(valider({ ...modele, sections: ["inventee"] }).valide).toBe(false);
    expect(valider({ ...modele, mot: "x".repeat(5001) }).valide).toBe(false);
    expect(valider({ ...modele, titre: 3 }).valide).toBe(false);
  });
});
