import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
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
        const headers = results.meta.fields ?? [];
        resolve({ headers, rows: results.data });
      },
      error: reject,
    });
  });
}

async function parseSpreadsheet(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
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
