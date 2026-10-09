import { computeDerived, computeRatios, lireAgregats, type Aggregates } from "../ratios/engine";
import { chargesMensuelles, detecterOpportunites, type Situation } from "./regles";

/*
 * Les situations sont construites avec le vrai moteur de ratios : une règle
 * qui lirait un ratio mal nommé, ou à la mauvaise échelle, échouerait ici.
 */

const SAINE: Partial<Aggregates> = {
  chiffreAffaires: 1_000_000,
  achatsConsommes: 400_000,
  chargesExternes: 150_000,
  chargesPersonnel: 250_000,
  impotsTaxes: 20_000,
  dotationsAmortissements: 40_000,
  chargesFinancieres: 5_000,
  impotSocietes: 30_000,
  stocks: 50_000, // 46 jours d'achats
  creancesClients: 110_000, // 40 jours
  dettesFournisseurs: 50_000, // 46 jours
  autresCreances: 10_000,
  autresDettes: 60_000,
  disponibilites: 120_000,
  // Bilan équilibré : actif 560 000 € = passif 560 000 €.
  capitauxPropres: 350_000,
  dettesFinancieres: 100_000,
  immobilisations: 270_000,
};

function situation(valeurs: Partial<Aggregates>, label = "Exercice 2025", precedent?: Situation | null): Situation {
  const aggregates = lireAgregats({ ...SAINE, ...valeurs });
  const derived = computeDerived(aggregates);
  return { label, aggregates, derived, ratios: computeRatios(aggregates, derived, precedent ?? null) };
}

function types(courant: Situation, precedent: Situation | null = null) {
  return detecterOpportunites(courant, precedent).map((o) => o.type);
}

describe("opportunités de missions", () => {
  it("ne propose rien à un dossier sain, sans trésorerie dormante", () => {
    expect(types(situation({}))).toEqual([]);
  });

  it("chiffre la relance clients sur le délai cible, et le dit", () => {
    // 200 000 € de créances pour 1 M€ de CA : 73 jours. Cible : 45 jours.
    // Le BFR grossit d'autant : la trésorerie nette passe sous zéro, et le
    // plan de trésorerie, urgent, passe devant la relance.
    const opportunites = detecterOpportunites(situation({ creancesClients: 200_000 }), null);
    expect(opportunites[0].type).toBe("plan_tresorerie");
    const relance = opportunites.find((o) => o.type === "relance_clients")!;
    expect(relance.priorite).toBe("haute");
    expect(relance.enjeu).toBeCloseTo(200_000 * (1 - 45 / 73), 0);
    expect(relance.suivi).toEqual({ ratioId: "dso", valeurInitiale: expect.closeTo(73, 0), valeurCible: 45 });
    expect(relance.arguments.join(" ")).toContain("L441-10");
  });

  it("demande de revenir au délai de l'an passé quand il était meilleur", () => {
    const avant = situation({ creancesClients: 90_000 }, "Exercice 2024"); // 33 jours
    const apres = situation({ creancesClients: 130_000 }, "Exercice 2025", avant); // 47 jours
    const relance = detecterOpportunites(apres, avant).find((o) => o.type === "relance_clients");
    expect(relance?.suivi?.valeurCible).toBeCloseTo(32.85, 1);
    expect(relance?.constat).toContain("en Exercice 2024");
  });

  it("met la reconstitution des capitaux propres en tête, comme une obligation", () => {
    const opportunites = detecterOpportunites(situation({ capitauxPropres: -40_000, creancesClients: 200_000 }), null);
    expect(opportunites[0]).toMatchObject({ type: "capitaux_propres", priorite: "urgente", natureEnjeu: "obligation", enjeu: 40_000 });
    expect(opportunites[0].arguments.join(" ")).toContain("L223-42");
  });

  it("distingue une trésorerie négative d'une trésorerie seulement courte", () => {
    // Moins de disponibilités, plus de dette fournisseur : la trésorerie nette baisse.
    const negative = detecterOpportunites(situation({ capitauxPropres: 100_000, disponibilites: 10_000 }), null);
    expect(negative.find((o) => o.type === "plan_tresorerie")?.priorite).toBe("urgente");

    const courte = situation({ capitauxPropres: 290_000 }); // trésorerie nette 60 000 €
    const plan = detecterOpportunites(courte, null).find((o) => o.type === "plan_tresorerie");
    expect(courte.derived.tresorerieNette).toBeGreaterThan(0);
    expect(courte.derived.tresorerieNette).toBeLessThan(chargesMensuelles(courte.aggregates));
    expect(plan?.priorite).toBe("haute");
  });

  it("chiffre la marge perdue à chiffre d'affaires égal", () => {
    const avant = situation({}, "Exercice 2024");
    const apres = situation({ chargesExternes: 210_000 }, "Exercice 2025", avant); // −6 points
    const revue = detecterOpportunites(apres, avant).find((o) => o.type === "revue_marges");
    expect(revue?.enjeu).toBeCloseTo(60_000, 0);
    expect(revue?.priorite).toBe("haute");
  });

  it("ne voit pas de recul de marge sous deux points", () => {
    const avant = situation({}, "Exercice 2024");
    const apres = situation({ chargesExternes: 165_000 }, "Exercice 2025", avant); // −1,5 point
    expect(types(apres, avant)).not.toContain("revue_marges");
  });

  it("signale une dette lourde au regard de l'EBITDA", () => {
    // EBITDA 180 000 € ; 900 000 € de dettes : 5 ans.
    const dette = detecterOpportunites(situation({ dettesFinancieres: 900_000, disponibilites: 920_000 }), null).find(
      (o) => o.type === "dette",
    );
    expect(dette?.enjeu).toBeCloseTo(900_000 - 3 * 180_000, 0);
  });

  it("chiffre le besoin de financement d'une croissance rapide", () => {
    const avant = situation({ chiffreAffaires: 800_000 }, "Exercice 2024");
    const apres = situation({}, "Exercice 2025", avant); // +25 %
    const croissance = detecterOpportunites(apres, avant).find((o) => o.type === "financement_croissance");
    expect(croissance?.enjeu).toBeCloseTo(apres.derived.bfr * 0.25, 0);
  });

  it("repère la trésorerie qui dort, au-delà de deux mois de réserve", () => {
    const riche = situation({ disponibilites: 400_000, capitauxPropres: 630_000 });
    const dormante = detecterOpportunites(riche, null).find((o) => o.type === "tresorerie_dormante");
    expect(dormante?.enjeu).toBeCloseTo(400_000 - 2 * chargesMensuelles(riche.aggregates), 0);
  });

  it("trie par priorité, puis par enjeu", () => {
    const opportunites = detecterOpportunites(
      situation({ capitauxPropres: -40_000, creancesClients: 200_000, stocks: 150_000 }),
      null,
    );
    const rangs = opportunites.map((o) => o.priorite);
    expect(rangs).toEqual([...rangs].sort((x, y) => ["urgente", "haute", "normale"].indexOf(x) - ["urgente", "haute", "normale"].indexOf(y)));
  });
});
