import { describe, expect, it } from "vitest";
import { FORMULES, REMISE_ANNUELLE, economieAnnuelle, prixAnnualise } from "./formules";

describe("grille tarifaire", () => {
  it("ne met en avant qu'une seule formule", () => {
    // Deux formules « recommandées » n'en recommandent aucune.
    expect(FORMULES.filter((f) => f.recommandee)).toHaveLength(1);
  });

  it("n'attache aucun prix à l'essai", () => {
    expect(FORMULES.find((f) => f.id === "essai")?.prixMensuel).toBeNull();
  });

  it("propose des prix croissants", () => {
    // Une grille non ordonnée rend le choix incompréhensible.
    const prix = FORMULES.map((f) => f.prixMensuel).filter((p): p is number => p !== null);
    expect(prix).toEqual([...prix].sort((a, b) => a - b));
  });

  it("couvre exactement les formules du catalogue de l'API", () => {
    // Une formule affichée qui n'existe pas côté serveur enverrait le client
    // vers un paiement impossible ; l'inverse la rendrait invendable.
    expect(FORMULES.map((f) => f.id).sort()).toEqual(["cabinet", "essai", "groupe", "solo"]);
  });
});

describe("remise annuelle", () => {
  it("applique bien les 20 % annoncés", () => {
    expect(prixAnnualise(100)).toBe(80);
    expect(REMISE_ANNUELLE).toBe(0.2);
  });

  it("chiffre l'économie sur douze mois", () => {
    // 29 € → 23 €, soit 6 € × 12.
    expect(prixAnnualise(29)).toBe(23);
    expect(economieAnnuelle(29)).toBe(72);
  });

  it("renvoie des montants entiers, affichables sans centimes", () => {
    FORMULES.forEach((f) => {
      if (f.prixMensuel === null) return;
      expect(Number.isInteger(prixAnnualise(f.prixMensuel))).toBe(true);
    });
  });
});
