import { Injectable, NotFoundException } from "@nestjs/common";
import { CashCategory, CashRecurrence } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EntitiesService } from "../entities/entities.service";
import { RatiosService } from "../ratios/ratios.service";
import { Aggregates } from "../ratios/engine";
import { projectCashFlow } from "./engine";
import { CreateCashLineDto } from "./dto/create-cash-line.dto";

export const CASH_CATEGORY_LABELS: Record<CashCategory, string> = {
  ENCAISSEMENTS_CLIENTS: "Encaissements clients",
  DECAISSEMENTS_FOURNISSEURS: "Décaissements fournisseurs",
  SALAIRES_ET_CHARGES_SOCIALES: "Salaires et charges sociales",
  IMPOTS_ET_TAXES: "Impôts et taxes",
  LOYERS_ET_CHARGES_EXTERNES: "Loyers et charges externes",
  REMBOURSEMENT_EMPRUNT: "Remboursement d'emprunt",
  INVESTISSEMENT: "Investissement",
  FINANCEMENT: "Financement",
  AUTRE: "Autre",
};

@Injectable()
export class CashForecastService {
  constructor(
    private prisma: PrismaService,
    private entitiesService: EntitiesService,
    private ratiosService: RatiosService
  ) {}

  listLines(organizationId: string, entityId: string) {
    return this.entitiesService.getOrThrow(organizationId, entityId).then(() =>
      this.prisma.cashForecastLine.findMany({ where: { entityId }, orderBy: [{ startDate: "asc" }, { createdAt: "asc" }] })
    );
  }

  async createLine(organizationId: string, entityId: string, dto: CreateCashLineDto) {
    await this.entitiesService.getOrThrow(organizationId, entityId);
    return this.prisma.cashForecastLine.create({
      data: {
        entityId,
        label: dto.label,
        category: dto.category,
        amount: dto.amount,
        startDate: new Date(dto.startDate),
        recurrence: dto.recurrence ?? CashRecurrence.NONE,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async deleteLine(organizationId: string, entityId: string, lineId: string) {
    await this.entitiesService.getOrThrow(organizationId, entityId);
    const line = await this.prisma.cashForecastLine.findFirst({ where: { id: lineId, entityId } });
    if (!line) throw new NotFoundException("Ligne de trésorerie introuvable.");
    await this.prisma.cashForecastLine.delete({ where: { id: lineId } });
  }

  /**
   * Le solde d'ouverture est pris sur la période la plus récente de
   * l'entité (disponibilités de clôture). Faute de période importée, on
   * part de zéro et on le signale à l'utilisateur.
   */
  private async openingBalance(entityId: string) {
    const latest = await this.prisma.accountingPeriod.findFirst({
      where: { entityId },
      orderBy: { endDate: "desc" },
      include: { ratioResult: true },
    });
    if (!latest?.ratioResult) return { balance: 0, source: null as null | { periodId: string; label: string; endDate: Date } };
    const aggregates = latest.ratioResult.aggregates as unknown as Aggregates;
    return {
      balance: aggregates.disponibilites,
      source: { periodId: latest.id, label: latest.label, endDate: latest.endDate },
    };
  }

  async getProjection(organizationId: string, entityId: string, horizonWeeks = 13, from = new Date()) {
    const entity = await this.entitiesService.getOrThrow(organizationId, entityId);
    const [{ balance, source }, lines] = await Promise.all([
      this.openingBalance(entityId),
      this.prisma.cashForecastLine.findMany({ where: { entityId } }),
    ]);

    const projection = projectCashFlow(
      balance,
      lines.map((line) => ({
        id: line.id,
        label: line.label,
        category: line.category,
        amount: this.ratiosService.toNumber(line.amount),
        startDate: line.startDate,
        recurrence: line.recurrence,
        endDate: line.endDate,
      })),
      from,
      horizonWeeks
    );

    return { entityId, currency: entity.currency, openingSource: source, lineCount: lines.length, ...projection };
  }

  /**
   * Pré-remplit un prévisionnel mensuel à partir du rythme de la dernière
   * période (montants ramenés au mois). Point de départ à ajuster, pas une
   * prévision : les décalages d'encaissement (DSO) ne sont pas modélisés.
   */
  async prefillFromLatestPeriod(organizationId: string, entityId: string, from = new Date()) {
    await this.entitiesService.getOrThrow(organizationId, entityId);
    const latest = await this.prisma.accountingPeriod.findFirst({
      where: { entityId },
      orderBy: { endDate: "desc" },
      include: { ratioResult: true },
    });
    if (!latest?.ratioResult) throw new NotFoundException("Aucune période importée : impossible de pré-remplir.");

    const a = latest.ratioResult.aggregates as unknown as Aggregates;
    const days = Math.max(1, Math.round((latest.endDate.getTime() - latest.startDate.getTime()) / 86400000) + 1);
    const perMonth = (amount: number) => Math.round((amount / days) * 30.4);

    const firstOfNextMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
    const endDate = new Date(Date.UTC(firstOfNextMonth.getUTCFullYear() + 1, firstOfNextMonth.getUTCMonth(), 1));
    const day = (d: number) => new Date(Date.UTC(firstOfNextMonth.getUTCFullYear(), firstOfNextMonth.getUTCMonth(), d));

    const templates: Array<{ label: string; category: CashCategory; amount: number; startDate: Date }> = [
      { label: "Encaissements clients (rythme dernière période)", category: CashCategory.ENCAISSEMENTS_CLIENTS, amount: perMonth(a.chiffreAffaires), startDate: day(15) },
      { label: "Achats (rythme dernière période)", category: CashCategory.DECAISSEMENTS_FOURNISSEURS, amount: -perMonth(a.achatsConsommes), startDate: day(10) },
      { label: "Salaires et charges sociales", category: CashCategory.SALAIRES_ET_CHARGES_SOCIALES, amount: -perMonth(a.chargesPersonnel), startDate: day(28) },
      { label: "Charges externes", category: CashCategory.LOYERS_ET_CHARGES_EXTERNES, amount: -perMonth(a.chargesExternes), startDate: day(5) },
      { label: "Impôts et taxes", category: CashCategory.IMPOTS_ET_TAXES, amount: -perMonth(a.impotsTaxes + a.impotSocietes), startDate: day(20) },
    ].filter((t) => t.amount !== 0);

    await this.prisma.cashForecastLine.createMany({
      data: templates.map((t) => ({ entityId, ...t, recurrence: CashRecurrence.MONTHLY, endDate })),
    });

    return { created: templates.length, basedOn: { periodId: latest.id, label: latest.label } };
  }
}
