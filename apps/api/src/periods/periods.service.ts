import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { BulkLineItemsDto } from "./dto/bulk-line-items.dto";
import { RatiosService } from "../ratios/ratios.service";
import { EntitiesService } from "../entities/entities.service";
import { AlertsService } from "../alerts/alerts.service";

@Injectable()
export class PeriodsService {
  constructor(
    private prisma: PrismaService,
    private ratiosService: RatiosService,
    private entitiesService: EntitiesService,
    private alertsService: AlertsService
  ) {}

  list(organizationId: string, entityId?: string) {
    return this.prisma.accountingPeriod.findMany({
      where: { entity: { organizationId }, ...(entityId ? { entityId } : {}) },
      orderBy: { startDate: "asc" },
      include: { _count: { select: { lineItems: true } }, entity: { select: { id: true, name: true } } },
    });
  }

  async getOrThrow(organizationId: string, periodId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, entity: { organizationId } },
    });
    if (!period) throw new NotFoundException("Période introuvable.");
    return period;
  }

  async create(organizationId: string, dto: CreatePeriodDto) {
    // Vérifie que l'entité appartient bien à l'organisation de l'utilisateur
    // avant de lui rattacher une période.
    await this.entitiesService.getOrThrow(organizationId, dto.entityId);

    return this.prisma.accountingPeriod.create({
      data: {
        entityId: dto.entityId,
        label: dto.label,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async remove(organizationId: string, periodId: string) {
    await this.getOrThrow(organizationId, periodId);
    await this.prisma.accountingPeriod.delete({ where: { id: periodId } });
  }

  async listLineItems(organizationId: string, periodId: string) {
    await this.getOrThrow(organizationId, periodId);
    return this.prisma.financialLineItem.findMany({
      where: { periodId },
      orderBy: { accountCode: "asc" },
    });
  }

  async replaceLineItems(organizationId: string, periodId: string, dto: BulkLineItemsDto) {
    const period = await this.getOrThrow(organizationId, periodId);

    await this.prisma.$transaction([
      this.prisma.financialLineItem.deleteMany({ where: { periodId } }),
      this.prisma.financialLineItem.createMany({
        data: dto.items.map((item) => ({
          periodId,
          accountCode: item.accountCode,
          label: item.label,
          amount: item.amount,
          poste: item.poste,
        })),
      }),
    ]);

    // Le cache de ratios est recalculé immédiatement : le dashboard ne doit
    // jamais afficher des ratios calculés sur les anciennes lignes.
    const result = await this.ratiosService.recomputeAndCache(periodId);
    await this.alertsService.evaluateForPeriod(periodId);

    // Si cette période n'est pas la plus récente de l'entité, les périodes
    // suivantes ont mis en cache une croissance du CA (et des alertes basées
    // dessus) calculée à partir de son ancien contenu. On les recalcule en
    // cascade pour qu'elles reflètent immédiatement les nouvelles données.
    const laterPeriods = await this.prisma.accountingPeriod.findMany({
      where: { entityId: period.entityId, startDate: { gt: period.startDate } },
      orderBy: { startDate: "asc" },
      select: { id: true },
    });
    for (const later of laterPeriods) {
      await this.ratiosService.recomputeAndCache(later.id);
      await this.alertsService.evaluateForPeriod(later.id);
    }

    return result;
  }
}
