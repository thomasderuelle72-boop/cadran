import { describe, expect, it } from "vitest";
import type { Opportunite } from "../api/types";
import type { Lecture } from "./evolution";
import { MODELE_PAR_DEFAUT, basculer, conclusionAuto, deplacer, modeleValide, remplir } from "./rapport";

const lecture = (theme: Lecture["theme"], etat: Lecture["etat"], resume: string): Lecture => ({
  theme,
  etat,
  resume,
  question: "",
  phrases: [],
});

const mission = (partiel: Partial<Opportunite>): Opportunite => ({
  type: "t",
  mission: "Mission",
  constat: "",
  action: "",
  enjeu: 0,
  natureEnjeu: "tresorerie",
  priorite: "normale",
  arguments: [],
  dansLePlan: false,
  ...partiel,
});

describe("rapport client", () => {
  it("remplit les gabarits et laisse visible ce qu'il ne connaît pas", () => {
    const texte = remplir("Rapport {exercice} de {dossier} — {inconnu}", {
      dossier: "Bastide",
      exercice: "Exercice 2025",
      cabinet: "Audinord",
      date: "9 octobre 2026",
    });
    expect(texte).toBe("Rapport Exercice 2025 de Bastide — {inconnu}");
  });

  it("déplace une section d'un cran sans sortir de la liste", () => {
    expect(deplacer(["garde", "mot", "synthese"], "mot", -1)).toEqual(["mot", "garde", "synthese"]);
    expect(deplacer(["garde", "mot"], "garde", -1)).toEqual(["garde", "mot"]);
  });

  it("remet une section ajoutée à sa place dans l'ordre par défaut", () => {
    expect(basculer(["garde", "synthese", "conclusion"], "mot")).toEqual(["garde", "mot", "synthese", "conclusion"]);
    expect(basculer(["garde", "mot"], "mot")).toEqual(["garde"]);
  });

  it("ne garde d'un modèle enregistré que les sections encore connues", () => {
    expect(modeleValide({ sections: ["garde", "disparue" as never, "garde"], titre: "T" })).toEqual({
      ...MODELE_PAR_DEFAUT,
      sections: ["garde"],
      titre: "T",
    });
    expect(modeleValide(null)).toBe(MODELE_PAR_DEFAUT);
  });

  it("écrit une conclusion : points forts, vigilance, première recommandation", () => {
    const texte = conclusionAuto(
      [
        lecture("activite", "sain", "en hausse"),
        lecture("rentabilite", "a_surveiller", "en recul"),
        lecture("tresorerie", "fragile", "négative"),
      ],
      [
        mission({ mission: "Relance des créances clients", priorite: "haute", enjeu: 116_000 }),
        mission({ mission: "Plan de trésorerie à 13 semaines", priorite: "urgente", enjeu: 40_000 }),
      ],
    );
    expect(texte).toBe(
      "Points forts : l'activité (en hausse). Points de vigilance : la rentabilité (en recul) et la trésorerie (négative). " +
        "Notre première recommandation : plan de trésorerie à 13 semaines, pour un enjeu d'environ 40 k€.",
    );
  });

  it("dit qu'il n'y a rien d'urgent quand tout est sain et qu'aucune mission ne ressort", () => {
    expect(conclusionAuto([lecture("activite", "sain", "stable")], [])).toContain("Aucun signal");
  });
});
