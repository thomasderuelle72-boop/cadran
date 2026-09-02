import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { Aggregates, computeAggregates, computeDerived, computeRatios, Derived, RatioValue } from "./engine";

export interface RatioResultPayload {
  periodId: string;
  aggregates: Aggregates;
  derived: Derived;
  ratios: RatioValue[];
  computedAt: Date;
}

@Injectable()
export class RatiosService {
  constructor(private prisma: PrismaService) {}

  private toNumber(amount: Prisma.Decimal | number): number {
    return typeof amount === "number" ? amount : Number(amount);
  }

  private async findPreviousPeriodAggregates(
    organizationId: string,
    startDate: Date
  ): Promise<{ aggregates: Aggregates } | null> {
    const previousPeriod = await this.prisma.accountingPeriod.findFirst({
      where: { organizationId, startDate: { lt: startDate } },
      orderBy: { startDate: "desc" },
      include: { lineItems: true },
    });
    if (!previousPeriod) return null;
    const aggregates = computeAggregates(
      previousPeriod.lineItems.map((item) => ({ poste: item.poste, amount: this.toNumber(item.amount) }))
    );
    return { aggregates };
  }

  async recomputeAndCache(periodId: string): Promise<RatioResultPayload> {
    const period = await this.prisma.accountingPeriod.findUniqueOrThrow({
      where: { id: periodId },
      include: { lineItems: true },
    });

    const aggregates = computeAggregates(
      period.lineItems.map((item) => ({ poste: item.poste, amount: this.toNumber(item.amount) }))
    );
    const derived = computeDerived(aggregates);
    const previous = await this.findPreviousPeriodAggregates(period.organizationId, period.startDate);
    const ratios = computeRatios(aggregates, derived, previous);

    await this.prisma.ratioResult.upsert({
      where: { periodId },
      create: {
        periodId,
        aggregates: aggregates as unknown as Prisma.InputJsonValue,
        derived: derived as unknown as Prisma.InputJsonValue,
        ratios: ratios as unknown as Prisma.InputJsonValue,
      },
      update: {
        aggregates: aggregates as unknown as Prisma.InputJsonValue,
        derived: derived as unknown as Prisma.InputJsonValue,
        ratios: ratios as unknown as Prisma.InputJsonValue,
        computedAt: new Date(),
      },
    });

    return { periodId, aggregates, derived, ratios, computedAt: new Date() };
  }

  async getForPeriod(organizationId: string, periodId: string): Promise<RatioResultPayload> {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: { ratioResult: true },
    });
    if (!period) throw new NotFoundException("Période introuvable.");

    if (!period.ratioResult) {
      // Aucune ligne importée n'a encore déclenché de calcul : on le fait à la volée.
      return this.recomputeAndCache(periodId);
    }

    return {
      periodId,
      aggregates: period.ratioResult.aggregates as unknown as Aggregates,
      derived: period.ratioResult.derived as unknown as Derived,
      ratios: period.ratioResult.ratios as unknown as RatioValue[],
      computedAt: period.ratioResult.computedAt,
    };
  }

  async getTrend(organizationId: string) {
    const periods = await this.prisma.accountingPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: "asc" },
      include: { ratioResult: true },
    });

    return periods
      .filter((p) => p.ratioResult)
      .map((p) => {
        const ratios = p.ratioResult!.ratios as unknown as RatioValue[];
        const derived = p.ratioResult!.derived as unknown as Derived;
        const aggregates = p.ratioResult!.aggregates as unknown as Aggregates;
        const byId = (id: string) => ratios.find((r) => r.id === id)?.value ?? null;
        return {
          periodId: p.id,
          label: p.label,
          startDate: p.startDate,
          chiffreAffaires: aggregates.chiffreAffaires,
          ebitda: derived.ebitda,
          resultatNet: derived.resultatNet,
          tresorerieNette: derived.tresorerieNette,
          margeEbitda: byId("marge_ebitda"),
          liquiditeGenerale: byId("liquidite_generale"),
        };
      });
  }
}
