import { lireAgregats, type Aggregates } from "../ratios/engine";
import { construireExercices, type PeriodeSource } from "./agregation";
import { hypothesesDuReel, planDeFinancement, scenarios } from "./depart";
import { assainirHypotheses, projeter } from "./previsionnel";

/** Bilan équilibré : actif 560 000 € = passif 560 000 €. */
const BASE: Partial<Aggregates> = {
  chiffreAffaires: 1_000_000,
  achatsConsommes: 400_000,
  chargesExternes: 150_000,
  chargesPersonnel: 250_000,
  impotsTaxes: 20_000,
  dotationsAmortissements: 40_000,
  chargesFinancieres: 5_000,
  impotSocietes: 30_000,
  stocks: 88_767, // 81 jours d'achats
  creancesClients: 150_685, // 55 jours de CA
  dettesFournisseurs: 82_192, // 75 jours d'achats
  autresCreances: 10_000,
  autresDettes: 60_000,
  disponibilites: 42_740,
  capitauxPropres: 350_000,
  dettesFinancieres: 100_000,
  immobilisations: 300_000,
};

function periode(annee: number, valeurs: Partial<Aggregates>): PeriodeSource {
  return {
    id: String(annee),
    label: `Exercice ${annee}`,
    debut: new Date(Date.UTC(annee, 0, 1)),
    fin: new Date(Date.UTC(annee, 11, 31)),
    aggregates: lireAgregats({ ...BASE, ...valeurs }),
  };
}

const exercices = construireExercices([
  periode(2023, { chiffreAffaires: 864_000 }),
  periode(2024, { chiffreAffaires: 930_000 }),
  periode(2025, {}),
]);

describe("hypothèses tirées du réel", () => {
  const { hypotheses, reference } = hypothesesDuReel(exercices);

  it("reprend les délais et les parts constatés du dernier exercice", () => {
    expect(hypotheses.dso).toBe(55);
    expect(hypotheses.dio).toBe(81);
    expect(hypotheses.dpo).toBe(75);
    expect(hypotheses.partAchats).toBeCloseTo(0.4);
    expect(reference.dso).toBeCloseTo(55, 0);
  });

  it("prolonge la tendance des trois derniers exercices, arrondie au demi-point", () => {
    // 864 000 → 1 000 000 en deux ans : 7,6 % par an.
    expect(hypotheses.croissanceCa).toBeCloseTo(0.075);
    expect(reference.croissanceCa).toBeCloseTo(1_000_000 / 930_000 - 1);
  });

  it("renouvelle l'outil au rythme de l'amortissement et rembourse la dette en cinq ans", () => {
    expect(hypotheses.investissements).toBe(40_000);
    // (300 000 + 40 000) / 40 000 = 8,5 : arrondi à 9 ans.
    expect(hypotheses.dureeAmortissement).toBe(9);
    expect(hypotheses.remboursements).toBe(20_000);
    expect(hypotheses.tauxInteret).toBeCloseTo(0.05);
  });

  it("ne libère pas de trésorerie fictive la première année quand rien ne change", () => {
    const immobile = assainirHypotheses({ ...hypotheses, croissanceCa: 0 });
    const [premier] = projeter({ annee: 2025, aggregates: exercices[2].aggregates }, immobile);
    // Stocks et créances restent où ils étaient, à l'arrondi du jour près.
    expect(Math.abs(premier.aggregates.stocks - BASE.stocks!)).toBeLessThan(1_500);
    expect(Math.abs(premier.aggregates.creancesClients - BASE.creancesClients!)).toBeLessThan(3_000);
  });
});

describe("plan de financement", () => {
  const { hypotheses } = hypothesesDuReel(exercices);
  const depart = exercices[2].aggregates;
  const projetes = projeter({ annee: 2025, aggregates: depart }, assainirHypotheses({ ...hypotheses, dividendes: 10_000, nouveauxEmprunts: 50_000 }));
  const plan = planDeFinancement(depart, projetes, assainirHypotheses({ ...hypotheses, dividendes: 10_000, nouveauxEmprunts: 50_000 }));

  it("retrouve exactement la variation des disponibilités", () => {
    let avant = depart.disponibilites;
    for (const ligne of plan) {
      expect(ligne.solde).toBeCloseTo(ligne.tresorerieFin - avant, 0);
      avant = ligne.tresorerieFin;
    }
  });

  it("présente la CAF en ressource et les dividendes en besoin", () => {
    expect(plan[0].ressources.caf).toBeCloseTo(projetes[0].derived.resultatNet + projetes[0].aggregates.dotationsAmortissements, 2);
    expect(plan[0].besoins.dividendes).toBeCloseTo(10_000, 0);
    expect(plan[0].ressources.emprunts).toBe(50_000);
  });
});

describe("scénarios", () => {
  it("encadre le scénario central de cinq points de croissance", () => {
    const { hypotheses } = hypothesesDuReel(exercices);
    const [prudent, central, ambitieux] = scenarios({ annee: 2025, aggregates: exercices[2].aggregates }, hypotheses);
    expect(central.croissanceCa).toBeCloseTo(hypotheses.croissanceCa);
    expect(prudent.chiffreAffairesFinal).toBeLessThan(central.chiffreAffairesFinal);
    expect(ambitieux.chiffreAffairesFinal).toBeGreaterThan(central.chiffreAffairesFinal);
    // Les charges fixes ne suivent pas : le résultat bouge plus que le CA.
    expect(ambitieux.resultatNetCumule).toBeGreaterThan(central.resultatNetCumule);
  });
});
