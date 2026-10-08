import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEntityDto } from "./dto/create-entity.dto";
import { BillingService } from "../billing/billing.service";
import { NOM_DOSSIER, poserDossierTest } from "../plateforme/dossier-test";

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
    // Le dossier de démonstration n'y compte pas : il sert à essayer l'outil,
    // et il occuperait sinon la seule place d'une formule d'essai.
    await this.billing.exigerQuota(
      organizationId,
      "entites",
      await this.prisma.entity.count({ where: { organizationId, name: { not: NOM_DOSSIER } } })
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

  /**
   * Supprime un dossier et tout ce qui en dépend : périodes, écritures,
   * ratios, budget, prévisions, plan d'action.
   *
   * Exige le nom exact en confirmation, comme la suppression d'une
   * organisation : dans une liste de dossiers qui se ressemblent, la ligne
   * cliquée n'est pas toujours celle qu'on croit, et taper le nom force à
   * regarder. Irréversible : c'est ce qu'on attend d'une suppression.
   */
  async supprimer(organizationId: string, entityId: string, nomConfirme: string) {
    const entite = await this.getOrThrow(organizationId, entityId);
    if (nomConfirme.trim() !== entite.name) {
      throw new BadRequestException("Le nom saisi ne correspond pas : le dossier n'a pas été supprimé.");
    }
    await this.prisma.entity.delete({ where: { id: entite.id } });
    return { supprime: entite.name };
  }

  /**
   * Charge le dossier de démonstration dans l'organisation, ou le recharge
   * s'il y est déjà — pour repartir de zéro après l'avoir modifié.
   *
   * Il était réservé à la console d'exploitation ; l'administrateur d'une
   * organisation doit pouvoir essayer l'outil sur des chiffres complets sans
   * passer par nous.
   */
  demonstration(organizationId: string) {
    return poserDossierTest(this.prisma, organizationId);
  }
}
