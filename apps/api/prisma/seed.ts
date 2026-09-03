import { PrismaClient, LinePoste, Role, AlertOperator } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { computeAggregates, computeDerived, computeRatios, Aggregates } from "../src/ratios/engine";

const prisma = new PrismaClient();

interface DemoPeriod {
  label: string;
  start: string;
  end: string;
  lines: Array<[LinePoste, number]>;
  budget?: Array<[LinePoste, number]>;
}

interface DemoEntity {
  name: string;
  country: string;
  currency: string;
  fxRateToOrgCurrency: number;
  periods: DemoPeriod[];
}

// Deux entités du même groupe : la maison-mère française (données complètes
// sur 3 trimestres) et une filiale allemande facturant en USD, présente sur
// les deux premiers trimestres seulement — de quoi montrer une consolidation
// avec conversion de devise et un groupe partiellement peuplé.
const DEMO_ENTITIES: DemoEntity[] = [
  {
    name: "Atelier Nova SAS",
    country: "France",
    currency: "EUR",
    fxRateToOrgCurrency: 1,
    periods: [
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
        // Budget volontairement optimiste sur le CA et les achats : de quoi
        // faire apparaître un écart significatif dans la page Budget.
        budget: [
          [LinePoste.CHIFFRE_AFFAIRES, 540000],
          [LinePoste.ACHATS_CONSOMMES, 205000],
          [LinePoste.CHARGES_EXTERNES, 68000],
          [LinePoste.CHARGES_PERSONNEL, 126000],
        ],
      },
    ],
  },
  {
    name: "Atelier Nova GmbH",
    country: "Allemagne",
    currency: "USD",
    fxRateToOrgCurrency: 0.92,
    periods: [
      {
        label: "T1 2026",
        start: "2026-01-01",
        end: "2026-03-31",
        lines: [
          [LinePoste.CHIFFRE_AFFAIRES, 140000],
          [LinePoste.ACHATS_CONSOMMES, 58000],
          [LinePoste.CHARGES_EXTERNES, 21000],
          [LinePoste.CHARGES_PERSONNEL, 38000],
          [LinePoste.IMPOTS_TAXES, 3000],
          [LinePoste.DOTATIONS_AMORTISSEMENTS, 4000],
          [LinePoste.CHARGES_FINANCIERES, 1200],
          [LinePoste.IMPOT_SOCIETES, 3200],
          [LinePoste.STOCKS, 19000],
          [LinePoste.CREANCES_CLIENTS, 32000],
          [LinePoste.DISPONIBILITES, 21000],
          [LinePoste.DETTES_FOURNISSEURS, 17000],
          [LinePoste.CAPITAUX_PROPRES, 80000],
          [LinePoste.DETTES_FINANCIERES, 40000],
          [LinePoste.IMMOBILISATIONS, 65000],
        ],
      },
      {
        label: "T2 2026",
        start: "2026-04-01",
        end: "2026-06-30",
        lines: [
          [LinePoste.CHIFFRE_AFFAIRES, 152000],
          [LinePoste.ACHATS_CONSOMMES, 62000],
          [LinePoste.CHARGES_EXTERNES, 22000],
          [LinePoste.CHARGES_PERSONNEL, 40000],
          [LinePoste.IMPOTS_TAXES, 3100],
          [LinePoste.DOTATIONS_AMORTISSEMENTS, 4100],
          [LinePoste.CHARGES_FINANCIERES, 1300],
          [LinePoste.IMPOT_SOCIETES, 3600],
          [LinePoste.STOCKS, 21000],
          [LinePoste.CREANCES_CLIENTS, 35000],
          [LinePoste.DISPONIBILITES, 19000],
          [LinePoste.DETTES_FOURNISSEURS, 18000],
          [LinePoste.CAPITAUX_PROPRES, 86000],
          [LinePoste.DETTES_FINANCIERES, 41000],
          [LinePoste.IMMOBILISATIONS, 66000],
        ],
      },
    ],
  },
];

const DEMO_ALERT_RULES: Array<{ label: string; ratioId: string; operator: AlertOperator; threshold: number }> = [
  { label: "DSO au-delà de 60 jours", ratioId: "dso", operator: AlertOperator.GT, threshold: 60 },
  { label: "Liquidité générale sous 1,2", ratioId: "liquidite_generale", operator: AlertOperator.LT, threshold: 1.2 },
];

