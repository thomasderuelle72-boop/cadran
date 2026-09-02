import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { BulkLineItemsDto } from "./dto/bulk-line-items.dto";
import { RatiosService } from "../ratios/ratios.service";

@Injectable()
export class PeriodsService {
  constructor(
    private prisma: PrismaService,
    private ratiosService: RatiosService
  ) {}

  list(organizationId: string) {
    return this.prisma.accountingPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: "asc" },
      include: { _count: { select: { lineItems: true } } },
    });
  }

  async getOrThrow(organizationId: string, periodId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, organizationId },
    });
    if (!period) throw new NotFoundException("Période introuvable.");
    return period;
  }

  create(organizationId: string, dto: CreatePeriodDto) {
    return this.prisma.accountingPeriod.create({
      data: {
        organizationId,
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
    await this.getOrThrow(organizationId, periodId);

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
    return this.ratiosService.recomputeAndCache(periodId);
  }
}
