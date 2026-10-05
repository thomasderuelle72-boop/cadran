import { inflateSync } from "node:zlib";
import { ReportsService } from "./reports.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { RatiosService } from "../ratios/ratios.service";
import type { MarqueService } from "../marque/marque.service";
import type { RatioValue } from "../ratios/engine";

/**
 * Le générateur de documents se vérifie sur les octets qu'il produit.
 *
 * On n'a pas de rendu à inspecter ici : ce qu'on peut affirmer d'un PDF sans
 * le dessiner, c'est son nombre de pages, la présence de ses images et de ses
 * couleurs, et le fait qu'il s'ouvre. C'est précisément là qu'étaient les
 * deux pièges : le pied de page écrit sous la marge basse faisait créer une
 * page par pied de page, et une image étirée passe tous les tests qui ne
 * regardent que la taille du fichier.
 */

/** PNG opaque de 96 × 32, vert Cadran : pdfkit décode réellement l'image. */
const LOGO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAAAgCAIAAABiouoDAAAARUlEQVR42u3QQQkAAAgEsGtiGAPYv40N/AuDJVhqmkMUCBIkSJAgQYIEIUiQIEGCBAkShCBBggQJEiRIEIIECRIkSNBfC/xtTHnSIQzwAAAAAElFTkSuQmCC",
  "base64"
);

/** PNG de 120 × 40 : une signature est plus large que haute. */
const SIGNATURE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAHgAAAAoCAIAAAC6iKlyAAAAUklEQVR42u3QMQ0AAAgDsIngRhj+heCCcDSpgqZ6OBAFokUjWrRoC6JFI1q0aAuiRSNatGhEi0a0aNGIFo1o0aIRLRrRokUjWjSiRYtGtGhE/7M+e0GXfUcvzQAAAABJRU5ErkJggg==",
  "base64"
);

const RATIOS: RatioValue[] = [
  {
    id: "marge-nette",
    label: "Marge nette",
    category: "RENTABILITE",
    formula: "Résultat net / CA",
    unit: "pourcentage",
    value: 0.082,
    status: "bon",
    interpretation: "La marge se maintient au-dessus du secteur.",
  },
  {
    id: "liquidite-generale",
    label: "Liquidité générale",
    category: "LIQUIDITE",
    formula: "Actif circulant / Dettes court terme",
    unit: "ratio",
    value: 1.32,
    status: "attention",
    interpretation: "Les dettes à court terme sont couvertes de justesse.",
  },
];

function periode() {
  return {
    id: "per-1",
    label: "Exercice 2025",
    startDate: new Date("2025-01-01"),
    endDate: new Date("2025-12-31"),
    entity: {
      name: "Boulangerie Durand",
      currency: "EUR",
      organization: { name: "Cabinet Martin" },
    },
  };
}

function service(marque: unknown, liste: RatioValue[] = RATIOS) {
  const prisma = {
    accountingPeriod: { findFirst: jest.fn().mockResolvedValue(periode()) },
  } as unknown as PrismaService;

  const ratios = {
    getForPeriod: jest.fn().mockResolvedValue({
      derived: { ebitda: 120_000, resultatNet: 54_000, tresorerieNette: 31_000 },
      aggregates: { chiffreAffaires: 1_250_000 },
      ratios: liste,
      computedAt: new Date("2026-02-14"),
    }),
  } as unknown as RatiosService;

  const marqueService = {
    pourDocument: jest.fn().mockResolvedValue(marque),
  } as unknown as MarqueService;

  return new ReportsService(prisma, marqueService, ratios);
}

const MARQUE_COMPLETE = {
  nomAffiche: "Cabinet Martin & Associés",
  mentionsPied: "Cabinet Martin & Associés — 12 rue de la Paix, 75002 Paris — Membre de l'Ordre des experts-comptables",
  couleurAccent: "#8A1C3B",
  signataireNom: "Claire Martin",
  signataireFonction: "Expert-comptable, associée",
  logo: LOGO,
  logoFormat: "image/png",
  logoLargeur: 96,
  logoHauteur: 32,
  signature: SIGNATURE,
  signatureFormat: "image/png",
  signatureLargeur: 120,
  signatureHauteur: 40,
};

