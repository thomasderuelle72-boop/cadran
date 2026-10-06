import { Aggregates } from "../ratios/engine";
import {
  POSTES_FLUX,
  POSTES_STOCK,
  PeriodeSource,
  construireExercices,
  joursEntre,
  millesime,
  reunirExercice,
} from "./agregation";

function agregats(valeurs: Partial<Aggregates>): Aggregates {
  const base = {} as Aggregates;
  for (const poste of [...POSTES_FLUX, ...POSTES_STOCK]) base[poste] = 0;
  return { ...base, ...valeurs };
}

function periode(
  label: string,
  debut: string,
  fin: string,
  valeurs: Partial<Aggregates>
): PeriodeSource {
  return {
    id: label,
    label,
    debut: new Date(`${debut}T00:00:00Z`),
    fin: new Date(`${fin}T00:00:00Z`),
    aggregates: agregats(valeurs),
  };
}

describe("réunion des périodes d'un exercice", () => {
  it("somme les postes de compte de résultat", () => {
    const total = reunirExercice([
      periode("Jan", "2026-01-01", "2026-01-31", { chiffreAffaires: 100, chargesPersonnel: 40 }),
      periode("Fév", "2026-02-01", "2026-02-28", { chiffreAffaires: 120, chargesPersonnel: 45 }),
    ]);
    expect(total.chiffreAffaires).toBe(220);
    expect(total.chargesPersonnel).toBe(85);
  });

  it("retient la clôture pour les postes de bilan, et non leur somme", () => {
    // L'erreur classique : trois mois à 50 000 € de trésorerie ne font pas
    // 150 000 € au 31 mars. Ils en font 50 000.
    const total = reunirExercice([
      periode("Jan", "2026-01-01", "2026-01-31", { disponibilites: 50_000, capitauxPropres: 200_000 }),
      periode("Fév", "2026-02-01", "2026-02-28", { disponibilites: 60_000, capitauxPropres: 205_000 }),
      periode("Mar", "2026-03-01", "2026-03-31", { disponibilites: 42_000, capitauxPropres: 210_000 }),
    ]);
    expect(total.disponibilites).toBe(42_000);
    expect(total.capitauxPropres).toBe(210_000);
  });

  it("prend la clôture chronologique même si les périodes arrivent en désordre", () => {
    // L'ordre vient d'une requête ; s'y fier sans trier, c'est prendre le
    // solde de janvier pour celui de décembre un jour où la requête change.
    const total = reunirExercice([
      periode("Mar", "2026-03-01", "2026-03-31", { disponibilites: 42_000 }),
      periode("Jan", "2026-01-01", "2026-01-31", { disponibilites: 50_000 }),
      periode("Fév", "2026-02-01", "2026-02-28", { disponibilites: 60_000 }),
    ]);
    expect(total.disponibilites).toBe(42_000);
  });

  it("rend des agrégats nuls sans période", () => {
    const total = reunirExercice([]);
    expect(total.chiffreAffaires).toBe(0);
    expect(total.disponibilites).toBe(0);
  });
});

describe("millésime d'une période", () => {
  it("retient l'année de clôture, pas celle d'ouverture", () => {
    // Un exercice décalé juillet–juin porte l'année de sa clôture : prendre
    // l'ouverture le couperait en deux.
    expect(millesime({ fin: new Date("2026-06-30T00:00:00Z") })).toBe(2026);
    expect(millesime({ fin: new Date("2026-01-31T00:00:00Z") })).toBe(2026);
  });
});

