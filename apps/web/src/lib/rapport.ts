import type { Opportunite } from "../api/types";
import type { Lecture } from "./evolution";
import { montantCourt } from "./evolution";

/**
 * Le rapport client : ce que le cabinet remet à son client après la clôture.
 *
 * Le cabinet en choisit les sections, leur ordre et les textes, une fois pour
 * tous ses dossiers (le « modèle du cabinet ») ; les chiffres, eux, viennent
 * toujours de Cadran. Les textes sont des gabarits : {dossier}, {exercice},
 * {cabinet}, {date} et {conclusion_auto} y sont remplacés au moment de
 * composer le rapport d'un dossier.
 */

export type IdSection =
  | "garde"
  | "mot"
  | "synthese"
  | "evolution"
  | "resultat"
  | "bilan"
  | "indicateurs"
  | "missions"
  | "plan"
  | "valeur"
  | "previsionnel"
  | "conclusion";

export const SECTIONS: Record<IdSection, { libelle: string; aide: string }> = {
  garde: { libelle: "Page de garde", aide: "Logo, titre, dossier, exercice et date" },
  mot: { libelle: "Le mot du cabinet", aide: "Votre introduction, à votre façon" },
  synthese: { libelle: "Synthèse", aide: "Le verdict et les quatre chiffres clés" },
  evolution: { libelle: "Évolution sur plusieurs exercices", aide: "Activité, rentabilité, structure, trésorerie" },
  resultat: { libelle: "Activité et résultat", aide: "Les soldes intermédiaires de gestion" },
  bilan: { libelle: "Bilan et trésorerie", aide: "Fonds de roulement, besoin en fonds de roulement, délais" },
  indicateurs: { libelle: "Indicateurs", aide: "Les ratios et leur appréciation" },
  missions: { libelle: "Nos recommandations", aide: "Les missions proposées, chiffrées en euros" },
  plan: { libelle: "Plan d'action", aide: "Les actions décidées et leur avancement" },
  valeur: { libelle: "Ce que les actions ont rapporté", aide: "La valeur créée pour le client" },
  previsionnel: { libelle: "Prévisionnel", aide: "La trésorerie des prochains exercices" },
  conclusion: { libelle: "Conclusion et signature", aide: "Votre conclusion, puis la signature du cabinet" },
};

export const IDS_SECTIONS = Object.keys(SECTIONS) as IdSection[];

export interface ModeleRapport {
  /** Les sections retenues, dans l'ordre du rapport. */
  sections: IdSection[];
  titre: string;
  mot: string;
  conclusion: string;
}

export const MODELE_PAR_DEFAUT: ModeleRapport = {
  sections: ["garde", "mot", "synthese", "evolution", "resultat", "bilan", "missions", "plan", "conclusion"],
  titre: "Rapport de gestion — {exercice}",
  mot:
    "Madame, Monsieur,\n\nVous trouverez dans ce rapport l'analyse des comptes de {dossier} pour {exercice} : " +
    "ce qui a bougé, ce que cela dit de la santé de l'entreprise, et ce que nous vous proposons pour la suite. " +
    "Nous restons à votre disposition pour en parler de vive voix.",
  conclusion: "{conclusion_auto}",
};

/** Un modèle lu en base peut dater d'une version précédente : on n'en garde que ce qui est encore connu. */
export function modeleValide(brut: Partial<ModeleRapport> | null | undefined): ModeleRapport {
  if (!brut) return MODELE_PAR_DEFAUT;
  const sections = (brut.sections ?? []).filter((s): s is IdSection => IDS_SECTIONS.includes(s as IdSection));
  return {
    sections: sections.length > 0 ? [...new Set(sections)] : MODELE_PAR_DEFAUT.sections,
    titre: typeof brut.titre === "string" ? brut.titre : MODELE_PAR_DEFAUT.titre,
    mot: typeof brut.mot === "string" ? brut.mot : MODELE_PAR_DEFAUT.mot,
    conclusion: typeof brut.conclusion === "string" ? brut.conclusion : MODELE_PAR_DEFAUT.conclusion,
  };
}

