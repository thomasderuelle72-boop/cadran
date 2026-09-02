import { Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
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

function formatValue(ratio: RatioValue): string {
  if (ratio.value === null) return "n/d";
  switch (ratio.unit) {
    case "pourcentage":
      return `${(ratio.value * 100).toFixed(1)} %`;
    case "jours":
      return `${ratio.value.toFixed(0)} j`;
    case "annees":
      return `${ratio.value.toFixed(1)} ans`;
    case "devise":
      return `${ratio.value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
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

  async generatePeriodReport(organizationId: string, periodId: string): Promise<Buffer> {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: { organization: true },
    });
    if (!period) throw new NotFoundException("Période introuvable.");

    const { derived, aggregates, ratios, computedAt } = await this.ratiosService.getForPeriod(
      organizationId,
      periodId
    );

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(20).text("Cadran — Rapport financier", { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor("#555").text(`${period.organization.name} · ${period.label}`);
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
      ["Chiffre d'affaires", `${aggregates.chiffreAffaires.toLocaleString("fr-FR")} €`],
      ["EBITDA", `${derived.ebitda.toLocaleString("fr-FR")} €`],
      ["Résultat net", `${derived.resultatNet.toLocaleString("fr-FR")} €`],
      ["Trésorerie nette", `${derived.tresorerieNette.toLocaleString("fr-FR")} €`],
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
          .text(`${ratio.label} — ${formatValue(ratio)} (${STATUS_LABELS[ratio.status]})`);
      });
      doc.moveDown(0.8);
    }

    doc.end();
    return done;
  }
}