/**
 * Flux de contenu du PDF, décompressés.
 *
 * pdfkit comprime les flux : chercher une couleur ou un libellé dans les
 * octets bruts ne trouve rien, et un test qui ne trouve jamais rien passe
 * pour peu qu'on l'écrive en négatif.
 */
function contenu(pdf: Buffer): string {
  const octets = pdf.toString("latin1");
  const morceaux: string[] = [];
  /* « endstream » contient « stream » : sans la limite de mot à gauche, on
   * repart systématiquement de la fin du flux précédent. Et le mot-clé est
   * suivi d'un saut de ligne qui ne fait pas partie des données comprimées. */
  const motif = /(?<![a-z])stream\r?\n/g;
  for (let trouve = motif.exec(octets); trouve; trouve = motif.exec(octets)) {
    const debut = trouve.index + trouve[0].length;
    const fin = octets.indexOf("endstream", debut);
    if (fin === -1) break;
    try {
      morceaux.push(inflateSync(pdf.subarray(debut, fin)).toString("latin1"));
    } catch {
      /* Tous les flux ne sont pas comprimés par zlib — les images portent
       * leur propre codage. */
    }
    motif.lastIndex = fin;
  }
  return morceaux.join("\n");
}

/**
 * Texte lisible d'un PDF produit par pdfkit.
 *
 * Les chaînes sont écrites en hexadécimal dans les opérateurs d'affichage :
 * chercher « Cabinet Martin » dans les flux décompressés ne trouve rien.
 */
function texte(pdf: Buffer): string {
  const flux = contenu(pdf);
  return [...flux.matchAll(/<([0-9a-f]+)>/g)]
    .map((trouve) => Buffer.from(trouve[1], "hex").toString("latin1"))
    /* Recollé sans séparateur : pdfkit coupe une même ligne en plusieurs
     * chaînes pour y glisser le crénage, et « Liquidité générale » arrive en
     * deux morceaux. */
    .join("");
}

/** Composantes PDF d'une couleur hexadécimale du web. */
function composantes(hexa: string): string {
  const canal = (position: number) => Number.parseInt(hexa.slice(position, position + 2), 16) / 255;
  return `${canal(1)} ${canal(3)} ${canal(5)}`;
}

/** Nombre de pages déclaré dans le catalogue du PDF. */
function nombreDePages(pdf: Buffer): number {
  const texte = pdf.toString("latin1");
  const correspondance = texte.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  if (!correspondance) throw new Error("Catalogue de pages introuvable dans le PDF.");
  return Number(correspondance[1]);
}

