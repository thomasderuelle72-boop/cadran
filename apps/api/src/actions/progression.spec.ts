import { calculerProgression } from "./progression";

describe("avancement d'une action vers sa cible", () => {
  describe("indicateur qu'on veut faire baisser", () => {
    // Ramener le DSO de 83 à 65 jours : le cas d'école du conseil en
    // trésorerie, et celui où un rapport valeur/cible se tromperait.
    const chemin = (actuelle: number) => calculerProgression(83, 65, actuelle);

    it("vaut zéro au point de départ", () => {
      expect(chemin(83).valeur).toBe(0);
    });

    it("vaut la moitié à mi-parcours", () => {
      expect(chemin(74).valeur).toBeCloseTo(0.5, 6);
    });

    it("vaut un à la cible atteinte", () => {
      expect(chemin(65).valeur).toBe(1);
      expect(chemin(65).cibleAtteinte).toBe(true);
    });

    it("dépasse un quand la cible est battue, sans écrêtage", () => {
      // Écrêter à 1 cacherait qu'on a fait mieux que prévu.
      expect(chemin(56).valeur).toBeCloseTo(1.5, 6);
      expect(chemin(56).cibleAtteinte).toBe(true);
    });

    it("passe sous zéro quand la situation s'est dégradée", () => {
      expect(chemin(92).valeur).toBeCloseTo(-0.5, 6);
      expect(chemin(92).cibleAtteinte).toBe(false);
    });

    it("reconnaît le sens de l'objectif", () => {
      expect(chemin(74).sens).toBe("baisse");
    });
  });

  describe("indicateur qu'on veut faire monter", () => {
    // Porter la marge d'EBITDA de 12 % à 18 %.
    const chemin = (actuelle: number) => calculerProgression(0.12, 0.18, actuelle);

    it("mesure le chemin dans le bon sens", () => {
      expect(chemin(0.15).valeur).toBeCloseTo(0.5, 6);
      expect(chemin(0.18).cibleAtteinte).toBe(true);
      expect(chemin(0.14).cibleAtteinte).toBe(false);
      expect(chemin(0.15).sens).toBe("hausse");
    });
  });

  describe("cas limites", () => {
    it("ne calcule rien sans les trois valeurs", () => {
      expect(calculerProgression(null, 65, 74).valeur).toBeNull();
      expect(calculerProgression(83, null, 74).valeur).toBeNull();
      expect(calculerProgression(83, 65, null).valeur).toBeNull();
      expect(calculerProgression(83, 65, null).sens).toBeNull();
    });

    it("refuse de diviser par un chemin nul, mais constate la cible", () => {
      // Cible identique au point de départ : aucun trajet à mesurer.
      expect(calculerProgression(70, 70, 70)).toEqual({
        valeur: null,
        cibleAtteinte: true,
        sens: null,
      });
      expect(calculerProgression(70, 70, 75).cibleAtteinte).toBe(false);
    });

    it("traite une cible franchissant zéro", () => {
      // Sortir d'une trésorerie nette négative : de −20 000 à +10 000.
      const progression = calculerProgression(-20000, 10000, -5000);
      expect(progression.valeur).toBeCloseTo(0.5, 6);
      expect(progression.sens).toBe("hausse");
      expect(progression.cibleAtteinte).toBe(false);
    });
  });
});
