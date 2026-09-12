import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ActionStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EntitiesService } from "../entities/entities.service";
import { RatiosService } from "../ratios/ratios.service";
import type { RatioValue } from "../ratios/engine";
import { CreateActionPlanDto, UpdateActionPlanDto } from "./dto/action-plan.dto";
import { calculerProgression } from "./progression";

/**
 * Avancement d'une action mesurée par un ratio.
 *
 * Le calcul de la progression vit dans progression.ts, à part et testé : il
 * mesure le chemin parcouru sur le chemin à parcourir, ce qui est la seule
 * façon de traiter les indicateurs qu'on veut faire baisser.
 */
export interface AvancementAction {
  ratioId: string;
  ratioLabel: string;
  valeurInitiale: number | null;
  valeurCible: number | null;
  valeurActuelle: number | null;
  periodeLue: string | null;
  progression: number | null;
  cibleAtteinte: boolean | null;
  sens: "hausse" | "baisse" | null;
}

export interface ActionPlanAvecAvancement {
  id: string;
  entityId: string | null;
  entityName: string | null;
  constat: string;
  action: string;
  ratioId: string | null;
  valeurInitiale: number | null;
  valeurCible: number | null;
  impactEstime: number | null;
  responsable: string | null;
  echeance: Date | null;
  statut: ActionStatus;
  auteurEmail: string;
  createdAt: Date;
  updatedAt: Date;
  /** Renseigné quand l'action suit un ratio et que l'entité a des données. */
  avancement: AvancementAction | null;
  /** Vrai quand l'échéance est passée et l'action toujours ouverte. */
  enRetard: boolean;
}

/** Statuts qui comptent encore comme du travail en cours. */
const STATUTS_OUVERTS: ActionStatus[] = [ActionStatus.A_FAIRE, ActionStatus.EN_COURS];

@Injectable()
export class ActionsService {
  constructor(
    private prisma: PrismaService,
    private entitiesService: EntitiesService,
    private ratiosService: RatiosService
  ) {}

  private toNumber(valeur: Prisma.Decimal | null): number | null {
    return valeur === null ? null : Number(valeur);
  }

  /**
   * Relit l'indicateur suivi sur la dernière période de l'entité.
   *
   * C'est le cœur du module : sans cette relecture, une recommandation reste
   * une phrase. Avec elle, le point suivant s'ouvre sur l'écart entre ce qui
   * était visé et ce qui a été fait.
   */
  private async avancement(
    organizationId: string,
    entityId: string | null,
    ratioId: string | null,
    valeurInitiale: number | null,
    valeurCible: number | null
  ): Promise<AvancementAction | null> {
    if (!ratioId || !entityId) return null;

    const derniere = await this.prisma.accountingPeriod.findFirst({
      where: { entityId, entity: { organizationId } },
      orderBy: { startDate: "desc" },
      select: { id: true, label: true },
    });
    if (!derniere) return null;

    const { ratios } = await this.ratiosService.getForPeriod(organizationId, derniere.id);
    const ratio = (ratios as RatioValue[]).find((r) => r.id === ratioId);

    const valeurActuelle = ratio?.value ?? null;
    const progression = calculerProgression(valeurInitiale, valeurCible, valeurActuelle);

    return {
      ratioId,
      ratioLabel: ratio?.label ?? ratioId,
      valeurInitiale,
      valeurCible,
      valeurActuelle,
      periodeLue: derniere.label,
      progression: progression.valeur,
      cibleAtteinte: progression.cibleAtteinte,
      sens: progression.sens,
    };
  }

  async list(organizationId: string, entityId?: string, statut?: ActionStatus) {
    const actions = await this.prisma.actionPlan.findMany({
      where: {
        organizationId,
        ...(entityId ? { entityId } : {}),
        ...(statut ? { statut } : {}),
      },
      include: { entity: { select: { name: true } } },
      // Les actions ouvertes d'abord, puis par échéance : l'ordre dans lequel
      // on les reprend en réunion.
      orderBy: [{ statut: "asc" }, { echeance: "asc" }, { createdAt: "desc" }],
    });

    const maintenant = new Date();

    return Promise.all(
      actions.map(async (action): Promise<ActionPlanAvecAvancement> => {
        const valeurInitiale = action.valeurInitiale;
        const valeurCible = action.valeurCible;
        return {
          id: action.id,
          entityId: action.entityId,
          entityName: action.entity?.name ?? null,
          constat: action.constat,
          action: action.action,
          ratioId: action.ratioId,
          valeurInitiale,
          valeurCible,
          impactEstime: this.toNumber(action.impactEstime),
          responsable: action.responsable,
          echeance: action.echeance,
          statut: action.statut,
          auteurEmail: action.auteurEmail,
          createdAt: action.createdAt,
          updatedAt: action.updatedAt,
          avancement: await this.avancement(
            organizationId,
            action.entityId,
            action.ratioId,
            valeurInitiale,
            valeurCible
          ),
          enRetard:
            action.echeance !== null &&
            action.echeance < maintenant &&
            STATUTS_OUVERTS.includes(action.statut),
        };
      })
    );
  }

