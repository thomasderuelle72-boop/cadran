import { PrismaClient, LinePoste, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { computeAggregates, computeDerived, computeRatios, Aggregates } from "../src/ratios/engine";

const prisma = new PrismaClient();

// Trois trimestres démonstratifs avec une croissance progressive du CA et
// une trésorerie qui se tend légèrement — assez réaliste pour donner du
// relief aux graphiques de tendance du dashboard.
const DEMO_PERIODS: Array<{ label: string; start: string; end: string; lines: Array<[LinePoste, number]> }> = [
  {
    label: "T1 2026",
    start: "2026-01-01",
    end: "2026-03-31",
    lines: [
      [LinePoste.CHIFFRE_AFFAIRES, 420000],
      [LinePoste.ACHATS_CONSOMMES, 168000],
      [LinePoste.CHARGES_EXTERNES, 62000],
      [LinePoste.CHARGES_PERSONNEL, 110000],
      [LinePoste.IMPOTS_TAXES, 9000],
      [LinePoste.DOTATIONS_AMORTISSEMENTS, 14000],
      [LinePoste.CHARGES_FINANCIERES, 4200],
      [LinePoste.PRODUITS_FINANCIERS, 300],
      [LinePoste.IMPOT_SOCIETES, 9500],
      [LinePoste.STOCKS, 58000],
      [LinePoste.CREANCES_CLIENTS, 96000],
      [LinePoste.DISPONIBILITES, 74000],
      [LinePoste.DETTES_FOURNISSEURS, 51000],
      [LinePoste.AUTRES_DETTES, 21000],
      [LinePoste.CAPITAUX_PROPRES, 260000],
      [LinePoste.DETTES_FINANCIERES, 140000],
      [LinePoste.IMMOBILISATIONS, 210000],
    ],
  },
  {
    label: "T2 2026",
    start: "2026-04-01",
    end: "2026-06-30",
    lines: [
      [LinePoste.CHIFFRE_AFFAIRES, 468000],
      [LinePoste.ACHATS_CONSOMMES, 191000],
      [LinePoste.CHARGES_EXTERNES, 65000],
      [LinePoste.CHARGES_PERSONNEL, 118000],
      [LinePoste.IMPOTS_TAXES, 9600],
      [LinePoste.DOTATIONS_AMORTISSEMENTS, 14500],
      [LinePoste.CHARGES_FINANCIERES, 4600],
      [LinePoste.PRODUITS_FINANCIERS, 250],
      [LinePoste.IMPOT_SOCIETES, 10800],
      [LinePoste.STOCKS, 66000],
      [LinePoste.CREANCES_CLIENTS, 104000],
      [LinePoste.DISPONIBILITES, 61000],
      [LinePoste.DETTES_FOURNISSEURS, 55000],
      [LinePoste.AUTRES_DETTES, 22000],
      [LinePoste.CAPITAUX_PROPRES, 274000],
      [LinePoste.DETTES_FINANCIERES, 148000],
      [LinePoste.IMMOBILISATIONS, 215000],
    ],
  },
  {
    label: "T3 2026",
    start: "2026-07-01",
    end: "2026-09-30",
    lines: [
      [LinePoste.CHIFFRE_AFFAIRES, 512000],
      [LinePoste.ACHATS_CONSOMMES, 214000],
      [LinePoste.CHARGES_EXTERNES, 69000],
      [LinePoste.CHARGES_PERSONNEL, 126000],
      [LinePoste.IMPOTS_TAXES, 10100],
      [LinePoste.DOTATIONS_AMORTISSEMENTS, 15200],
      [LinePoste.CHARGES_FINANCIERES, 5100],
      [LinePoste.PRODUITS_FINANCIERS, 200],
      [LinePoste.IMPOT_SOCIETES, 11200],
      [LinePoste.STOCKS, 79000],
      [LinePoste.CREANCES_CLIENTS, 118000],
      [LinePoste.DISPONIBILITES, 42000],
      [LinePoste.DETTES_FOURNISSEURS, 58000],
      [LinePoste.AUTRES_DETTES, 23500],
      [LinePoste.CAPITAUX_PROPRES, 289000],
      [LinePoste.DETTES_FINANCIERES, 156000],
      [LinePoste.IMMOBILISATIONS, 221000],
    ],
  },
];

async function main() {
  const email = "demo@cadran.fr";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Le jeu de données de démonstration existe déjà — rien à faire.");
    return;
  }

  const organization = await prisma.organization.create({
    data: { name: "Atelier Nova SAS", sector: "Industrie manufacturière", currency: "EUR" },
  });

  const passwordHash = await bcrypt.hash("CadranDemo123!", 10);
  await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Camille Berthier",
      email,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  let previousAggregates: Aggregates | null = null;

  for (const demo of DEMO_PERIODS) {
    const period = await prisma.accountingPeriod.create({
      data: {
        organizationId: organization.id,
        label: demo.label,
        startDate: new Date(demo.start),
        endDate: new Date(demo.end),
      },
    });

    await prisma.financialLineItem.createMany({
      data: demo.lines.map(([poste, amount], index) => ({
        periodId: period.id,
        accountCode: `${index + 1}`.padStart(3, "0"),
        label: poste,
        amount,
        poste,
      })),
    });

    const aggregates = computeAggregates(demo.lines.map(([poste, amount]) => ({ poste, amount })));
    const derived = computeDerived(aggregates);
    const ratios = computeRatios(aggregates, derived, previousAggregates ? { aggregates: previousAggregates } : null);
    previousAggregates = aggregates;

    await prisma.ratioResult.create({
      data: {
        periodId: period.id,
        aggregates: aggregates as unknown as object,
        derived: derived as unknown as object,
        ratios: ratios as unknown as object,
      },
    });

    console.log(`Période créée : ${demo.label}`);
  }

  console.log("\nCompte de démonstration : demo@cadran.fr / CadranDemo123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