async function main() {
  const email = "demo@cadran.fr";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Le jeu de données de démonstration existe déjà — rien à faire.");
    return;
  }

  const organization = await prisma.organization.create({
    data: { name: "Atelier Nova Group", sector: "Industrie manufacturière", currency: "EUR" },
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

  for (const demoEntity of DEMO_ENTITIES) {
    const entity = await prisma.entity.create({
      data: {
        organizationId: organization.id,
        name: demoEntity.name,
        country: demoEntity.country,
        currency: demoEntity.currency,
        fxRateToOrgCurrency: demoEntity.fxRateToOrgCurrency,
      },
    });

    let previousAggregates: Aggregates | null = null;

    for (const demo of demoEntity.periods) {
      const period = await prisma.accountingPeriod.create({
        data: {
          entityId: entity.id,
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

      if (demo.budget) {
        await prisma.budgetLine.createMany({
          data: demo.budget.map(([poste, amountBudgeted]) => ({ periodId: period.id, poste, amountBudgeted })),
        });
      }

      const aggregates = computeAggregates(demo.lines.map(([poste, amount]) => ({ poste, amount })));
      const derived = computeDerived(aggregates);
      const ratios = computeRatios(
        aggregates,
        derived,
        previousAggregates ? { aggregates: previousAggregates } : null
      );
      previousAggregates = aggregates;

      await prisma.ratioResult.create({
        data: {
          periodId: period.id,
          aggregates: aggregates as unknown as object,
          derived: derived as unknown as object,
          ratios: ratios as unknown as object,
        },
      });

      console.log(`Période créée : ${demoEntity.name} — ${demo.label}`);
    }
  }

  // Prévisionnel de trésorerie de la maison-mère : flux mensuels récurrents
  // à partir du mois prochain, plus un investissement ponctuel qui creuse
  // le point bas — de quoi rendre la courbe parlante dès la première visite.
  const sas = await prisma.entity.findFirstOrThrow({ where: { organizationId: organization.id, name: "Atelier Nova SAS" } });
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const onDay = (day: number, monthOffset = 0) =>
    new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + monthOffset, day));
  const inAYear = new Date(Date.UTC(nextMonth.getUTCFullYear() + 1, nextMonth.getUTCMonth(), 1));
  await prisma.cashForecastLine.createMany({
    data: [
      { entityId: sas.id, label: "Encaissements clients", category: "ENCAISSEMENTS_CLIENTS", amount: 168000, startDate: onDay(15), recurrence: "MONTHLY", endDate: inAYear },
      { entityId: sas.id, label: "Règlements fournisseurs", category: "DECAISSEMENTS_FOURNISSEURS", amount: -71000, startDate: onDay(10), recurrence: "MONTHLY", endDate: inAYear },
      { entityId: sas.id, label: "Salaires et charges sociales", category: "SALAIRES_ET_CHARGES_SOCIALES", amount: -42000, startDate: onDay(28), recurrence: "MONTHLY", endDate: inAYear },
      { entityId: sas.id, label: "Loyer et charges externes", category: "LOYERS_ET_CHARGES_EXTERNES", amount: -23000, startDate: onDay(5), recurrence: "MONTHLY", endDate: inAYear },
      { entityId: sas.id, label: "Échéance emprunt", category: "REMBOURSEMENT_EMPRUNT", amount: -6500, startDate: onDay(1), recurrence: "MONTHLY", endDate: inAYear },
      { entityId: sas.id, label: "Acompte IS", category: "IMPOTS_ET_TAXES", amount: -11000, startDate: onDay(15, 2), recurrence: "NONE" },
      { entityId: sas.id, label: "Nouvelle ligne de production", category: "INVESTISSEMENT", amount: -48000, startDate: onDay(20, 1), recurrence: "NONE" },
    ],
  });
  console.log("Prévisionnel de trésorerie créé pour Atelier Nova SAS");

  const rules = await Promise.all(
    DEMO_ALERT_RULES.map((rule) =>
      prisma.alertRule.create({
        data: { organizationId: organization.id, label: rule.label, ratioId: rule.ratioId, operator: rule.operator, threshold: rule.threshold },
      })
    )
  );

  // Évalue les règles contre les périodes déjà calculées, comme le ferait un
  // import réel (voir AlertsService.evaluateForPeriod), pour que la page
  // Alertes affiche des événements dès la première connexion.
  const periods = await prisma.accountingPeriod.findMany({ include: { ratioResult: true } });
  for (const period of periods) {
    if (!period.ratioResult) continue;
    const ratios = period.ratioResult.ratios as unknown as Array<{ id: string; value: number | null }>;
    for (const rule of rules) {
      const ratio = ratios.find((r) => r.id === rule.ratioId);
      if (!ratio || ratio.value === null) continue;
      const breached =
        rule.operator === "LT"
          ? ratio.value < rule.threshold
          : rule.operator === "LTE"
            ? ratio.value <= rule.threshold
            : rule.operator === "GT"
              ? ratio.value > rule.threshold
              : ratio.value >= rule.threshold;
      if (breached) {
        await prisma.alertEvent.create({
          data: { alertRuleId: rule.id, periodId: period.id, entityId: period.entityId, value: ratio.value },
        });
      }
    }
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
