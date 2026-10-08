import { LinePoste, Prisma, PrismaClient } from "@prisma/client";
import { computeAggregates, computeDerived, computeRatios, Aggregates } from "../ratios/engine";

/**
 * Le dossier de test : une entreprise fictive, complète, à jeter.
 *
 * Il existe pour qu'on puisse essayer l'outil — changer des hypothèses,
 * recomposer un tableau de bord, poser une question au conseiller — sans
 * toucher à un dossier réel ni à la démonstration montrée aux prospects.
 *
 * **Il est volontairement en difficulté.** Un dossier de test en bonne santé
 * ne teste rien : les alertes restent muettes, le diagnostic affiche du vert,
 * le conseiller n'a rien à dire. Bastide Confection perd de l'argent deux
 * exercices de suite, voit son délai client passer de 44 à 65 jours, gonfle
 * ses stocks, étire ses fournisseurs, et ne tient que grâce à un apport du
 * dirigeant en 2024. C'est là que l'outil doit être jugé.
 *
 * Les données vivent ici, dans le code de l'API, et non dans le script qui
 * les écrivait : un script ne s'exécute pas sur un serveur déployé, et c'est
 * précisément là qu'on a besoin d'un dossier d'essai. La console
 * d'administration et le script en ligne de commande appellent tous deux
 * `construireDossierTest`.
 */

export const NOM_DOSSIER = "Bastide Confection SARL — TEST";

/** Le client Prisma tel qu'on le reçoit dans une transaction. */
export type PrismaTransaction = Prisma.TransactionClient;

/** Les postes du compte de résultat d'un exercice. */
interface Exploitation {
  chiffreAffaires: number;
  achatsConsommes: number;
  chargesExternes: number;
  chargesPersonnel: number;
  impotsTaxes: number;
  dotationsAmortissements: number;
  chargesFinancieres: number;
}

/** Les postes de bilan, trésorerie exceptée : c'est elle qui ajuste. */
interface Bilan {
  immobilisations: number;
  stocks: number;
  creancesClients: number;
  autresCreances: number;
  capitauxPropres: number;
  dettesFinancieres: number;
  dettesFournisseurs: number;
  autresDettes: number;
}

interface ExerciceTest {
  label: string;
  debut: string;
  fin: string;
  exploitation: Exploitation;
  bilan: Bilan;
  /** Impôt sur les sociétés ; nul sur un exercice déficitaire. */
  impotSocietes: number;
  /** Budget voté, pour donner matière à l'écran des écarts. */
  budget?: [LinePoste, number][];
}

const TAUX_IS = 0.25;

/**
 * Résultat avant impôt, pour vérifier que l'IS saisi est cohérent.
 *
 * Un IS positif sur un exercice déficitaire passerait inaperçu dans un
 * tableau de chiffres et fausserait la capacité d'autofinancement, donc le
 * point de départ du prévisionnel.
 */
export function resultatAvantImpot(e: Exploitation): number {
  return (
    e.chiffreAffaires -
    e.achatsConsommes -
    e.chargesExternes -
    e.chargesPersonnel -
    e.impotsTaxes -
    e.dotationsAmortissements -
    e.chargesFinancieres
  );
}

/**
 * Les lignes d'un exercice, trésorerie calculée en ajustement.
 *
 * La trésorerie n'est pas saisie mais déduite : c'est le seul moyen d'être
 * certain que le bilan s'équilibre. Un dossier de test dont le bilan ne
 * boucle pas enverrait chercher un bogue là où il n'y en a pas.
 */
