import type { Aggregates } from "../ratios/engine";
import type { Exercice } from "./agregation";
import { HYPOTHESES_PAR_DEFAUT, Hypotheses, ExerciceProjete, assainirHypotheses, projeter } from "./previsionnel";

/**
 * Le point de départ du prévisionnel : les chiffres du client, pas des
 * moyennes.
 *
 * L'ancien écran proposait des hypothèses génériques — 45 jours de délai
 * client, 30 jours de stock. Sur un dossier à 55 et 81 jours, la première
 * année projetée « libérait » d'un coup le stock et les créances, et la
 * trésorerie s'envolait de plusieurs centaines de milliers d'euros sans que
 * personne n'ait rien décidé. Devant un banquier, c'est une faute.
 *
 * On part donc du dernier exercice complet : sans rien toucher, le
 * prévisionnel montre ce qui se passe **si rien ne change**. Chaque hypothèse
 * vient avec sa valeur constatée, pour que l'écart soit une décision visible.
 */

export type ReferenceHypotheses = Partial<Record<keyof Hypotheses, number>>;

const arrondiA = (valeur: number, pas: number) => Math.round(valeur / pas) * pas;
const borne = (valeur: number, min: number, max: number) => Math.min(max, Math.max(min, valeur));

function ratio(exercice: Exercice, id: string): number | null {
  const v = exercice.ratios.find((r) => r.id === id)?.value;
  return v === undefined || v === null || !Number.isFinite(v) ? null : v;
}

function part(numerateur: number, ca: number): number | null {
  return ca > 0 ? numerateur / ca : null;
}

function croissance(avant: number | undefined, apres: number): number | null {
  return avant !== undefined && avant > 0 ? apres / avant - 1 : null;
}

/**
 * Les hypothèses « si rien ne change », tirées des exercices complets, et les
 * valeurs constatées qui les justifient.
 *
 * `exercices` : les exercices complets, du plus ancien au plus récent.
 */
export function hypothesesDuReel(exercices: Exercice[]): { hypotheses: Hypotheses; reference: ReferenceHypotheses } {
  const dernier = exercices[exercices.length - 1];
  if (!dernier) return { hypotheses: HYPOTHESES_PAR_DEFAUT, reference: {} };
  const precedent = exercices.length > 1 ? exercices[exercices.length - 2] : undefined;
  const a: Aggregates = dernier.aggregates;
  const reference: ReferenceHypotheses = {};

  // Activité : la tendance des trois derniers exercices, bornée. Une seule
  // année exceptionnelle ne doit pas se projeter trois fois.
  const fenetre = exercices.slice(-3);
  const premier = fenetre[0];
  const annees = dernier.annee - premier.annee;
  const tendance =
    annees > 0 && premier.aggregates.chiffreAffaires > 0 && a.chiffreAffaires > 0
      ? Math.pow(a.chiffreAffaires / premier.aggregates.chiffreAffaires, 1 / annees) - 1
      : null;
  const recente = croissance(precedent?.aggregates.chiffreAffaires, a.chiffreAffaires);
  if (recente !== null) reference.croissanceCa = recente;
  const croissanceCa = tendance === null ? 0 : arrondiA(borne(tendance, -0.1, 0.15), 0.005);

  const partAchats = part(a.achatsConsommes, a.chiffreAffaires);
  const partImpotsTaxes = part(a.impotsTaxes, a.chiffreAffaires);
  if (partAchats !== null) reference.partAchats = partAchats;
  if (partImpotsTaxes !== null) reference.partImpotsTaxes = partImpotsTaxes;

  const externes = croissance(precedent?.aggregates.chargesExternes, a.chargesExternes);
  const personnel = croissance(precedent?.aggregates.chargesPersonnel, a.chargesPersonnel);
  if (externes !== null) reference.croissanceChargesExternes = externes;
  if (personnel !== null) reference.croissanceChargesPersonnel = personnel;

  // Les délais du dernier exercice, au jour près.
  const dso = ratio(dernier, "dso");
  const dpo = ratio(dernier, "dpo");
  const dio = ratio(dernier, "dio");
  if (dso !== null) reference.dso = dso;
  if (dpo !== null) reference.dpo = dpo;
  if (dio !== null) reference.dio = dio;

  // Investir ce qu'on amortit : l'outil se renouvelle sans grossir.
  const investissements = arrondiA(Math.max(0, a.dotationsAmortissements), 1000);
  reference.investissements = a.dotationsAmortissements;
  // Le moteur amortit l'encours d'ouverture augmenté de l'investissement de
  // l'année : la durée qui redonne la dotation constatée est donc
  // (immobilisations + investissement) / dotation. Avec immobilisations /
  // dotation, la dotation projetée dépassait la constatée et le parc fondait.
  const duree =
    a.immobilisations > 0 && a.dotationsAmortissements > 0
      ? Math.round(borne((a.immobilisations + investissements) / a.dotationsAmortissements, 3, 20))
      : HYPOTHESES_PAR_DEFAUT.dureeAmortissement;

  // Sans tableau d'emprunt, on suppose la dette remboursée en cinq ans. C'est
  // à vérifier, et l'écran le dit.
  const remboursements = arrondiA(Math.max(0, a.dettesFinancieres) / 5, 1000);
  const taux =
    a.dettesFinancieres > 0 ? borne(a.chargesFinancieres / a.dettesFinancieres, 0, 0.15) : null;
  if (taux !== null) reference.tauxInteret = taux;

  const hypotheses = assainirHypotheses({
    ...HYPOTHESES_PAR_DEFAUT,
    croissanceCa,
    partAchats: partAchats === null ? HYPOTHESES_PAR_DEFAUT.partAchats : arrondiA(partAchats, 0.001),
    partImpotsTaxes: partImpotsTaxes === null ? HYPOTHESES_PAR_DEFAUT.partImpotsTaxes : arrondiA(partImpotsTaxes, 0.001),
    dso: dso === null ? HYPOTHESES_PAR_DEFAUT.dso : Math.round(dso),
    dpo: dpo === null ? HYPOTHESES_PAR_DEFAUT.dpo : Math.round(dpo),
    dio: dio === null ? HYPOTHESES_PAR_DEFAUT.dio : Math.round(dio),
    investissements,
    dureeAmortissement: duree,
    remboursements,
    tauxInteret: taux === null ? HYPOTHESES_PAR_DEFAUT.tauxInteret : arrondiA(taux, 0.0025),
  });
  return { hypotheses, reference };
}

