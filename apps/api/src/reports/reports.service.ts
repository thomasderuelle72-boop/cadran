import { Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { PrismaService } from "../prisma/prisma.service";
import { RatiosService } from "../ratios/ratios.service";
import { RatioCategory, RatioValue } from "../ratios/engine";

const CATEGORY_LABELS: Record<RatioCategory, string> = {
  RENTABILITE: "Rentabilité",
  LIQUIDITE: "Liquidité",
  SOLVABILITE: "Solvabilité",
  ACTIVITE: "Activité",
};

const STATUS_LABELS: Record<RatioValue["status"], string> = {
  bon: "Bon",
  attention: "Attention",
  critique: "Critique",
  neutre: "—",
};

function formatMoney(value: number, currency: string): string {
  return value.toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 });
}

function formatValue(ratio: RatioValue, currency: string): string {
  if (ratio.value === null) return "n/d";
  switch (ratio.unit) {
    case "pourcentage":
      return `${(ratio.value * 100).toFixed(1)} %`;
    case "jours":
      return `${ratio.value.toFixed(0)} j`;
    case "annees":
      return `${ratio.value.toFixed(1)} ans`;
    case "devise":
      return formatMoney(ratio.value, currency);
    default:
      return ratio.value.toFixed(2);
  }
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private ratiosService: RatiosService
  ) {}

  private async loadReportData(organizationId: string, periodId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, entity: { organizationId } },
      include: { entity: { include: { organization: true } } },
    });
    if (!period) throw new NotFoundException("Période introuvable.");

    const { derived, aggregates, ratios, computedAt } = await this.ratiosService.getForPeriod(
      organizationId,
      periodId
    );

    return { period, derived, aggregates, ratios, computedAt };
  }

  async generatePeriodReport(organizationId: string, periodId: string): Promise<Buffer> {
    const { period, derived, aggregates, ratios, computedAt } = await this.loadReportData(
      organizationId,
      periodId
    );
    const currency = period.entity.currency;

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(20).text("Cadran — Rapport financier", { align: "left" });
    doc.moveDown(0.2);
    doc
      .fontSize(12)
      .fillColor("#555")
      .text(`${period.entity.organization.name} — ${period.entity.name} · ${period.label}`);
    doc
      .fontSize(9)
      .fillColor("#888")
      .text(
        `Période du ${period.startDate.toLocaleDateString("fr-FR")} au ${period.endDate.toLocaleDateString(
          "fr-FR"
        )} · Calculé le ${computedAt.toLocaleDateString("fr-FR")}`
      );
    doc.moveDown(1);

    doc.fillColor("#111").fontSize(13).text("Synthèse");
    doc.moveDown(0.4);
    const kpis: Array<[string, string]> = [
      ["Chiffre d'affaires", formatMoney(aggregates.chiffreAffaires, currency)],
      ["EBITDA", formatMoney(derived.ebitda, currency)],
      ["Résultat net", formatMoney(derived.resultatNet, currency)],
      ["Trésorerie nette", formatMoney(derived.tresorerieNette, currency)],
    ];
    kpis.forEach(([label, value]) => {
      doc.fontSize(10).fillColor("#333").text(`${label} : `, { continued: true }).fillColor("#111").text(value);
    });
    doc.moveDown(1);

    const categories: RatioCategory[] = ["RENTABILITE", "LIQUIDITE", "SOLVABILITE", "ACTIVITE"];
    for (const category of categories) {
      doc.fontSize(13).fillColor("#111").text(CATEGORY_LABELS[category]);
      doc.moveDown(0.3);
      const rows = ratios.filter((r) => r.category === category);
      rows.forEach((ratio) => {
        doc
          .fontSize(9.5)
          .fillColor("#333")
          .text(`${ratio.label} — ${formatValue(ratio, currency)} (${STATUS_LABELS[ratio.status]})`);
      });
      doc.moveDown(0.8);
    }

    doc.end();
    return done;
  }

  async generatePeriodReportExcel(organizationId: string, periodId: string): Promise<Buffer> {
    const { period, derived, aggregates, ratios, computedAt } = await this.loadReportData(
      organizationId,
      periodId
    );
    const currency = period.entity.currency;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Cadran";
    workbook.created = computedAt;

    const summarySheet = workbook.addWorksheet("Synthèse");
    summarySheet.columns = [
      { header: "Indicateur", key: "label", width: 28 },
      { header: "Valeur", key: "value", width: 18 },
    ];
    summarySheet.addRows([
      { label: "Organisation", value: period.entity.organization.name },
      { label: "Entité", value: period.entity.name },
      { label: "Période", value: period.label },
      { label: "Devise", value: currency },
      { label: "Chiffre d'affaires", value: formatMoney(aggregates.chiffreAffaires, currency) },
      { label: "EBITDA", value: formatMoney(derived.ebitda, currency) },
      { label: "Résultat net", value: formatMoney(derived.resultatNet, currency) },
      { label: "Trésorerie nette", value: formatMoney(derived.tresorerieNette, currency) },
    ]);
    summarySheet.getRow(1).font = { bold: true };

    const ratiosSheet = workbook.addWorksheet("Ratios");
    ratiosSheet.columns = [
      { header: "Catégorie", key: "category", width: 16 },
      { header: "Ratio", key: "label", width: 32 },
      { header: "Formule", key: "formula", width: 42 },
      { header: "Valeur", key: "value", width: 14 },
      { header: "Statut", key: "status", width: 12 },
    ];
    ratiosSheet.getRow(1).font = { bold: true };
    ratios.forEach((ratio) => {
      ratiosSheet.addRow({
        category: CATEGORY_LABELS[ratio.category],
        label: ratio.label,
        formula: ratio.formula,
        value: formatValue(ratio, currency),
        status: STATUS_LABELS[ratio.status],
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