export function lignes(exercice: ExerciceTest): [LinePoste, number][] {
  const { bilan } = exercice;
  const passif =
    bilan.capitauxPropres + bilan.dettesFinancieres + bilan.dettesFournisseurs + bilan.autresDettes;
  const actifHorsTresorerie =
    bilan.immobilisations + bilan.stocks + bilan.creancesClients + bilan.autresCreances;
  const disponibilites = passif - actifHorsTresorerie;

  if (disponibilite_invalide(disponibilites)) {
    throw new Error(
      `${exercice.label} : la trésorerie d'ajustement vaut ${disponibilites} €. ` +
        `Un dossier de test doit rester lisible — reprenez les postes de bilan.`
    );
  }

  const attendu = resultatAvantImpot(exercice.exploitation);
  if (attendu <= 0 && exercice.impotSocietes !== 0) {
    throw new Error(`${exercice.label} : exercice déficitaire, l'IS doit être nul.`);
  }
  if (attendu > 0 && Math.abs(exercice.impotSocietes - attendu * TAUX_IS) > 1) {
    throw new Error(
      `${exercice.label} : IS de ${exercice.impotSocietes} € pour un résultat avant impôt ` +
        `de ${Math.round(attendu)} € — attendu ${Math.round(attendu * TAUX_IS)} €.`
    );
  }

  return [
    [LinePoste.CHIFFRE_AFFAIRES, exercice.exploitation.chiffreAffaires],
    [LinePoste.ACHATS_CONSOMMES, exercice.exploitation.achatsConsommes],
    [LinePoste.CHARGES_EXTERNES, exercice.exploitation.chargesExternes],
    [LinePoste.CHARGES_PERSONNEL, exercice.exploitation.chargesPersonnel],
    [LinePoste.IMPOTS_TAXES, exercice.exploitation.impotsTaxes],
    [LinePoste.DOTATIONS_AMORTISSEMENTS, exercice.exploitation.dotationsAmortissements],
    [LinePoste.CHARGES_FINANCIERES, exercice.exploitation.chargesFinancieres],
    [LinePoste.IMPOT_SOCIETES, exercice.impotSocietes],
    [LinePoste.STOCKS, bilan.stocks],
    [LinePoste.CREANCES_CLIENTS, bilan.creancesClients],
    [LinePoste.AUTRES_CREANCES, bilan.autresCreances],
    [LinePoste.DISPONIBILITES, disponibilites],
    [LinePoste.DETTES_FOURNISSEURS, bilan.dettesFournisseurs],
    [LinePoste.AUTRES_DETTES, bilan.autresDettes],
    [LinePoste.CAPITAUX_PROPRES, bilan.capitauxPropres],
    [LinePoste.DETTES_FINANCIERES, bilan.dettesFinancieres],
    [LinePoste.IMMOBILISATIONS, bilan.immobilisations],
  ];
}

/**
 * Une trésorerie négative est possible dans la vraie vie — c'est un découvert.
 * Dans un dossier de test, elle brouille la lecture de tout le reste : on
 * préfère la refuser à la construction.
 */
function disponibilite_invalide(valeur: number): boolean {
  return valeur < 0;
}

/**
 * Quatre exercices, et une trajectoire.
 *
 * 2022 : marge correcte, trésorerie déjà courte.
 * 2023 : la marge se tasse, les stocks gonflent, premier déficit.
 * 2024 : l'année noire — 75 k€ de perte, DSO à 65 jours, et un apport de
 *        60 k€ du dirigeant sans lequel la trésorerie passait sous zéro.
 * 2025 : les charges sont reprises en main, le résultat repasse au vert de
 *        justesse, les délais commencent à redescendre.
 */
const EXERCICES: ExerciceTest[] = [
  {
    label: "Exercice 2022",
    debut: "2022-01-01",
    fin: "2022-12-31",
    exploitation: {
      chiffreAffaires: 980000,
      achatsConsommes: 480200,
      chargesExternes: 142000,
      chargesPersonnel: 268000,
      impotsTaxes: 9800,
      dotationsAmortissements: 38000,
      chargesFinancieres: 9600,
    },
    impotSocietes: 8100,
    bilan: {
      immobilisations: 310000,
      stocks: 92000,
      creancesClients: 118000,
      autresCreances: 21000,
      capitauxPropres: 295000,
      dettesFinancieres: 180000,
      dettesFournisseurs: 72000,
      autresDettes: 19000,
    },
  },
  {
    label: "Exercice 2023",
    debut: "2023-01-01",
    fin: "2023-12-31",
    exploitation: {
      chiffreAffaires: 962000,
      achatsConsommes: 491000,
      chargesExternes: 151000,
      chargesPersonnel: 279000,
      impotsTaxes: 10100,
      dotationsAmortissements: 41000,
      chargesFinancieres: 11200,
    },
    impotSocietes: 0,
    bilan: {
      immobilisations: 298000,
      stocks: 104000,
      creancesClients: 139000,
      autresCreances: 22000,
      // 295 000 - 21 300 de perte.
      capitauxPropres: 273700,
      // Un découvert transformé en concours bancaire : la dette monte alors
      // que l'exercice est déficitaire, ce qui est exactement le signal.
      dettesFinancieres: 190000,
      dettesFournisseurs: 85000,
      autresDettes: 21000,
    },
  },
  {
    label: "Exercice 2024",
    debut: "2024-01-01",
    fin: "2024-12-31",
    exploitation: {
      chiffreAffaires: 905000,
      achatsConsommes: 471000,
      chargesExternes: 156000,
      chargesPersonnel: 285000,
      impotsTaxes: 10400,
      dotationsAmortissements: 43000,
      chargesFinancieres: 14800,
    },
    impotSocietes: 0,
    bilan: {
      immobilisations: 272000,
      stocks: 118000,
      creancesClients: 161000,
      autresCreances: 23000,
      // 273 700 - 75 200 de perte + 60 000 d'apport du dirigeant.
      capitauxPropres: 258500,
      dettesFinancieres: 215000,
      dettesFournisseurs: 102000,
      autresDettes: 24000,
    },
    budget: [
      // Le budget a été voté sur la tendance de 2023, avant que l'exercice ne
      // tourne mal : l'écart budgétaire est donc massif, et c'est le but.
      [LinePoste.CHIFFRE_AFFAIRES, 985000],
      [LinePoste.ACHATS_CONSOMMES, 482000],
      [LinePoste.CHARGES_EXTERNES, 148000],
      [LinePoste.CHARGES_PERSONNEL, 278000],
    ],
  },
  {
    label: "Exercice 2025",
    debut: "2025-01-01",
    fin: "2025-12-31",
    exploitation: {
      chiffreAffaires: 948000,
      achatsConsommes: 455000,
      chargesExternes: 138000,
      chargesPersonnel: 268000,
      impotsTaxes: 10200,
      dotationsAmortissements: 41000,
      chargesFinancieres: 15600,
    },
    impotSocietes: 5050,
    bilan: {
      immobilisations: 248000,
      stocks: 101000,
      creancesClients: 142000,
      autresCreances: 22000,
      // 258 500 + 15 150 de bénéfice.
      capitauxPropres: 273650,
      dettesFinancieres: 196000,
      dettesFournisseurs: 94000,
      autresDettes: 23000,
    },
  },
];