// --- Le plan de financement ---------------------------------------------------

export interface LignePlan {
  annee: number;
  besoins: { investissements: number; augmentationBfr: number; remboursements: number; dividendes: number; total: number };
  ressources: { caf: number; emprunts: number; diminutionBfr: number; total: number };
  /** Ressources moins besoins : la variation des disponibilités. */
  solde: number;
  tresorerieFin: number;
}

/** Besoin en fonds de roulement au sens du bilan projeté, autres postes compris. */
function bfr(a: Aggregates): number {
  return a.stocks + a.creancesClients + a.autresCreances - a.dettesFournisseurs - a.autresDettes;
}

/**
 * Le plan de financement à trois ans, dans la présentation que demandent les
 * banques (Bpifrance Création) : besoins durables d'un côté, ressources
 * stables de l'autre, et l'excédent ou le manque.
 *
 * Il est tiré des bilans projetés, pas des hypothèses brutes : une dette ne
 * se rembourse pas au-delà de son encours, une immobilisation ne descend pas
 * sous zéro. Le solde retrouve ainsi exactement la variation des
 * disponibilités — un test le vérifie.
 */
export function planDeFinancement(depart: Aggregates, projetes: ExerciceProjete[], h: Hypotheses): LignePlan[] {
  let avant = depart;
  return projetes.map((exercice) => {
    const apres = exercice.aggregates;
    const resultatNet = exercice.derived.resultatNet;
    const caf = resultatNet + apres.dotationsAmortissements;
    const investissements = apres.immobilisations - avant.immobilisations + apres.dotationsAmortissements;
    const emprunts = h.nouveauxEmprunts;
    const remboursements = avant.dettesFinancieres + emprunts - apres.dettesFinancieres;
    const dividendes = avant.capitauxPropres + resultatNet - apres.capitauxPropres;
    const variationBfr = bfr(apres) - bfr(avant);

    const besoins = {
      investissements,
      augmentationBfr: Math.max(0, variationBfr),
      remboursements,
      dividendes,
      total: 0,
    };
    besoins.total = besoins.investissements + besoins.augmentationBfr + besoins.remboursements + besoins.dividendes;
    const ressources = { caf, emprunts, diminutionBfr: Math.max(0, -variationBfr), total: 0 };
    ressources.total = ressources.caf + ressources.emprunts + ressources.diminutionBfr;

    avant = apres;
    return {
      annee: exercice.annee,
      besoins,
      ressources,
      solde: ressources.total - besoins.total,
      tresorerieFin: apres.disponibilites,
    };
  });
}

// --- Les scénarios ------------------------------------------------------------

export interface ResumeScenario {
  id: "prudent" | "central" | "ambitieux";
  libelle: string;
  croissanceCa: number;
  chiffreAffairesFinal: number;
  resultatNetCumule: number;
  tresorerieFinale: number;
  /** Le plus gros manque de trésorerie de l'horizon ; zéro si elle reste positive. */
  besoinMaximal: number;
}

/** Cinq points de croissance de part et d'autre : les charges fixes, elles, ne bougent pas. */
const ECART_SCENARIO = 0.05;

export function scenarios(depart: { annee: number; aggregates: Aggregates }, h: Hypotheses): ResumeScenario[] {
  const variantes: Array<[ResumeScenario["id"], string, number]> = [
    ["prudent", "Prudent", h.croissanceCa - ECART_SCENARIO],
    ["central", "Central", h.croissanceCa],
    ["ambitieux", "Ambitieux", h.croissanceCa + ECART_SCENARIO],
  ];
  return variantes.map(([id, libelle, croissanceCa]) => {
    const projetes = projeter(depart, assainirHypotheses({ ...h, croissanceCa }));
    const dernier = projetes[projetes.length - 1];
    return {
      id,
      libelle,
      croissanceCa,
      chiffreAffairesFinal: dernier?.aggregates.chiffreAffaires ?? 0,
      resultatNetCumule: projetes.reduce((s, e) => s + e.derived.resultatNet, 0),
      tresorerieFinale: dernier?.aggregates.disponibilites ?? 0,
      besoinMaximal: Math.max(0, ...projetes.map((e) => e.besoinFinancement)),
    };
  });
}
