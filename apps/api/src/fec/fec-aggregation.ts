/**
 * Dérivation des agrégats mensuels à partir d'écritures comptables.
 *
 * C'est ici que se joue la différence entre un compte de résultat et un
 * bilan, et c'est la seule subtilité réelle du passage « écritures → postes » :
 *
 *   - un poste de résultat (classes 6 et 7) est un *flux* : le montant du mois
 *     de mars, c'est ce qui a été mouvementé en mars ;
 *   - un poste de bilan (classes 1 à 5) est un *stock* : le montant au
 *     31 mars, c'est le cumul de tout ce qui a été mouvementé depuis
 *     l'ouverture de l'exercice, à-nouveaux compris.
 *
 * Confondre les deux donne un bilan qui ne s'équilibre jamais et des ratios de
 * structure absurdes ; c'est l'erreur classique des imports maison.
 *
 * Module pur : ni NestJS, ni Prisma, ni accès disque.
 */

import { LinePoste } from "@prisma/client";
import { computeDerived, type Aggregates } from "../ratios/engine";
import { suggestPoste } from "../import/pcg-mapping";

export interface EcritureAgregable {
  entryDate: Date;
  accountCode: string;
  accountLabel: string;
  debit: number;
  credit: number;
}

/**
 * Sens naturel de chaque poste : celui dans lequel un solde normal est
 * positif. Le solde retenu vaut débit − crédit pour un poste débiteur, et
 * crédit − débit pour un poste créditeur, de sorte que tous les montants
 * remis au moteur de ratios soient positifs — ce que suppose sa convention de
 * signe (cf. l'en-tête de ratios/engine.ts).
 */
export const SENS_POSTE: Record<LinePoste, "DEBIT" | "CREDIT"> = {
  // Charges : débitrices.
  ACHATS_CONSOMMES: "DEBIT",
  CHARGES_EXTERNES: "DEBIT",
  CHARGES_PERSONNEL: "DEBIT",
  IMPOTS_TAXES: "DEBIT",
  DOTATIONS_AMORTISSEMENTS: "DEBIT",
  CHARGES_FINANCIERES: "DEBIT",
  IMPOT_SOCIETES: "DEBIT",
  // Produits : créditeurs.
  CHIFFRE_AFFAIRES: "CREDIT",
  PRODUITS_FINANCIERS: "CREDIT",
  // Soldes nets (produits moins charges), donc créditeurs par convention :
  // le poste regroupe des comptes des deux sens et le signe du résultat est
  // porteur d'information.
  AUTRES_PRODUITS_CHARGES_EXPLOITATION: "CREDIT",
  RESULTAT_EXCEPTIONNEL: "CREDIT",
  // Actif : débiteur. Les comptes d'amortissement et de dépréciation, rangés
  // sous le même poste que le brut, sont créditeurs : le solde obtenu est
  // donc la valeur nette, ce qui est exactement ce qu'on veut au bilan.
  STOCKS: "DEBIT",
  CREANCES_CLIENTS: "DEBIT",
  AUTRES_CREANCES: "DEBIT",
  DISPONIBILITES: "DEBIT",
  IMMOBILISATIONS: "DEBIT",
  // Passif : créditeur.
  CAPITAUX_PROPRES: "CREDIT",
  DETTES_FINANCIERES: "CREDIT",
  DETTES_FOURNISSEURS: "CREDIT",
  AUTRES_DETTES: "CREDIT",
};

/**
 * Postes de résultat. Tout le reste est un poste de bilan — l'énumération est
 * exhaustive et vérifiée par le typage, donc ajouter un poste sans trancher sa
 * nature ne compile pas.
 */
export const POSTES_RESULTAT: ReadonlySet<LinePoste> = new Set<LinePoste>([
  LinePoste.CHIFFRE_AFFAIRES,
  LinePoste.ACHATS_CONSOMMES,
  LinePoste.CHARGES_EXTERNES,
  LinePoste.CHARGES_PERSONNEL,
  LinePoste.IMPOTS_TAXES,
  LinePoste.DOTATIONS_AMORTISSEMENTS,
  LinePoste.AUTRES_PRODUITS_CHARGES_EXPLOITATION,
  LinePoste.CHARGES_FINANCIERES,
  LinePoste.PRODUITS_FINANCIERS,
  LinePoste.RESULTAT_EXCEPTIONNEL,
  LinePoste.IMPOT_SOCIETES,
]);

export function estPosteResultat(poste: LinePoste): boolean {
  return POSTES_RESULTAT.has(poste);
}

