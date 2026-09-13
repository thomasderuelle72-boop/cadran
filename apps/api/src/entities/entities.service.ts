import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEntityDto } from "./dto/create-entity.dto";
import { BillingService } from "../billing/billing.service";

@Injectable()
export class EntitiesService {
  constructor(
    private prisma: PrismaService,
    private billing: BillingService
  ) {}

  list(organizationId: string) {
    return this.prisma.entity.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { periods: true } } },
    });
  }

  async getOrThrow(organizationId: string, entityId: string) {
    const entity = await this.prisma.entity.findFirst({ where: { id: entityId, organizationId } });
    if (!entity) throw new NotFoundException("Entité introuvable.");
    return entity;
  }

  async create(organizationId: string, dto: CreateEntityDto) {
    const existing = await this.prisma.entity.findFirst({ where: { organizationId, name: dto.name } });
    if (existing) throw new ConflictException("Une entité porte déjà ce nom dans votre organisation.");

    // Le quota se vérifie avant d'écrire, et non après : créer puis refuser
    // laisserait l'entité en base, et un compte au-dessus de sa formule.
    await this.billing.exigerQuota(
      organizationId,
      "entites",
      await this.prisma.entity.count({ where: { organizationId } })
    );

    return this.prisma.entity.create({
      data: {
        organizationId,
        name: dto.name,
        country: dto.country,
        currency: dto.currency ?? "EUR",
        fxRateToOrgCurrency: dto.fxRateToOrgCurrency ?? 1,
        // Le code NAF est stocké en majuscules : l'INSEE et les référentiels
        // sectoriels l'écrivent ainsi, et une comparaison sensible à la casse
        // manquerait sinon la cohorte.
        nafCode: dto.nafCode?.toUpperCase(),
        headcount: dto.headcount,
      },
    });
  }
}
