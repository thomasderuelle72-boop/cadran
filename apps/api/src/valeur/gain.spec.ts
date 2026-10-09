import { calculerGain } from "./gain";

/** Un trimestre de 92 jours : 920 000 € de ventes, 460 000 € d'achats. */
const TRIMESTRE = { chiffreAffaires: 920_000, achatsConsommes: 460_000, jours: 92 };

describe("gain réalisé d'une action", () => {
  it("convertit les jours de délai clients gagnés en ventes encaissées plus tôt", () => {
    const gain = calculerGain("dso", 69, 52, TRIMESTRE);
    // 17 jours × 10 000 € de ventes par jour.
    expect(gain.montant).toBeCloseTo(170_000, 6);
    expect(gain.nature).toBe("tresorerie");
    expect(gain.explication).toContain("17 jours");
  });

  it("compte une dégradation en négatif plutôt que de la taire", () => {
    expect(calculerGain("dso", 45, 50, TRIMESTRE).montant).toBeCloseTo(-50_000, 6);
  });

  it("valorise le stock et les délais fournisseurs sur les achats", () => {
    expect(calculerGain("dio", 90, 70, TRIMESTRE).montant).toBeCloseTo(100_000, 6);
    // Payer plus tard est un gain de trésorerie.
    expect(calculerGain("dpo", 25, 40, TRIMESTRE).montant).toBeCloseTo(75_000, 6);
  });

  it("annualise un gain de marge, quelle que soit la durée de la période", () => {
    // +2 points sur 920 000 € × 365 / 92 = 3 650 000 € de CA annuel.
    const gain = calculerGain("marge_ebitda", 0.1, 0.12, TRIMESTRE);
    expect(gain.montant).toBeCloseTo(73_000, 6);
    expect(gain.nature).toBe("resultat");
  });

  it("lit la trésorerie et le BFR comme des montants", () => {
    expect(calculerGain("tresorerie_nette", -20_000, 15_000, TRIMESTRE).montant).toBe(35_000);
    expect(calculerGain("bfr", 150_000, 120_000, TRIMESTRE).montant).toBe(30_000);
  });

  it("ne chiffre pas ce qui demanderait une hypothèse", () => {
    expect(calculerGain("gearing", 2, 1.5, TRIMESTRE)).toMatchObject({ montant: null, nature: null });
    expect(calculerGain("dso", null, 52, TRIMESTRE).montant).toBeNull();
    expect(calculerGain(null, 1, 2, TRIMESTRE).montant).toBeNull();
  });
});