/**
 * Compte de résultat de l'exercice en cours, injecté aux capitaux propres.
 *
 * Pendant l'exercice, le compte 120 « Résultat de l'exercice » est vide : le
 * résultat n'est constaté qu'à la clôture. Un bilan mensuel dérivé d'un FEC ne
 * s'équilibre donc jamais si on ne l'ajoute pas soi-même aux capitaux propres.
 * C'est ce que fait tout logiciel de situation intermédiaire, et c'est ce que
 * fait cette ligne synthétique.
 */
export const COMPTE_RESULTAT_EN_COURS = "120000";
export const LIBELLE_RESULTAT_EN_COURS = "Résultat de l'exercice (en cours)";

export interface LigneAgregee {
  accountCode: string;
  label: string;
  /** Solde, exprimé dans le sens naturel du poste (donc normalement positif). */
  amount: number;
  poste: LinePoste;
}

export interface PeriodeMensuelle {
  /** Clé triable, « 2026-03 ». */
  cle: string;
  /** Libellé affiché, « Mars 2026 ». */
  label: string;
  debut: Date;
  fin: Date;
  lignes: LigneAgregee[];
  agregats: Aggregates;
}

export interface CompteNonClasse {
  accountCode: string;
  label: string;
  /** Mouvement cumulé sur l'exercice, en valeur absolue. */
  mouvement: number;
}

export interface ResultatAgregation {
  periodes: PeriodeMensuelle[];
  /**
   * Comptes qu'aucun préfixe du plan comptable ne rattache à un poste. Leur
   * montant est absent de tous les calculs : c'est le premier contrôle de
   * qualité à présenter à l'utilisateur après un import.
   */
  comptesNonClasses: CompteNonClasse[];
}

