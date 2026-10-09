import type { Aggregates, Derived, RatioValue } from "../ratios/engine";

/**
 * Les missions qu'un dossier appelle, chiffrées.
 *
 * Un tableau de bord dit « DSO : 65 jours ». Un expert-comptable, devant le
 * même chiffre, dit « ton client te doit 38 000 € de plus que s'il payait
 * à 45 jours : on lance des relances ? ». Ce module fait la seconde phrase.
 *
 * Des règles écrites, et non un modèle : chaque opportunité doit pouvoir se
 * justifier devant le client ligne à ligne — le constat chiffré, la cible,
 * le calcul de l'enjeu. Les cibles sont prudentes et dites : le seuil « bon »
 * du moteur de ratios, ou la valeur de l'exercice précédent quand elle était
 * meilleure (on demande de revenir où l'on était, pas d'atteindre un idéal).
 *
 * L'enjeu est un ordre de grandeur pour ouvrir la conversation, pas une
 * promesse : il est calculé à activité constante, sur le dernier exercice
 * complet, et l'interface le présente comme tel.
 */

export type TypeMission =
  | "capitaux_propres"
  | "plan_tresorerie"
  | "revue_marges"
  | "relance_clients"
  | "stocks"
  | "delais_fournisseurs"
  | "dette"
  | "financement_croissance"
  | "tresorerie_dormante";

export type Priorite = "urgente" | "haute" | "normale";

export type NatureEnjeu = "tresorerie" | "resultat" | "financement" | "obligation";

export interface Opportunite {
  type: TypeMission;
  /** La mission à proposer au client, telle qu'on la nommerait dans une lettre de mission. */
  mission: string;
  /** Ce qu'on observe, chiffré. */
  constat: string;
  /** Ce qu'on propose de faire. */
  action: string;
  /** Ordre de grandeur de ce qui est en jeu, en devise du dossier. */
  enjeu: number;
  natureEnjeu: NatureEnjeu;
  priorite: Priorite;
  /** De quoi argumenter en rendez-vous : le mécanisme, la règle, l'ordre de grandeur. */
  arguments: string[];
  /** Pour le plan d'action : l'indicateur suivi, sa valeur actuelle et la cible. */
  suivi?: { ratioId: string; valeurInitiale: number; valeurCible: number };
}

export interface Situation {
  label: string;
  aggregates: Aggregates;
  derived: Derived;
  ratios: RatioValue[];
}

const JOURS = 365;

/** Seuils « bons » du moteur de ratios, repris comme cibles par défaut. */
const CIBLE_DSO = 45;
const CIBLE_DIO = 60;
const CIBLE_DPO = 45;
const CIBLE_CAPACITE = 3;

const RANG: Record<Priorite, number> = { urgente: 0, haute: 1, normale: 2 };

function valeur(s: Situation | null, id: string): number | null {
  const v = s?.ratios.find((r) => r.id === id)?.value;
  return v === undefined || v === null || !Number.isFinite(v) ? null : v;
}

export function euros(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} €`;
}

function jours(n: number): string {
  return `${Math.round(n)} jours`;
}

function pourcent(n: number): string {
  return `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** Ce que l'entreprise décaisse en un mois d'activité, hors amortissements. */
export function chargesMensuelles(a: Aggregates): number {
  return (a.achatsConsommes + a.chargesExternes + a.chargesPersonnel + a.impotsTaxes) / 12;
}

/** « contre 44 jours en Exercice 2024 », ou rien sans exercice précédent. */
function contre(precedent: number | null, s: Situation | null, format: (n: number) => string): string {
  return precedent !== null && s ? `, contre ${format(precedent)} en ${s.label}` : "";
}

