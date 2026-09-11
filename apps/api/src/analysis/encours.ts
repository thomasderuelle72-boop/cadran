/**
 * Encours par tiers : balance âgée et concentration.
 *
 * C'est le module qui fait passer du constat à l'explication. « Créances
 * clients : 387 000 € » est un mur ; « trois clients pèsent 60 % de l'encours
 * et payent au-delà de 90 jours » est une conversation.
 *
 * Deux notions distinctes, souvent confondues :
 *
 *   - l'**encours** est ce qui reste dû. Il se lit sur les écritures *non
 *     lettrées* : lettrer une écriture, c'est la rapprocher de son règlement.
 *   - la **facturation** est ce qui a été vendu sur la période, lettré ou non.
 *     Elle se reconstitue en reliant, au sein d'une même écriture comptable,
 *     la ligne de tiers et les lignes de produit.
 *
 * Module pur.
 */

export interface EcritureTiers {
  journalCode: string;
  entryNum: string;
  entryDate: Date;
  accountCode: string;
  auxAccountCode: string | null;
  auxAccountLabel: string | null;
  pieceDate: Date | null;
  debit: number;
  credit: number;
  lettering: string | null;
}

export type SensTiers = "CLIENT" | "FOURNISSEUR";

/**
 * Délai de paiement au-delà duquel une facture est considérée en retard.
 * 30 jours est le délai supplétif du code de commerce (art. L441-10) faute de
 * convention contraire ; il est paramétrable parce que 45 jours fin de mois et
 * 60 jours nets sont tout aussi courants.
 */
export const DELAI_PAIEMENT_DEFAUT_JOURS = 30;

export interface TrancheAge {
  id: string;
  label: string;
  /** Âge minimal, en jours révolus depuis la date de pièce. */
  min: number;
  /** Âge maximal inclus, ou null pour la dernière tranche. */
  max: number | null;
  montant: number;
  part: number | null;
}

export interface LigneTiers {
  code: string;
  label: string;
  encours: number;
  /** Part de l'encours total du même sens. */
  part: number | null;
  /** Âge moyen de l'encours, pondéré par les montants. */
  ageMoyen: number | null;
  /** Fraction de l'encours dépassant le délai de paiement retenu. */
  enRetard: number;
  /** Âge de la pièce la plus ancienne encore ouverte. */
  ageMaximal: number | null;
}

export interface BalanceAgee {
  sens: SensTiers;
  dateReference: string;
  delaiPaiementJours: number;
  encoursTotal: number;
  encoursEnRetard: number;
  /**
   * Âge moyen de l'encours pondéré par les montants. Contrairement au DSO
   * calculé en rapportant l'encours au chiffre d'affaires, il ne souffre
   * d'aucun biais de TVA : il se lit directement sur les pièces ouvertes.
   */
  ageMoyenPondere: number | null;
  tranches: TrancheAge[];
  tiers: LigneTiers[];
  /** Écritures sans compte auxiliaire, regroupées faute de tiers identifiable. */
  sansTiers: number;
}

export interface LigneConcentration {
  code: string;
  label: string;
  montant: number;
  part: number | null;
}