const MOIS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function cleMois(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function libelleMois(date: Date): string {
  return `${MOIS_FR[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function debutDuMois(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function finDuMois(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function agregatsVides(): Aggregates {
  return {
    chiffreAffaires: 0,
    achatsConsommes: 0,
    chargesExternes: 0,
    chargesPersonnel: 0,
    impotsTaxes: 0,
    dotationsAmortissements: 0,
    autresProduitsChargesExploitation: 0,
    chargesFinancieres: 0,
    produitsFinanciers: 0,
    resultatExceptionnel: 0,
    impotSocietes: 0,
    stocks: 0,
    creancesClients: 0,
    autresCreances: 0,
    disponibilites: 0,
    capitauxPropres: 0,
    dettesFinancieres: 0,
    dettesFournisseurs: 0,
    autresDettes: 0,
    immobilisations: 0,
  };
}

const CLE_AGREGAT: Record<LinePoste, keyof Aggregates> = {
  CHIFFRE_AFFAIRES: "chiffreAffaires",
  ACHATS_CONSOMMES: "achatsConsommes",
  CHARGES_EXTERNES: "chargesExternes",
  CHARGES_PERSONNEL: "chargesPersonnel",
  IMPOTS_TAXES: "impotsTaxes",
  DOTATIONS_AMORTISSEMENTS: "dotationsAmortissements",
  AUTRES_PRODUITS_CHARGES_EXPLOITATION: "autresProduitsChargesExploitation",
  CHARGES_FINANCIERES: "chargesFinancieres",
  PRODUITS_FINANCIERS: "produitsFinanciers",
  RESULTAT_EXCEPTIONNEL: "resultatExceptionnel",
  IMPOT_SOCIETES: "impotSocietes",
  STOCKS: "stocks",
  CREANCES_CLIENTS: "creancesClients",
  AUTRES_CREANCES: "autresCreances",
  DISPONIBILITES: "disponibilites",
  CAPITAUX_PROPRES: "capitauxPropres",
  DETTES_FINANCIERES: "dettesFinancieres",
  DETTES_FOURNISSEURS: "dettesFournisseurs",
  AUTRES_DETTES: "autresDettes",
  IMMOBILISATIONS: "immobilisations",
};

/** Arrondi au centime, pour que des sommes de flottants restent comparables. */
function auCentime(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

interface SoldeCompte {
  label: string;
  poste: LinePoste;
  debit: number;
  credit: number;
}

/**
 * Découpe un exercice en périodes mensuelles et calcule, pour chacune, le
 * solde de chaque compte selon sa nature.
 *
 * Les mois sans aucune écriture sont tout de même produits dès lors qu'ils
 * tombent entre le premier et le dernier mouvement : un mois creux au milieu
 * d'un exercice est une information, et son bilan, lui, n'est pas vide.
 */
export function agregerParMois(ecritures: EcritureAgregable[]): ResultatAgregation {
  if (ecritures.length === 0) {
    return { periodes: [], comptesNonClasses: [] };
  }

  const triees = [...ecritures].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  const premier = debutDuMois(triees[0].entryDate);
  const dernier = debutDuMois(triees[triees.length - 1].entryDate);

  // Mouvements par mois puis par compte.
  const parMois = new Map<string, Map<string, SoldeCompte>>();
  const nonClasses = new Map<string, CompteNonClasse>();

  for (const ecriture of triees) {
    const poste = suggestPoste(ecriture.accountCode);
    if (!poste) {
      const existant = nonClasses.get(ecriture.accountCode);
      const mouvement = Math.abs(ecriture.debit) + Math.abs(ecriture.credit);
      if (existant) {
        existant.mouvement = auCentime(existant.mouvement + mouvement);
      } else {
        nonClasses.set(ecriture.accountCode, {
          accountCode: ecriture.accountCode,
          label: ecriture.accountLabel,
          mouvement: auCentime(mouvement),
        });
      }
      continue;
    }

    const cle = cleMois(ecriture.entryDate);
    let comptes = parMois.get(cle);
    if (!comptes) {
      comptes = new Map<string, SoldeCompte>();
      parMois.set(cle, comptes);
    }

    let solde = comptes.get(ecriture.accountCode);
    if (!solde) {
      solde = { label: ecriture.accountLabel, poste, debit: 0, credit: 0 };
      comptes.set(ecriture.accountCode, solde);
    }
    solde.debit += ecriture.debit;
    solde.credit += ecriture.credit;
  }

  // Cumuls glissants : les comptes de bilan pour le stock, et les postes de
  // résultat pour le résultat couru porté aux capitaux propres.
  const cumulBilan = new Map<string, SoldeCompte>();
  const cumulResultat = agregatsVides();
  const periodes: PeriodeMensuelle[] = [];

  const curseur = new Date(premier);
  while (curseur.getTime() <= dernier.getTime()) {
    const cle = cleMois(curseur);
    const mouvementsDuMois = parMois.get(cle) ?? new Map<string, SoldeCompte>();

    for (const [code, mouvement] of mouvementsDuMois) {
      if (estPosteResultat(mouvement.poste)) continue;
      const cumul = cumulBilan.get(code);
      if (cumul) {
        cumul.debit += mouvement.debit;
        cumul.credit += mouvement.credit;
      } else {
        cumulBilan.set(code, { ...mouvement });
      }
    }

    const lignes: LigneAgregee[] = [];
    const agregats = agregatsVides();

    const ajouter = (accountCode: string, solde: SoldeCompte) => {
      const brut =
        SENS_POSTE[solde.poste] === "DEBIT" ? solde.debit - solde.credit : solde.credit - solde.debit;
      const montant = auCentime(brut);
      // Un compte soldé à zéro sur la période n'apporte rien à la lecture.
      if (montant === 0) return;
      lignes.push({ accountCode, label: solde.label, amount: montant, poste: solde.poste });
      agregats[CLE_AGREGAT[solde.poste]] = auCentime(agregats[CLE_AGREGAT[solde.poste]] + montant);
    };

    // Résultat : uniquement les mouvements du mois.
    for (const [code, solde] of mouvementsDuMois) {
      if (!estPosteResultat(solde.poste)) continue;
      ajouter(code, solde);
      cumulResultat[CLE_AGREGAT[solde.poste]] +=
        SENS_POSTE[solde.poste] === "DEBIT" ? solde.debit - solde.credit : solde.credit - solde.debit;
    }
    // Bilan : le cumul depuis l'ouverture.
    for (const [code, solde] of cumulBilan) {
      ajouter(code, solde);
    }

    // Résultat de l'exercice couru jusqu'à la fin de ce mois, porté aux
    // capitaux propres pour que le bilan s'équilibre. Le cumul des postes de
    // résultat est repassé au moteur plutôt que sommé ici, pour qu'il n'existe
    // qu'une seule définition du résultat net dans tout le projet.
    const resultatCourru = auCentime(computeDerived(cumulResultat).resultatNet);
    if (resultatCourru !== 0) {
      lignes.push({
        accountCode: COMPTE_RESULTAT_EN_COURS,
        label: LIBELLE_RESULTAT_EN_COURS,
        amount: resultatCourru,
        poste: LinePoste.CAPITAUX_PROPRES,
      });
      agregats.capitauxPropres = auCentime(agregats.capitauxPropres + resultatCourru);
    }

    periodes.push({
      cle,
      label: libelleMois(curseur),
      debut: debutDuMois(curseur),
      fin: finDuMois(curseur),
      lignes: lignes.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
      agregats,
    });

    curseur.setUTCMonth(curseur.getUTCMonth() + 1);
  }

  return {
    periodes,
    comptesNonClasses: [...nonClasses.values()].sort((a, b) => b.mouvement - a.mouvement),
  };
}