  /** Synthèse pour l'ordre du jour d'un point : ce qui est en cours et ce qui a dérapé. */
  async synthese(organizationId: string) {
    const actions = await this.prisma.actionPlan.findMany({
      where: { organizationId },
      select: { statut: true, echeance: true, impactEstime: true },
    });

    const maintenant = new Date();
    const ouvertes = actions.filter((a) => STATUTS_OUVERTS.includes(a.statut));

    return {
      total: actions.length,
      parStatut: Object.fromEntries(
        Object.values(ActionStatus).map((statut) => [
          statut,
          actions.filter((a) => a.statut === statut).length,
        ])
      ) as Record<ActionStatus, number>,
      enRetard: ouvertes.filter((a) => a.echeance !== null && a.echeance < maintenant).length,
      // Somme des impacts encore à réaliser : ce que le plan d'action vaut,
      // en euros, s'il est mené à son terme.
      impactOuvert: ouvertes.reduce((somme, a) => somme + (this.toNumber(a.impactEstime) ?? 0), 0),
      impactRealise: actions
        .filter((a) => a.statut === ActionStatus.FAITE)
        .reduce((somme, a) => somme + (this.toNumber(a.impactEstime) ?? 0), 0),
    };
  }

  async create(organizationId: string, auteurEmail: string, dto: CreateActionPlanDto) {
    if (dto.entityId) await this.entitiesService.getOrThrow(organizationId, dto.entityId);

    // Un indicateur suivi n'a de sens que rattaché à une entité : c'est sur
    // elle qu'on relira la valeur au point suivant.
    if (dto.ratioId && !dto.entityId) {
      throw new ForbiddenException(
        "Un indicateur suivi demande de préciser l'entité sur laquelle le relire."
      );
    }

    return this.prisma.actionPlan.create({
      data: {
        organizationId,
        entityId: dto.entityId,
        constat: dto.constat,
        action: dto.action,
        ratioId: dto.ratioId,
        valeurInitiale: dto.valeurInitiale,
        valeurCible: dto.valeurCible,
        impactEstime: dto.impactEstime === undefined ? null : new Prisma.Decimal(dto.impactEstime),
        responsable: dto.responsable,
        echeance: dto.echeance ? new Date(dto.echeance) : null,
        auteurEmail,
      },
    });
  }

  private async getOrThrow(organizationId: string, id: string) {
    const action = await this.prisma.actionPlan.findFirst({ where: { id, organizationId } });
    if (!action) throw new NotFoundException("Action introuvable.");
    return action;
  }

  async update(organizationId: string, id: string, dto: UpdateActionPlanDto) {
    await this.getOrThrow(organizationId, id);

    return this.prisma.actionPlan.update({
      where: { id },
      data: {
        ...(dto.constat !== undefined ? { constat: dto.constat } : {}),
        ...(dto.action !== undefined ? { action: dto.action } : {}),
        ...(dto.ratioId !== undefined ? { ratioId: dto.ratioId } : {}),
        ...(dto.valeurInitiale !== undefined ? { valeurInitiale: dto.valeurInitiale } : {}),
        ...(dto.valeurCible !== undefined ? { valeurCible: dto.valeurCible } : {}),
        ...(dto.impactEstime !== undefined
          ? { impactEstime: new Prisma.Decimal(dto.impactEstime) }
          : {}),
        ...(dto.responsable !== undefined ? { responsable: dto.responsable } : {}),
        ...(dto.echeance !== undefined ? { echeance: new Date(dto.echeance) } : {}),
        ...(dto.statut !== undefined ? { statut: dto.statut } : {}),
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.getOrThrow(organizationId, id);
    await this.prisma.actionPlan.delete({ where: { id } });
  }
}