export interface Concentration {
  sens: SensTiers;
  total: number;
  tiers: LigneConcentration[];
  /** Part du premier tiers, des trois premiers, des dix premiers. */
  partPremier: number | null;
  partTroisPremiers: number | null;
  partDixPremiers: number | null;
  /**
   * Indice de Herfindahl-Hirschman (somme des carrés des parts), entre 0 et 1.
   * Au-delà de 0,25, le portefeuille est considéré comme concentré.
   */
  herfindahl: number | null;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

function joursEntre(debut: Date, fin: Date): number {
  return Math.floor((fin.getTime() - debut.getTime()) / JOUR_MS);
}

function arrondi(valeur: number): number {
  const arrondie = Math.round(valeur * 100) / 100;
  return arrondie === 0 ? 0 : arrondie;
}

function part(valeur: number, total: number): number | null {
  return total === 0 ? null : valeur / total;
}

/** Comptes de tiers : 41x pour les clients, 40x pour les fournisseurs. */
function estCompteDeTiers(accountCode: string, sens: SensTiers): boolean {
  return accountCode.startsWith(sens === "CLIENT" ? "41" : "40");
}

/**
 * Solde d'une écriture dans le sens naturel du tiers : une créance client est
 * débitrice, une dette fournisseur créditrice. Le résultat est donc positif
 * pour un encours normal, et négatif pour un avoir ou un acompte.
 */
function soldeTiers(ecriture: EcritureTiers, sens: SensTiers): number {
  return sens === "CLIENT" ? ecriture.debit - ecriture.credit : ecriture.credit - ecriture.debit;
}

const TRANCHES_MODELE: Array<Omit<TrancheAge, "montant" | "part">> = [
  { id: "0_30", label: "Moins de 30 jours", min: 0, max: 30 },
  { id: "31_60", label: "31 à 60 jours", min: 31, max: 60 },
  { id: "61_90", label: "61 à 90 jours", min: 61, max: 90 },
  { id: "90_plus", label: "Plus de 90 jours", min: 91, max: null },
];

export function computeBalanceAgee(
  ecritures: EcritureTiers[],
  sens: SensTiers,
  dateReference: Date,
  delaiPaiementJours: number = DELAI_PAIEMENT_DEFAUT_JOURS
): BalanceAgee {
  const tranches: TrancheAge[] = TRANCHES_MODELE.map((modele) => ({ ...modele, montant: 0, part: null }));

  const parTiers = new Map<
    string,
    { label: string; encours: number; sommePonderee: number; enRetard: number; ageMaximal: number | null }
  >();

  let encoursTotal = 0;
  let sommePondereeGlobale = 0;
  let encoursEnRetard = 0;
  let sansTiers = 0;

  for (const ecriture of ecritures) {
    // Une écriture lettrée est réglée : elle ne fait plus partie de l'encours.
    if (ecriture.lettering) continue;
    if (!estCompteDeTiers(ecriture.accountCode, sens)) continue;

    const solde = soldeTiers(ecriture, sens);
    if (solde === 0) continue;

    // La date de pièce est la date de la facture ; la date d'écriture n'est
    // que celle de la saisie, souvent postérieure de plusieurs jours.
    const dateOrigine = ecriture.pieceDate ?? ecriture.entryDate;
    const age = Math.max(0, joursEntre(dateOrigine, dateReference));

    encoursTotal += solde;
    sommePondereeGlobale += solde * age;
    if (age > delaiPaiementJours) encoursEnRetard += solde;

    const tranche = tranches.find((t) => age >= t.min && (t.max === null || age <= t.max));
    if (tranche) tranche.montant += solde;

    if (!ecriture.auxAccountCode) {
      sansTiers += solde;
      continue;
    }

    const existant = parTiers.get(ecriture.auxAccountCode);
    if (existant) {
      existant.encours += solde;
      existant.sommePonderee += solde * age;
      if (age > delaiPaiementJours) existant.enRetard += solde;
      existant.ageMaximal = Math.max(existant.ageMaximal ?? 0, age);
    } else {
      parTiers.set(ecriture.auxAccountCode, {
        label: ecriture.auxAccountLabel ?? ecriture.auxAccountCode,
        encours: solde,
        sommePonderee: solde * age,
        enRetard: age > delaiPaiementJours ? solde : 0,
        ageMaximal: age,
      });
    }
  }

  const tiers: LigneTiers[] = [...parTiers.entries()]
    .map(([code, valeurs]) => ({
      code,
      label: valeurs.label,
      encours: arrondi(valeurs.encours),
      part: part(valeurs.encours, encoursTotal),
      // L'âge moyen n'a de sens que sur un encours positif : un solde
      // créditeur de client (acompte) fausserait la pondération.
      ageMoyen: valeurs.encours > 0 ? valeurs.sommePonderee / valeurs.encours : null,
      enRetard: arrondi(valeurs.enRetard),
      ageMaximal: valeurs.ageMaximal,
    }))
    .sort((a, b) => b.encours - a.encours);

  return {
    sens,
    dateReference: dateReference.toISOString(),
    delaiPaiementJours,
    encoursTotal: arrondi(encoursTotal),
    encoursEnRetard: arrondi(encoursEnRetard),
    ageMoyenPondere: encoursTotal > 0 ? sommePondereeGlobale / encoursTotal : null,
    tranches: tranches.map((tranche) => ({
      ...tranche,
      montant: arrondi(tranche.montant),
      part: part(tranche.montant, encoursTotal),
    })),
    tiers,
    sansTiers: arrondi(sansTiers),
  };
}

/**
 * Préfixes des comptes de produits et de charges retenus pour reconstituer la
 * facturation hors taxes attribuable à un tiers.
 */
const PREFIXES_PRODUIT = ["70", "71", "72", "74", "75"];
const PREFIXES_CHARGE = ["60", "61", "62"];

/**
 * Reconstitue le montant hors taxes facturé par tiers.
 *
 * Le compte auxiliaire n'est porté que par la ligne de tiers (411 ou 401) ;
 * le montant hors taxes, lui, est sur les lignes de produit ou de charge de la
 * même écriture. On rapproche les deux par (journal, numéro d'écriture) — la
 * clé qui identifie une écriture comptable — plutôt que de retenir le montant
 * TTC de la ligne de tiers, qui mélangerait la TVA au chiffre d'affaires.
 */
export function computeConcentration(ecritures: EcritureTiers[], sens: SensTiers): Concentration {
  const prefixes = sens === "CLIENT" ? PREFIXES_PRODUIT : PREFIXES_CHARGE;

  interface Groupe {
    tiersCode: string | null;
    tiersLabel: string | null;
    montantHt: number;
  }
  const groupes = new Map<string, Groupe>();

  for (const ecriture of ecritures) {
    const cle = `${ecriture.journalCode}#${ecriture.entryNum}#${ecriture.entryDate.toISOString()}`;
    let groupe = groupes.get(cle);
    if (!groupe) {
      groupe = { tiersCode: null, tiersLabel: null, montantHt: 0 };
      groupes.set(cle, groupe);
    }

    if (estCompteDeTiers(ecriture.accountCode, sens) && ecriture.auxAccountCode) {
      groupe.tiersCode = ecriture.auxAccountCode;
      groupe.tiersLabel = ecriture.auxAccountLabel ?? ecriture.auxAccountCode;
    }

    if (prefixes.some((prefixe) => ecriture.accountCode.startsWith(prefixe))) {
      groupe.montantHt +=
        sens === "CLIENT" ? ecriture.credit - ecriture.debit : ecriture.debit - ecriture.credit;
    }
  }

  const parTiers = new Map<string, { label: string; montant: number }>();
  let total = 0;

  for (const groupe of groupes.values()) {
    if (!groupe.tiersCode || groupe.montantHt === 0) continue;
    total += groupe.montantHt;
    const existant = parTiers.get(groupe.tiersCode);
    if (existant) {
      existant.montant += groupe.montantHt;
    } else {
      parTiers.set(groupe.tiersCode, {
        label: groupe.tiersLabel ?? groupe.tiersCode,
        montant: groupe.montantHt,
      });
    }
  }

  const tiers: LigneConcentration[] = [...parTiers.entries()]
    .map(([code, valeurs]) => ({
      code,
      label: valeurs.label,
      montant: arrondi(valeurs.montant),
      part: part(valeurs.montant, total),
    }))
    .sort((a, b) => b.montant - a.montant);

  const cumul = (n: number) =>
    part(
      tiers.slice(0, n).reduce((somme, ligne) => somme + ligne.montant, 0),
      total
    );

  const herfindahl =
    total > 0
      ? tiers.reduce((somme, ligne) => somme + Math.pow(ligne.montant / total, 2), 0)
      : null;

  return {
    sens,
    total: arrondi(total),
    tiers,
    partPremier: tiers.length > 0 ? cumul(1) : null,
    partTroisPremiers: tiers.length > 0 ? cumul(3) : null,
    partDixPremiers: tiers.length > 0 ? cumul(10) : null,
    herfindahl,
  };
}