describe("rapport PDF", () => {
  it("produit un PDF valide sans marque enregistrée", async () => {
    const pdf = await service(null).generatePeriodReport("org-1", "per-1");
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.subarray(-6).toString("ascii")).toContain("%%EOF");
  });

  it("tient sur une seule page : le pied de page n'en crée pas de nouvelle", async () => {
    // pdfkit pagine dès qu'un texte dépasse la marge basse, y compris à une
    // position imposée. Sans neutraliser la marge, chaque pied de page
    // ajoutait une page — qui recevait à son tour un pied de page.
    const pdf = await service(MARQUE_COMPLETE).generatePeriodReport("org-1", "per-1");
    expect(nombreDePages(pdf)).toBe(1);
  });

  it("imprime les mentions du cabinet et la numérotation en pied de page", async () => {
    const lisible = texte(await service(MARQUE_COMPLETE).generatePeriodReport("org-1", "per-1"));
    expect(lisible).toContain("Membre de l'Ordre des experts-comptables");
    expect(lisible).not.toContain("Document produit avec Cadran");
    expect(lisible).toContain("1 / 1");
  });

  it("numérote correctement un rapport qui déborde sur plusieurs pages", async () => {
    // Le piège se voit surtout au-delà d'une page : un pied de page qui
    // paginait produisait autant de pages vides que de pages utiles.
    const nombreux = Array.from({ length: 90 }, (_, index) => ({
      ...RATIOS[index % 2],
      id: `r-${index}`,
      label: `Ratio de contrôle numéro ${index}`,
    }));
    const pdf = await service(MARQUE_COMPLETE, nombreux).generatePeriodReport("org-1", "per-1");
    const pages = nombreDePages(pdf);
    expect(pages).toBeGreaterThan(1);

    const lisible = texte(pdf);
    for (let numero = 1; numero <= pages; numero += 1) {
      expect(lisible).toContain(`${numero} / ${pages}`);
    }
  });

  it("imprime les montants avec des séparateurs de milliers lisibles", async () => {
    // toLocaleString sépare par une espace fine insécable, absente de
    // l'encodage WinAnsi des polices standard du PDF : « 1 250 000 € »
    // s'imprimait « 1/250/000 € ».
    const lisible = texte(await service(null).generatePeriodReport("org-1", "per-1"));
    expect(lisible).toContain("1\u00a0250\u00a0000");
    expect(lisible).not.toContain("\u202f");
  });

  it("intègre le logo et la signature au document", async () => {
    const sans = await service(null).generatePeriodReport("org-1", "per-1");
    const avec = await service(MARQUE_COMPLETE).generatePeriodReport("org-1", "per-1");

    // Deux images embarquées : un PDF sans marque n'en porte aucune.
    expect(sans.toString("latin1")).not.toContain("/Subtype /Image");
    expect(avec.toString("latin1").match(/\/Subtype \/Image/g)).toHaveLength(2);
  });

  it("écrit la couleur d'accent du cabinet dans le document", async () => {
    const pdf = await service(MARQUE_COMPLETE).generatePeriodReport("org-1", "per-1");
    expect(contenu(pdf)).toContain(`${composantes("#8A1C3B")} scn`);
    // Et le nom du cabinet remplace celui de l'organisation en base.
    expect(texte(pdf)).toContain("Cabinet Martin & Associ");
  });

  it("ne fait confiance ni au nom ni à la couleur quand la formule exclut la marque", async () => {
    // pourDocument renvoie null : le service de marque a déjà tranché, le
    // générateur n'a pas à revérifier la formule.
    const pdf = await service(null).generatePeriodReport("org-1", "per-1");
    expect(contenu(pdf)).not.toContain(composantes("#8A1C3B"));
    // Repli sur l'identité de Cadran : son vert, et la raison sociale telle
    // qu'elle est en base.
    expect(contenu(pdf)).toContain(`${composantes("#1F4F43")} scn`);
    expect(texte(pdf)).toContain("Boulangerie Durand");
    // Et le pied de page revient à Cadran : c'est ce que la formule Cabinet
    // fait disparaître.
    expect(texte(pdf)).toContain("Document produit avec Cadran");
  });
});

describe("rapport Excel", () => {
  it("produit un classeur ouvrable", async () => {
    const xlsx = await service(null).generatePeriodReportExcel("org-1", "per-1");
    // Un .xlsx est une archive ZIP : les deux premiers octets le disent.
    expect(xlsx.subarray(0, 2).toString("ascii")).toBe("PK");
  });

  it("porte le nom du cabinet comme auteur et embarque son logo", async () => {
    const xlsx = await service(MARQUE_COMPLETE).generatePeriodReportExcel("org-1", "per-1");
    const texte = xlsx.toString("latin1");
    // Les noms de fichiers de l'archive ne sont pas compressés : on peut les
    // lire sans dézipper.
    expect(texte).toContain("xl/media/image1.png");
  });
});