describe("construction des exercices", () => {
  const douzeMois = (annee: number, caMensuel: number, tresorerieFinale: number) =>
    Array.from({ length: 12 }, (_, mois) => {
      const debut = new Date(Date.UTC(annee, mois, 1));
      const fin = new Date(Date.UTC(annee, mois + 1, 0));
      return periode(
        `${annee}-${mois + 1}`,
        debut.toISOString().slice(0, 10),
        fin.toISOString().slice(0, 10),
        {
          chiffreAffaires: caMensuel,
          achatsConsommes: caMensuel * 0.4,
          chargesPersonnel: caMensuel * 0.3,
          disponibilites: mois === 11 ? tresorerieFinale : tresorerieFinale / 2,
          creancesClients: caMensuel * 2,
          capitauxPropres: 300_000,
          immobilisations: 200_000,
        }
      );
    });

  it("regroupe douze mois en un exercice", () => {
    const [exercice] = construireExercices(douzeMois(2025, 100_000, 80_000));
    expect(exercice.annee).toBe(2025);
    expect(exercice.aggregates.chiffreAffaires).toBe(1_200_000);
    expect(exercice.aggregates.disponibilites).toBe(80_000);
    expect(exercice.complet).toBe(true);
    expect(exercice.periodes).toHaveLength(12);
  });

  it("recalcule les ratios au lieu de moyenner ceux des mois", () => {
    /*
     * Le cas qui démasque la moyenne. Un mois à 1 000 € de CA et une marge
     * forte, onze mois à 100 000 € et une marge faible : la moyenne des
     * marges mensuelles donnerait un chiffre très au-dessus de la marge
     * réelle de l'exercice.
     */
    const mois = [
      periode("Jan", "2025-01-01", "2025-01-31", {
        chiffreAffaires: 1_000,
        achatsConsommes: 500,
        capitauxPropres: 100_000,
        immobilisations: 50_000,
      }),
      ...Array.from({ length: 11 }, (_, i) =>
        periode(
          `M${i + 2}`,
          new Date(Date.UTC(2025, i + 1, 1)).toISOString().slice(0, 10),
          new Date(Date.UTC(2025, i + 2, 0)).toISOString().slice(0, 10),
          {
            chiffreAffaires: 100_000,
            achatsConsommes: 90_000,
            capitauxPropres: 100_000,
            immobilisations: 50_000,
          }
        )
      ),
    ];

    const [exercice] = construireExercices(mois);
    const margeBrute = exercice.ratios.find((r) => r.id === "marge_brute")?.value;

    // Vraie marge : (1 101 000 − 990 500) / 1 101 000 ≈ 10,04 %.
    expect(margeBrute).toBeCloseTo(0.1004, 3);
    // La moyenne des marges mensuelles serait d'environ 12,9 % : nettement
    // au-dessus. Le test échouerait si on moyennait.
    expect(margeBrute).toBeLessThan(0.11);
  });

  it("mesure la croissance d'un exercice à l'autre, pas d'un mois à l'autre", () => {
    const exercices = construireExercices([
      ...douzeMois(2024, 100_000, 50_000),
      ...douzeMois(2025, 110_000, 80_000),
    ]);
    expect(exercices).toHaveLength(2);
    const croissance = exercices[1].ratios.find((r) => r.id === "croissance_ca")?.value;
    expect(croissance).toBeCloseTo(0.1, 4);
    // Le premier exercice n'a pas de référence : sa croissance est inconnue,
    // pas nulle. Annoncer 0 % laisserait croire à une stagnation.
    expect(exercices[0].ratios.find((r) => r.id === "croissance_ca")?.value).toBeNull();
  });

  it("signale un exercice incomplet au lieu de le présenter comme une année", () => {
    // L'année en cours : trois mois seulement. Comparer son chiffre
    // d'affaires à celui d'une année pleine donnerait une chute de 75 %.
    const exercices = construireExercices([
      ...douzeMois(2024, 100_000, 50_000),
      ...douzeMois(2025, 100_000, 50_000).slice(0, 3),
    ]);
    expect(exercices[0].complet).toBe(true);
    expect(exercices[1].complet).toBe(false);
    expect(exercices[1].joursCouverts).toBeLessThan(100);
  });

  it("rapporte les délais à la durée réellement couverte", () => {
    /*
     * Un trimestre seul : 300 000 € de CA et 200 000 € de créances. Rapporté
     * à 365 jours, le DSO sortirait à ~240 jours ; rapporté aux 90 jours
     * réels, il est de ~60. Le premier chiffre déclencherait une alerte
     * infondée.
     */
    const trimestre = Array.from({ length: 3 }, (_, mois) =>
      periode(
        `T1-${mois}`,
        new Date(Date.UTC(2025, mois, 1)).toISOString().slice(0, 10),
        new Date(Date.UTC(2025, mois + 1, 0)).toISOString().slice(0, 10),
        { chiffreAffaires: 100_000, creancesClients: 200_000, capitauxPropres: 100_000 }
      )
    );
    const [exercice] = construireExercices(trimestre);
    const dso = exercice.ratios.find((r) => r.id === "dso")?.value;
    expect(dso).not.toBeNull();
    expect(dso!).toBeGreaterThan(50);
    expect(dso!).toBeLessThan(70);
  });

  it("rend les exercices dans l'ordre chronologique", () => {
    const exercices = construireExercices([
      ...douzeMois(2026, 100_000, 10_000),
      ...douzeMois(2024, 100_000, 10_000),
      ...douzeMois(2025, 100_000, 10_000),
    ]);
    expect(exercices.map((e) => e.annee)).toEqual([2024, 2025, 2026]);
  });

  it("ne rend rien sans période", () => {
    expect(construireExercices([])).toEqual([]);
  });
});

describe("décompte des jours", () => {
  it("compte les deux bornes", () => {
    expect(joursEntre(new Date("2025-01-01T00:00:00Z"), new Date("2025-01-31T00:00:00Z"))).toBe(31);
    expect(joursEntre(new Date("2025-01-01T00:00:00Z"), new Date("2025-12-31T00:00:00Z"))).toBe(365);
  });
});
