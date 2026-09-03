import { Injectable, NotFoundException } from "@nestjs/common";
import { LinePoste } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RatiosService } from "../ratios/ratios.service";
import { AGGREGATE_KEY_BY_POSTE, computeAggregates, computeDerived } from "../ratios/engine";
import { POSTE_LABELS } from "../import/pcg-mapping";
import { BulkBudgetLinesDto } from "./dto/bulk-budget-lines.dto";

export interface BudgetVarianceRow {
  poste: LinePoste;
  label: string;
  budgeted: number;
  actual: number;
  ecart: number;
  ecartPct: number | null;
}

export interface BudgetVariance {
  periodId: string;
  rows: BudgetVarianceRow[];
  summary: {
    chiffreAffaires: { budgeted: number; actual: number; ecart: number };
    ebitda: { budgeted: number; actual: number; ecart: number };
    resultatNet: { budgeted: number; actual: number; ecart: number };
  };
}

@Injectable()
export class BudgetService {
  constructor(
    private prisma: PrismaService,
    private ratiosService: RatiosService
  ) {}

  private async assertPeriodInOrg(organizationId: string, periodId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, entity: { organizationId } },
    });
    if (!period) throw new NotFoundException("Période introuvable.");
    return period;
  }

  async replace(organizationId: string, periodId: string, dto: BulkBudgetLinesDto): Promise<BudgetVariance> {
    await this.assertPeriodInOrg(organizationId, periodId);

    await this.prisma.$transaction([
      this.prisma.budgetLine.deleteMany({ where: { periodId } }),
      this.prisma.budgetLine.createMany({
        data: dto.items.map((item) => ({ periodId, poste: item.poste, amountBudgeted: item.amountBudgeted })),
      }),
    ]);

    return this.getVariance(organizationId, periodId);
  }

  async list(organizationId: string, periodId: string) {
    await this.assertPeriodInOrg(organizationId, periodId);
    return this.prisma.budgetLine.findMany({ where: { periodId }, orderBy: { poste: "asc" } });
  }

  async getVariance(organizationId: string, periodId: string): Promise<BudgetVariance> {
    await this.assertPeriodInOrg(organizationId, periodId);

    const [lineItems, budgetLines] = await Promise.all([
      this.prisma.financialLineItem.findMany({ where: { periodId } }),
      this.prisma.budgetLine.findMany({ where: { periodId } }),
    ]);

    const actualAggregates = computeAggregates(
      lineItems.map((item) => ({ poste: item.poste, amount: this.ratiosService.toNumber(item.amount) }))
    );
    const budgetedAggregates = computeAggregates(
      budgetLines.map((line) => ({ poste: line.poste, amount: this.ratiosService.toNumber(line.amountBudgeted) }))
    );

    const rows: BudgetVarianceRow[] = (Object.keys(AGGREGATE_KEY_BY_POSTE) as LinePoste[])
      .map((poste) => {
        const key = AGGREGATE_KEY_BY_POSTE[poste];
        const budgeted = budgetedAggregates[key];
        const actual = actualAggregates[key];
        const ecart = actual - budgeted;
        return {
          poste,
          label: POSTE_LABELS[poste],
          budgeted,
          actual,
          ecart,
          ecartPct: budgeted !== 0 ? ecart / Math.abs(budgeted) : null,
        };
      })
      .filter((row) => row.budgeted !== 0 || row.actual !== 0);

    const actualDerived = computeDerived(actualAggregates);
    const budgetedDerived = computeDerived(budgetedAggregates);

    return {
      periodId,
      rows,
      summary: {
        chiffreAffaires: {
          budgeted: budgetedAggregates.chiffreAffaires,
          actual: actualAggregates.chiffreAffaires,
          ecart: actualAggregates.chiffreAffaires - budgetedAggregates.chiffreAffaires,
        },
        ebitda: {
          budgeted: budgetedDerived.ebitda,
          actual: actualDerived.ebitda,
          ecart: actualDerived.ebitda - budgetedDerived.ebitda,
        },
        resultatNet: {
          budgeted: budgetedDerived.resultatNet,
          actual: actualDerived.resultatNet,
          ecart: actualDerived.resultatNet - budgetedDerived.resultatNet,
        },
      },
    };
  }
}