export function detecterOpportunites(courant: Situation, precedent: Situation | null): Opportunite[] {
  const a = courant.aggregates;
  const d = courant.derived;
  const resultat: Opportunite[] = [];
  const mensuel = chargesMensuelles(a);

  // 1. Capitaux propres négatifs : une obligation, avant toute optimisation.
  if (a.capitauxPropres < 0) {
    resultat.push({
      type: "capitaux_propres",
      mission: "Reconstitution des capitaux propres",
      constat: `Les capitaux propres sont négatifs (${euros(a.capitauxPropres)}) à la clôture de ${courant.label}.`,
      action:
        "Préparer avec les associés la reconstitution des capitaux propres : augmentation de capital, incorporation de comptes courants, plan de retour aux bénéfices.",
      enjeu: -a.capitauxPropres,
      natureEnjeu: "obligation",
      priorite: "urgente",
      arguments: [
        "Quand les capitaux propres deviennent inférieurs à la moitié du capital social, les associés doivent se prononcer sur la dissolution anticipée dans les quatre mois de l'approbation des comptes (articles L223-42 et L225-248 du Code de commerce).",
        "La situation doit être régularisée au plus tard à la clôture du deuxième exercice suivant.",
      ],
    });
  }

  // 2. Trésorerie : négative, ou trop courte pour un mois d'activité.
  if (d.tresorerieNette < 0) {
    resultat.push({
      type: "plan_tresorerie",
      mission: "Plan de trésorerie et recherche de financement",
      constat: `La trésorerie nette est négative (${euros(d.tresorerieNette)}) : le cycle d'exploitation est financé à court terme.`,
      action:
        "Établir un plan de trésorerie sur 13 semaines et préparer un dossier de financement (prêt, découvert autorisé, affacturage).",
      enjeu: -d.tresorerieNette,
      natureEnjeu: "financement",
      priorite: "urgente",
      arguments: [
        "Un plan à 13 semaines montre à la banque que le besoin est mesuré et temporaire.",
        `Un mois d'activité représente environ ${euros(mensuel)} de décaissements.`,
      ],
      suivi: { ratioId: "tresorerie_nette", valeurInitiale: d.tresorerieNette, valeurCible: 0 },
    });
  } else if (mensuel > 0 && d.tresorerieNette < mensuel) {
    const joursCouverts = (d.tresorerieNette / mensuel) * 30;
    resultat.push({
      type: "plan_tresorerie",
      mission: "Plan de trésorerie",
      constat: `La trésorerie nette ne couvre que ${jours(joursCouverts)} de décaissements.`,
      action: "Établir un plan de trésorerie sur 13 semaines pour anticiper les mois creux et sécuriser une ligne de financement.",
      enjeu: mensuel - d.tresorerieNette,
      natureEnjeu: "financement",
      priorite: "haute",
      arguments: [
        "Un mois de décaissements d'avance est le minimum pour absorber un retard de paiement client.",
        "Une ligne de financement se négocie mieux avant d'en avoir besoin.",
      ],
      suivi: { ratioId: "tresorerie_nette", valeurInitiale: d.tresorerieNette, valeurCible: Math.round(mensuel) },
    });
  }

  // 3. Marge : négative, ou en recul net sur l'exercice précédent.
  const marge = valeur(courant, "marge_ebitda");
  const margeAvant = valeur(precedent, "marge_ebitda");
  if (marge !== null && marge < 0) {
    resultat.push({
      type: "revue_marges",
      mission: "Revue des prix et des coûts",
      constat: `L'activité perd de l'argent avant même les amortissements : EBITDA de ${euros(d.ebitda)}, soit ${pourcent(marge)} du chiffre d'affaires.`,
      action: "Revoir les prix de vente, identifier les produits et les clients non rentables, et les postes de charges à réduire.",
      enjeu: -d.ebitda,
      natureEnjeu: "resultat",
      priorite: "urgente",
      arguments: [
        "Tant que l'EBITDA est négatif, chaque mois d'activité consomme de la trésorerie.",
        `Pour revenir à l'équilibre, il faut ${euros(-d.ebitda)} de marge en plus sur l'année.`,
      ],
      suivi: { ratioId: "marge_ebitda", valeurInitiale: marge, valeurCible: Math.max(margeAvant ?? 0, 0) },
    });
  } else if (marge !== null && margeAvant !== null && margeAvant - marge >= 0.02) {
    const perdu = a.chiffreAffaires * (margeAvant - marge);
    resultat.push({
      type: "revue_marges",
      mission: "Revue des prix et des coûts",
      constat: `La marge d'EBITDA est passée de ${pourcent(margeAvant)} à ${pourcent(marge)}.`,
      action: "Analyser l'évolution des prix d'achat et de vente, et des principaux postes de charges, pour retrouver la marge passée.",
      enjeu: perdu,
      natureEnjeu: "resultat",
      priorite: marge < 0.05 || margeAvant - marge >= 0.05 ? "haute" : "normale",
      arguments: [
        `À chiffre d'affaires égal, retrouver la marge de ${precedent!.label} rapporterait environ ${euros(perdu)} par an.`,
        "Une hausse de prix de quelques pour cent passe souvent mieux qu'on ne le croit quand elle est expliquée.",
      ],
      suivi: { ratioId: "marge_ebitda", valeurInitiale: marge, valeurCible: margeAvant },
    });
  }

  // 4. Délai clients : au-delà du seuil, ou en dérive.
  const dso = valeur(courant, "dso");
  const dsoAvant = valeur(precedent, "dso");
  if (dso !== null && a.creancesClients > 0) {
    const cible = dsoAvant !== null && dsoAvant < dso ? Math.max(Math.min(dsoAvant, CIBLE_DSO), 30) : CIBLE_DSO;
    if (dso > cible + 7) {
      const enjeu = a.creancesClients * (1 - cible / dso);
      resultat.push({
        type: "relance_clients",
        mission: "Relance clients et conditions de paiement",
        constat: `Les clients paient en ${jours(dso)}${contre(dsoAvant, precedent, jours)}.`,
        action: `Relancer les factures échues et ramener le délai clients à ${jours(cible)} : relances systématiques, acomptes à la commande, conditions de paiement revues.`,
        enjeu,
        natureEnjeu: "tresorerie",
        priorite: dso > 60 ? "haute" : "normale",
        arguments: [
          `Chaque jour de délai gagné libère environ ${euros(a.chiffreAffaires / JOURS)} de trésorerie.`,
          "Le délai légal est de 60 jours à compter de la facture, ou 45 jours fin de mois (article L441-10 du Code de commerce).",
        ],
        suivi: { ratioId: "dso", valeurInitiale: dso, valeurCible: cible },
      });
    }
  }

  // 5. Stocks : trop de jours d'achats immobilisés.
  const dio = valeur(courant, "dio");
  const dioAvant = valeur(precedent, "dio");
  if (dio !== null && a.stocks > 0) {
    const cible = dioAvant !== null && dioAvant < dio ? Math.max(Math.min(dioAvant, CIBLE_DIO), 30) : CIBLE_DIO;
    if (dio > cible + 10) {
      const enjeu = a.stocks * (1 - cible / dio);
      resultat.push({
        type: "stocks",
        mission: "Optimisation des stocks",
        constat: `Le stock représente ${jours(dio)} d'achats${contre(dioAvant, precedent, jours)}.`,
        action: `Ramener le stock à ${jours(cible)} d'achats : écouler les références dormantes, ajuster les quantités commandées.`,
        enjeu,
        natureEnjeu: "tresorerie",
        priorite: dio > 90 ? "haute" : "normale",
        arguments: [
          "Un stock qui dort coûte deux fois : la trésorerie immobilisée, et le risque de dépréciation.",
          "Les références sans mouvement depuis six mois sont le premier levier.",
        ],
        suivi: { ratioId: "dio", valeurInitiale: dio, valeurCible: cible },
      });
    }
  }

  // 6. Délais fournisseurs : payés bien plus vite que les clients ne paient.
  const dpo = valeur(courant, "dpo");
  if (dpo !== null && dso !== null && a.achatsConsommes > 0 && dpo < 30 && dso > dpo + 15) {
    const enjeu = (a.achatsConsommes / JOURS) * (CIBLE_DPO - dpo);
    resultat.push({
      type: "delais_fournisseurs",
      mission: "Négociation des délais fournisseurs",
      constat: `Les fournisseurs sont payés en ${jours(dpo)}, alors que les clients paient en ${jours(dso)}.`,
      action: `Négocier des délais de paiement plus longs avec les principaux fournisseurs, jusqu'à ${jours(CIBLE_DPO)}.`,
      enjeu,
      natureEnjeu: "tresorerie",
      priorite: "normale",
      arguments: [
        "L'écart entre délai client et délai fournisseur est financé par la trésorerie de l'entreprise.",
        "La loi autorise jusqu'à 60 jours à compter de la facture, ou 45 jours fin de mois.",
      ],
      suivi: { ratioId: "dpo", valeurInitiale: dpo, valeurCible: CIBLE_DPO },
    });
  }

  // 7. Dette : plus de quatre années d'EBITDA pour la rembourser.
  const capacite = valeur(courant, "capacite_remboursement");
  if (capacite !== null && d.ebitda > 0 && capacite > 4) {
    const excedent = a.dettesFinancieres - CIBLE_CAPACITE * d.ebitda;
    resultat.push({
      type: "dette",
      mission: "Renégociation de la dette",
      constat: `Il faudrait ${capacite.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} années d'EBITDA pour rembourser les dettes financières (${euros(a.dettesFinancieres)}).`,
      action: "Renégocier la durée ou les échéances des emprunts, ou consolider les dettes pour alléger les remboursements annuels.",
      enjeu: excedent,
      natureEnjeu: "financement",
      priorite: capacite > 5 ? "haute" : "normale",
      arguments: [
        "Les banques regardent ce ratio en premier : au-delà de trois à quatre ans, un nouveau financement devient difficile.",
        "Allonger la durée réduit l'échéance annuelle sans changer le montant dû.",
      ],
      suivi: { ratioId: "capacite_remboursement", valeurInitiale: capacite, valeurCible: CIBLE_CAPACITE },
    });
  }

  // 8. Croissance : elle se finance, par le besoin en fonds de roulement.
  const croissance = valeur(courant, "croissance_ca");
  if (croissance !== null && croissance >= 0.15 && d.bfr > 0) {
    const besoin = d.bfr * croissance;
    resultat.push({
      type: "financement_croissance",
      mission: "Prévisionnel de croissance et financement",
      constat: `Le chiffre d'affaires progresse de ${pourcent(croissance)} : au même rythme, le besoin en fonds de roulement augmenterait d'environ ${euros(besoin)}.`,
      action: "Bâtir un prévisionnel sur deux ans et anticiper le financement du besoin en fonds de roulement avant qu'il ne pèse sur la trésorerie.",
      enjeu: besoin,
      natureEnjeu: "financement",
      priorite: d.tresorerieNette < besoin ? "haute" : "normale",
      arguments: [
        "Une entreprise qui grandit encaisse plus tard qu'elle ne paie : la croissance consomme de la trésorerie avant d'en rapporter.",
        "Un financement demandé avec un prévisionnel s'obtient à de meilleures conditions qu'un découvert subi.",
      ],
    });
  }

  // 9. Trésorerie dormante : plus de trois mois de décaissements en banque.
  if (mensuel > 0 && a.disponibilites > 3 * mensuel && d.resultatNet > 0 && d.tresorerieNette > 0) {
    const placable = a.disponibilites - 2 * mensuel;
    resultat.push({
      type: "tresorerie_dormante",
      mission: "Placement de la trésorerie excédentaire",
      constat: `Les disponibilités (${euros(a.disponibilites)}) représentent ${(a.disponibilites / mensuel).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} mois de décaissements.`,
      action: "Placer l'excédent sur un support sans risque, ou financer un investissement sans recourir à l'emprunt.",
      enjeu: placable,
      natureEnjeu: "tresorerie",
      priorite: "normale",
      arguments: [
        "Deux mois de décaissements suffisent comme réserve de sécurité ; au-delà, l'argent ne travaille pas.",
        "Un compte à terme garde la trésorerie disponible à échéance connue.",
      ],
    });
  }

  // À priorité égale, une obligation légale passe devant : elle ne se
  // discute pas, quel que soit le montant des autres sujets.
  const obligation = (o: Opportunite) => (o.natureEnjeu === "obligation" ? 0 : 1);
  return resultat.sort(
    (x, y) => RANG[x.priorite] - RANG[y.priorite] || obligation(x) - obligation(y) || y.enjeu - x.enjeu,
  );
}
