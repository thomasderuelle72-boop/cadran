import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
}

/**
 * Clés qui ne désignent pas une colonne mais la mécanique de l'objet.
 *
 * Un classeur dont une en-tête s'appelle `__proto__` fait écrire, par les
 * bibliothèques d'analyse, dans le prototype de `Object` : toute l'exécution
 * de la page en hérite ensuite. C'est la faille connue de SheetJS
 * (GHSA-4r6h-8v6p-xvw6), et le fichier vient d'un tiers — un client qui
 * envoie son grand livre, un expert-comptable qui transmet une balance.
 *
 * On ne s'en remet pas à la bibliothèque : on retire ces clés à la sortie.
 * Aucune colonne comptable ne porte ces noms, donc rien d'utile n'est perdu.
 */
const CLES_INTERDITES = new Set(["__proto__", "constructor", "prototype"]);

function assainir(lignes: Record<string, unknown>[]): Record<string, unknown>[] {
  return lignes.map((ligne) => {
    /* `Object.create(null)` plutôt qu'un littéral : l'objet n'a alors aucun
     * prototype, donc aucune clé héritée qu'une colonne pourrait masquer. */
    const propre = Object.create(null) as Record<string, unknown>;
    for (const [cle, valeur] of Object.entries(ligne)) {
      if (CLES_INTERDITES.has(cle)) continue;
      propre[cle] = valeur;
    }
    return propre;
  });
}

export function parseFile(file: File): Promise<ParsedFile> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  if (isCsv) return parseCsv(file);
  return parseSpreadsheet(file);
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        const rows = assainir(results.data);
        const headers = (results.meta.fields ?? []).filter((h) => !CLES_INTERDITES.has(h));
        resolve({ headers, rows });
      },
      error: reject,
    });
  });
}

async function parseSpreadsheet(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = assainir(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }));
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

function stripSpaces(value: string): string {
  return value.split("").filter((ch) => ch !== " " && ch.charCodeAt(0) !== 160).join("");
}

/**
 * Convertit un montant importe en nombre, en acceptant les formats francais
 * ("1 234,56", "1.234,56") et anglo-saxons ("1,234.56", "1234.56").
 */
export function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  let text = stripSpaces(String(raw ?? "").trim());
  if (!text) return 0;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    const decimalIsComma = text.lastIndexOf(",") > text.lastIndexOf(".");
    text = decimalIsComma ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (hasComma) {
    text = text.replace(",", ".");
  }

  const value = Number.parseFloat(text);
  return Number.isNaN(value) ? 0 : value;
}
