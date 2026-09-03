import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { computeAggregates, computeDerived, computeRatios, LineItemInput } from "../ratios/engine";
import { RatiosService } from "../ratios/ratios.service";

interface ConsolidationGroup {
  key: string;
  label: string;
  startDate: Date;
  endDate: Date;
  entities: Array<{ id: string; name: string }>;
}

@Injectable()
export class ConsolidationService {
  constructor(
    private prisma: PrismaService,
    private ratiosService: RatiosService
  ) {}

  private async loadPeriodsWithEntities(organizationId: string) {
    return this.prisma.accountingPeriod.findMany({
      where: { entity: { organizationId } },
      include: { entity: true },
      orderBy: { startDate: "asc" },
    });
  }

  async listGroups(organizationId: string): Promise<ConsolidationGroup[]> {
    const periods = await this.loadPeriodsWithEntities(organizationId);
    const groups = new Map<string, ConsolidationGroup>();

    for (const period of periods) {
      const key = `${period.startDate.toISOString()}_${period.endDate.toISOString()}`;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.entities.some((e) => e.id === period.entity.id)) {
          existing.entities.push({ id: period.entity.id, name: period.entity.name });
        }
      } else {
        groups.set(key, {
          key,
          label: period.label,
          startDate: period.startDate,
          endDate: period.endDate,
          entities: [{ id: period.entity.id, name: period.entity.name }],
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  private async aggregateGroup(organizationId: string, startDate: Date, endDate: Date) {
    const periods = await this.prisma.accountingPeriod.findMany({
      where: { entity: { organizationId }, startDate, endDate },
      include: { lineItems: true, entity: true },
    });

    const lineItems: LineItemInput[] = periods.flatMap((period) =>
      period.lineItems.map((item) => ({
        poste: item.poste,
        // Conversion dans la devise de référence du groupe : taux saisi
        // manuellement par entité (pas de flux de cours de change en V1).
        amount: this.ratiosService.toNumber(item.amount) * period.entity.fxRateToOrgCurrency,
      }))
    );

    return { periods, aggregates: computeAggregates(lineItems) };
  }

  async getConsolidatedRatios(organizationId: string, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const { periods, aggregates } = await this.aggregateGroup(organizationId, start, end);
    if (periods.length === 0) throw new NotFoundException("Aucune période trouvée pour ce groupe consolidé.");

    const derived = computeDerived(aggregates);

    const groups = await this.listGroups(organizationId);
    const previousGroup = groups
      .filter((g) => g.startDate.getTime() < start.getTime())
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];

    const previous = previousGroup
      ? { aggregates: (await this.aggregateGroup(organizationId, previousGroup.startDate, previousGroup.endDate)).aggregates }
      : null;

    const ratios = computeRatios(aggregates, derived, previous);

    // Les montants sont déjà convertis (aggregateGroup applique le taux de
    // chaque entité) : le groupe consolidé s'exprime dans la devise de
    // référence de l'organisation, jamais dans celle d'une entité en particulier.
    const organization = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });

    return {
      label: periods[0].label,
      startDate: start,
      endDate: end,
      currency: organization.currency,
      entities: Array.from(new Map(periods.map((p) => [p.entity.id, p.entity.name])).entries()).map(
        ([id, name]) => ({ id, name })
      ),
      aggregates,
      derived,
      ratios,
    };
  }
}
