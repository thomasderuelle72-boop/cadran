import { Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { PrismaService } from "../prisma/prisma.service";
import { RatiosService } from "../ratios/ratios.service";
import { RatioCategory, RatioValue } from "../ratios/engine";
import { MarqueService } from "../marque/marque.service";
import { ajuster } from "../marque/image";

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

/**
 * Montant en toutes lettres françaises, séparateurs compris.
 *
 * `toLocaleString` sépare les milliers par une espace fine insécable
 * (U+202F). Les polices standard du PDF sont encodées en WinAnsi, qui ne
 * connaît pas ce caractère : « 1 250 000 € » s'imprimait « 1/250/000 € ».
 * On la ramène à l'espace insécable ordinaire, que WinAnsi code, et qui
 * joue le même rôle typographique.
 */
function formatMoney(value: number, currency: string): string {
  return value
    .toLocaleString("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 })
    .replace(/[\u202f\u2009]/g, "\u00a0");
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
    private marque: MarqueService,
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

    /* bufferPages : indispensable pour écrire « page 2 sur 5 », puisqu'on
     * ignore le total tant que le contenu n'est pas composé. */
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    /*
     * En-tête à la marque du client quand sa formule l'inclut, à celle de
     * Cadran sinon. Un cabinet remet ces rapports à ses propres clients :
     * voir « Cadran » en haut d'un document qu'il facture le dessert.
     */
    const marque = await this.marque.pourDocument(organizationId);
    const accent = marque?.couleurAccent ?? "#1F4F43";
    const enTete = marque?.nomAffiche ?? period.entity.organization.name;

    if (marque?.logo && marque.logoLargeur && marque.logoHauteur) {
      /* Taille calculée, jamais imposée : donner largeur et hauteur à la
       * fois étire le logo. */
      const taille = ajuster(
        { largeur: marque.logoLargeur, hauteur: marque.logoHauteur },
        { largeur: 150, hauteur: 46 }
      );
      doc.image(Buffer.from(marque.logo), doc.page.margins.left, doc.y, {
        width: taille.largeur,
        height: taille.hauteur,
      });
      doc.y += taille.hauteur + 12;
    }

    doc.fillColor("#111").fontSize(18).text(enTete, { align: "left" });
    doc.moveDown(0.15);
    doc.fontSize(13).fillColor(accent).text("Rapport financier");
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .fillColor("#555")
      .text(`${period.entity.name} · ${period.label}`);
    doc
      .fontSize(9)
      .fillColor("#888")
      .text(
        `Période du ${period.startDate.toLocaleDateString("fr-FR")} au ${period.endDate.toLocaleDateString(
          "fr-FR"
        )} · Calculé le ${computedAt.toLocaleDateString("fr-FR")}`
      );

    /* Un filet à la couleur d'accent : c'est ce qui fait qu'un document se
     * reconnaît d'un coup d'œil avant même d'être lu. */
    doc.moveDown(0.6);
    const largeurUtile = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.save().rect(doc.page.margins.left, doc.y, largeurUtile, 1.5).fill(accent).restore();
    doc.moveDown(1);

    doc.fillColor(accent).fontSize(13).text("Synthèse");
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
      doc.fontSize(13).fillColor(accent).text(CATEGORY_LABELS[category]);
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

    /*
     * Bloc de signature : c'est lui qui transforme une sortie de logiciel
     * en document qui engage quelqu'un. Il n'apparaît que si un signataire
     * est renseigné — une signature sans nom ne vaut rien.
     */
    if (marque?.signataireNom) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 130) doc.addPage();
      doc.moveDown(1);
      doc.save().rect(doc.page.margins.left, doc.y, 180, 0.75).fill("#CCC").restore();
      doc.moveDown(0.8);

      if (marque.signature && marque.signatureLargeur && marque.signatureHauteur) {
        const taille = ajuster(
          { largeur: marque.signatureLargeur, hauteur: marque.signatureHauteur },
          { largeur: 140, hauteur: 48 }
        );
        doc.image(Buffer.from(marque.signature), doc.page.margins.left, doc.y, {
          width: taille.largeur,
          height: taille.hauteur,
        });
        doc.y += taille.hauteur + 6;
      }

      doc.fontSize(10).fillColor("#111").text(marque.signataireNom);
      if (marque.signataireFonction) {
        doc.fontSize(9).fillColor("#666").text(marque.signataireFonction);
      }
    }

    /*
     * Pied de page sur chaque page, numérotation comprise. Écrit après coup
     * en parcourant les pages : au moment où l'on compose le contenu, on ne
     * sait pas encore combien il y en aura, et « page 1 sur ? » n'est pas un
     * document professionnel.
     */
    /* À défaut de marque — formule qui ne l'inclut pas, ou cabinet qui n'a
     * rien réglé — le pied de page porte la mention de l'outil. C'est ce qui
     * donne sa valeur à la personnalisation : la formule Cabinet ne vend pas
     * un logo, elle vend un document qui ne parle que du cabinet. */
    const mentions = marque?.mentionsPied ?? (marque ? null : "Document produit avec Cadran");
    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      doc.switchToPage(pages.start + index);

      /* pdfkit pagine dès qu'un texte dépasse la marge basse, même écrit à
       * une position imposée : sans neutraliser la marge, chaque pied de
       * page ajouterait une page vide, qu'il faudrait ensuite remplir. */
      const marge = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const basDePage = doc.page.height - marge + 14;

      doc.fontSize(7.5).fillColor("#999");
      if (mentions) {
        doc.text(mentions, doc.page.margins.left, basDePage, {
          width: largeurUtile - 60,
          lineBreak: false,
          ellipsis: true,
        });
      }
      doc.text(`${index + 1} / ${pages.count}`, doc.page.margins.left, basDePage, {
        width: largeurUtile,
        align: "right",
        lineBreak: false,
      });

      doc.page.margins.bottom = marge;
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

    const marque = await this.marque.pourDocument(organizationId);
    const accent = marque?.couleurAccent ?? "#1F4F43";

    const workbook = new ExcelJS.Workbook();
    /* L'auteur du classeur apparaît dans les propriétés du fichier : c'est
     * le cabinet qui remet le document, pas l'outil qui l'a produit. */
    workbook.creator = marque?.nomAffiche ?? "Cadran";
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
    habillerEntete(summarySheet.getRow(1), accent);

    const ratiosSheet = workbook.addWorksheet("Ratios");
    ratiosSheet.columns = [
      { header: "Catégorie", key: "category", width: 16 },
      { header: "Ratio", key: "label", width: 32 },
      { header: "Formule", key: "formula", width: 42 },
      { header: "Valeur", key: "value", width: 14 },
      { header: "Statut", key: "status", width: 12 },
    ];
    habillerEntete(ratiosSheet.getRow(1), accent);
    ratios.forEach((ratio) => {
      ratiosSheet.addRow({
        category: CATEGORY_LABELS[ratio.category],
        label: ratio.label,
        formula: ratio.formula,
        value: formatValue(ratio, currency),
        status: STATUS_LABELS[ratio.status],
      });
    });

    if (marque?.logo && marque.logoLargeur && marque.logoHauteur && marque.logoFormat) {
      const taille = ajuster(
        { largeur: marque.logoLargeur, hauteur: marque.logoHauteur },
        { largeur: 180, hauteur: 60 }
      );
      /* Transmis en base64 plutôt qu'en octets : les déclarations de type
       * d'ExcelJS redéfinissent Buffer pour leur propre compte, et lui
       * passer un Buffer de Node ne compile pas. */
      const identifiant = workbook.addImage({
        base64: `data:${marque.logoFormat};base64,${Buffer.from(marque.logo).toString("base64")}`,
        extension: marque.logoFormat === "image/png" ? "png" : "jpeg",
      });
      /* Flottant au-dessus des colonnes libres : les colonnes A et B portent
       * le tableau, qu'un décalage rendrait illisible à la réimportation. */
      summarySheet.addImage(identifiant, {
        tl: { col: 3, row: 0 },
        ext: { width: taille.largeur, height: taille.hauteur },
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

/**
 * En-tête de feuille à la couleur du cabinet.
 *
 * ExcelJS attend une couleur en ARGB sans dièse : passer le code hexadécimal
 * du web tel quel donne une cellule noire, sans erreur pour le signaler.
 */
function habillerEntete(ligne: ExcelJS.Row, accent: string): void {
  const argb = `FF${accent.replace("#", "").toUpperCase()}`;
  ligne.font = { bold: true, color: { argb: "FFFFFFFF" } };
  ligne.eachCell((cellule) => {
    cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  });
}
