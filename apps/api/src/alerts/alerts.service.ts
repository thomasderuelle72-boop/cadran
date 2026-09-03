import { Injectable, NotFoundException } from "@nestjs/common";
import { AlertOperator } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RatioValue } from "../ratios/engine";
import { CreateAlertRuleDto } from "./dto/create-alert-rule.dto";

function isBreached(operator: AlertOperator, value: number, threshold: number): boolean {
  switch (operator) {
    case "LT":
      return value < threshold;
    case "LTE":
      return value <= threshold;
    case "GT":
      return value > threshold;
    case "GTE":
      return value >= threshold;
  }
}

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  listRules(organizationId: string) {
    return this.prisma.alertRule.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } });
  }

  createRule(organizationId: string, dto: CreateAlertRuleDto) {
    return this.prisma.alertRule.create({
      data: {
        organizationId,
        label: dto.label,
        ratioId: dto.ratioId,
        operator: dto.operator,
        threshold: dto.threshold,
      },
    });
  }

  async deleteRule(organizationId: string, ruleId: string) {
    const rule = await this.prisma.alertRule.findFirst({ where: { id: ruleId, organizationId } });
    if (!rule) throw new NotFoundException("Règle introuvable.");
    await this.prisma.alertRule.delete({ where: { id: ruleId } });
  }

  /**
   * Évalue toutes les règles actives de l'organisation contre les ratios
   * fraîchement calculés d'une période. Appelée juste après le recalcul des
   * ratios (voir PeriodsService). Un événement est créé/mis à jour tant que
   * le seuil reste franchi, et supprimé dès que ce n'est plus le cas — la
   * liste des alertes reflète toujours l'état courant, pas un historique.
   */
  async evaluateForPeriod(periodId: string): Promise<void> {
    const period = await this.prisma.accountingPeriod.findUnique({
      where: { id: periodId },
      include: { entity: true, ratioResult: true },
    });
    if (!period || !period.ratioResult) return;

    const rules = await this.prisma.alertRule.findMany({
      where: { organizationId: period.entity.organizationId, active: true },
    });
    if (rules.length === 0) return;

    const ratios = period.ratioResult.ratios as unknown as RatioValue[];

    for (const rule of rules) {
      const ratio = ratios.find((r) => r.id === rule.ratioId);
      const breached = ratio && ratio.value !== null && isBreached(rule.operator, ratio.value, rule.threshold);

      if (breached) {
        await this.prisma.alertEvent.upsert({
          where: { alertRuleId_periodId: { alertRuleId: rule.id, periodId } },
          create: { alertRuleId: rule.id, periodId, entityId: period.entityId, value: ratio!.value! },
          update: { value: ratio!.value!, entityId: period.entityId },
        });
      } else {
        await this.prisma.alertEvent
          .delete({ where: { alertRuleId_periodId: { alertRuleId: rule.id, periodId } } })
          .catch(() => undefined);
      }
    }
  }

  async listEvents(organizationId: string) {
    const events = await this.prisma.alertEvent.findMany({
      where: { alertRule: { organizationId } },
      include: { alertRule: true },
      orderBy: { updatedAt: "desc" },
    });
    if (events.length === 0) return [];

    const periods = await this.prisma.accountingPeriod.findMany({
      where: { id: { in: events.map((e) => e.periodId) } },
      include: { entity: true },
    });
    const periodById = new Map(periods.map((p) => [p.id, p]));

    return events.map((event) => {
      const period = periodById.get(event.periodId);
      return {
        id: event.id,
        value: event.value,
        acknowledged: event.acknowledged,
        updatedAt: event.updatedAt,
        rule: { id: event.alertRule.id, label: event.alertRule.label, ratioId: event.alertRule.ratioId, operator: event.alertRule.operator, threshold: event.alertRule.threshold },
        period: period ? { id: period.id, label: period.label } : null,
        entity: period ? { id: period.entity.id, name: period.entity.name } : null,
      };
    });
  }

  async acknowledge(organizationId: string, eventId: string) {
    const event = await this.prisma.alertEvent.findFirst({
      where: { id: eventId, alertRule: { organizationId } },
    });
    if (!event) throw new NotFoundException("Alerte introuvable.");
    return this.prisma.alertEvent.update({ where: { id: eventId }, data: { acknowledged: true } });
  }
}