export function joursEntreDates(debut: Date, fin: Date): number {
  return Math.round((fin.getTime() - debut.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/** Écrit l'entité, ses exercices et leurs ratios. Appelé dans une transaction. */
export async function construireDossierTest(
  prisma: PrismaTransaction,
  organizationId: string,
  journal: (ligne: string) => void = () => {}
) {
  const entite = await prisma.entity.create({
    data: {
      organizationId,
      name: NOM_DOSSIER,
      country: "France",
      currency: "EUR",
      fxRateToOrgCurrency: 1,
      // 1413Z : fabrication de vêtements de dessus.
      nafCode: "1413Z",
      headcount: 11,
    },
  });

  let precedent: Aggregates | null = null;

  for (const exercice of EXERCICES) {
    const periode = await prisma.accountingPeriod.create({
      data: {
        entityId: entite.id,
        label: exercice.label,
        startDate: new Date(exercice.debut),
        endDate: new Date(exercice.fin),
      },
    });

    const postes = lignes(exercice);

    await prisma.financialLineItem.createMany({
      data: postes.map(([poste, amount], index) => ({
        periodId: periode.id,
        accountCode: `${index + 1}`.padStart(3, "0"),
        label: poste,
        amount,
        poste,
      })),
    });

    if (exercice.budget) {
      await prisma.budgetLine.createMany({
        data: exercice.budget.map(([poste, amountBudgeted]) => ({
          periodId: periode.id,
          poste,
          amountBudgeted,
        })),
      });
    }

    const aggregates = computeAggregates(postes.map(([poste, amount]) => ({ poste, amount })));
    const derived = computeDerived(aggregates);
    const ratios = computeRatios(
      aggregates,
      derived,
      precedent ? { aggregates: precedent } : null,
      joursEntreDates(new Date(exercice.debut), new Date(exercice.fin))
    );
    precedent = aggregates;

    await prisma.ratioResult.create({
      data: {
        periodId: periode.id,
        aggregates: aggregates as unknown as object,
        derived: derived as unknown as object,
        ratios: ratios as unknown as object,
      },
    });

    const resultat = resultatAvantImpot(exercice.exploitation) - exercice.impotSocietes;
    const tresorerie = postes.find(([poste]) => poste === LinePoste.DISPONIBILITES)?.[1] ?? 0;
    journal(
      `${exercice.label} : résultat ${resultat.toLocaleString("fr-FR")} €, ` +
        `trésorerie ${tresorerie.toLocaleString("fr-FR")} €`
    );
  }

}

/**
 * Pose le dossier de test dans une organisation, en remplaçant celui qui y
 * serait déjà : on le recharge pour repartir de zéro après l'avoir modifié.
 *
 * Partagé par la console d'exploitation et par le bouton que voit
 * l'administrateur d'une organisation, pour qu'il n'existe qu'une façon de le
 * construire.
 */
export async function poserDossierTest(prisma: PrismaClient, organizationId: string) {
  const existant = await prisma.entity.findFirst({ where: { organizationId, name: NOM_DOSSIER } });
  await prisma.$transaction(
    async (tx) => {
      if (existant) await tx.entity.delete({ where: { id: existant.id } });
      await construireDossierTest(tx, organizationId);
    },
    { timeout: 60000 }
  );
  const cree = await prisma.entity.findFirstOrThrow({ where: { organizationId, name: NOM_DOSSIER } });
  return { id: cree.id, nom: NOM_DOSSIER, remplace: Boolean(existant) };
}
