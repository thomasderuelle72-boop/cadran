import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEntityDto } from "./dto/create-entity.dto";

@Injectable()
export class EntitiesService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.entity.create({
      data: {
        organizationId,
        name: dto.name,
        country: dto.country,
        currency: dto.currency ?? "EUR",
        fxRateToOrgCurrency: dto.fxRateToOrgCurrency ?? 1,
      },
    });
  }
}