export interface Variables {
  dossier: string;
  exercice: string;
  cabinet: string;
  date: string;
  conclusion_auto?: string;
}

/** Remplace {dossier}, {exercice}… ; un nom inconnu est laissé tel quel, pour se voir à la relecture. */
export function remplir(gabarit: string, variables: Variables): string {
  return gabarit.replace(/\{(\w+)\}/g, (tout, nom: string) => {
    const valeur = (variables as unknown as Record<string, string | undefined>)[nom];
    return valeur === undefined ? tout : valeur;
  });
}

/** Déplace une section d'un cran, sans sortir de la liste. */
export function deplacer(sections: IdSection[], id: IdSection, sens: -1 | 1): IdSection[] {
  const i = sections.indexOf(id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= sections.length) return sections;
  const copie = [...sections];
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
}

/** Ajoute ou retire une section ; ajoutée, elle reprend sa place dans l'ordre par défaut. */
export function basculer(sections: IdSection[], id: IdSection): IdSection[] {
  if (sections.includes(id)) return sections.filter((s) => s !== id);
  const rang = IDS_SECTIONS.indexOf(id);
  const apres = sections.findIndex((s) => IDS_SECTIONS.indexOf(s) > rang);
  return apres < 0 ? [...sections, id] : [...sections.slice(0, apres), id, ...sections.slice(apres)];
}

/**
 * La conclusion écrite par des règles : ce qui va bien, ce qui demande de
 * l'attention, et la recommandation la plus urgente. Le cabinet la garde, la
 * complète ou la remplace ; elle lui évite seulement la page blanche.
 */
export function conclusionAuto(lectures: Lecture[], missions: Opportunite[]): string {
  const libelle = (l: Lecture) =>
    ({ activite: "l'activité", rentabilite: "la rentabilité", structure: "la structure financière", tresorerie: "la trésorerie" })[
      l.theme
    ];
  const forts = lectures.filter((l) => l.etat === "sain").map((l) => `${libelle(l)} (${l.resume})`);
  const vigilance = lectures.filter((l) => l.etat !== "sain").map((l) => `${libelle(l)} (${l.resume})`);
  const phrases: string[] = [];

  if (forts.length > 0) phrases.push(`Points forts : ${liste(forts)}.`);
  if (vigilance.length > 0) phrases.push(`Points de vigilance : ${liste(vigilance)}.`);
  if (lectures.length === 0) {
    phrases.push("L'historique disponible ne permet pas encore de lire une tendance sur plusieurs exercices.");
  }

  const priorite = [...missions].sort(
    (a, b) => rangPriorite(a.priorite) - rangPriorite(b.priorite) || b.enjeu - a.enjeu,
  )[0];
  if (priorite) {
    const enjeu = priorite.enjeu > 0 ? `, pour un enjeu d'environ ${montantCourt(priorite.enjeu)}` : "";
    phrases.push(`Notre première recommandation : ${minuscule(priorite.mission)}${enjeu}.`);
  } else if (vigilance.length === 0 && lectures.length > 0) {
    phrases.push("Aucun signal ne demande d'action immédiate : l'enjeu est de préserver ces équilibres.");
  }
  return phrases.join(" ");
}

function rangPriorite(p: Opportunite["priorite"]): number {
  return p === "urgente" ? 0 : p === "haute" ? 1 : 2;
}

function minuscule(texte: string): string {
  return texte.charAt(0).toLocaleLowerCase("fr") + texte.slice(1);
}

/** « a, b et c ». */
function liste(elements: string[]): string {
  if (elements.length <= 1) return elements.join("");
  return `${elements.slice(0, -1).join(", ")} et ${elements[elements.length - 1]}`;
}
