import Papa from "papaparse";
import { readSheet, type Row } from "read-excel-file/browser";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
}

/**
 * Clés qui ne désignent pas une colonne mais la mécanique de l'objet.
 *
 * Un classeur dont une en-tête s'appelle `__proto__` fait écrire, par les
 * bibliothèques d'analyse, dans le prototype de `Object` : toute l'exécution
 * de la page en hérite ensuite. Le fichier vient d'un tiers — un client qui
 * envoie son grand livre, un expert-comptable qui transmet une balance.
 *
 * On ne s'en remet pas à la bibliothèque : on retire ces clés à la sortie.
 * Aucune colonne comptable ne porte ces noms, donc rien d'utile n'est perdu.
 */
const CLES_INTERDITES = new Set(["__proto__", "constructor", "prototype"]);

function assainir(
  lignes: Record<string, unknown>[],
): Record<string, unknown>[] {
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
        const headers = (results.meta.fields ?? []).filter(
          (h) => !CLES_INTERDITES.has(h),
        );
        resolve({ headers, rows });
      },
      error: reject,
    });
  });
}

/**
 * Les classeurs, lus par `read-excel-file`.
 *
 * SheetJS a quitté npm : la version qui y reste publiée porte deux failles
 * sans correctif amont — une pollution de prototype et un déni de service par
 * expression régulière, qu'un fichier fabriqué suffit à déclencher dans
 * l'onglet du client. Les paquets npm qui proposent la version corrigée sont
 * des republications par des tiers du tarball officiel : échanger une faille
 * connue contre un intermédiaire non officiel, sur l'outil qui lit les grands
 * livres de nos clients, n'est pas un progrès.
 *
 * `read-excel-file` est une bibliothèque indépendante, maintenue, sans
 * vulnérabilité connue. Elle rend des lignes de cellules et non des objets :
 * c'est nous qui construisons les objets, sur un prototype nul, ce qui retire
 * la pollution de prototype de la liste des choses possibles au lieu de la
 * corriger.
 *
 * Ce qu'on perd : le `.xls` d'avant 2007, que SheetJS savait lire. Le dire
 * franchement vaut mieux qu'un « fichier illisible » — un comptable sait
 * réenregistrer un classeur, encore faut-il qu'on lui dise lequel.
 */
async function parseSpreadsheet(file: File): Promise<ParsedFile> {
  if (/\.xls$/i.test(file.name)) {
    throw new Error(
      "Les classeurs au format .xls (Excel 97-2003) ne sont pas lus. " +
        "Réenregistrez le fichier en .xlsx ou en CSV, puis réessayez.",
    );
  }

  const lignes = await readSheet(file);
  if (lignes.length === 0) return { headers: [], rows: [] };

  /*
   * Une cellule vide revient à `null` ; l'ancienne lecture rendait "". Les
   * écrans en aval distinguent une chaîne vide d'une valeur absente, et la
   * bascule changerait leur comportement sans qu'on l'ait décidé.
   */
  const cellule = (valeur: unknown): unknown => (valeur === null ? "" : valeur);

  const headers = entetes(lignes[0]);
  const rows = lignes.slice(1).map((ligne: Row) => {
    const objet: Record<string, unknown> = {};
    headers.forEach((entete, colonne) => {
      objet[entete] = cellule(ligne[colonne]);
    });
    return objet;
  });

  return {
    headers: headers.filter((h) => !CLES_INTERDITES.has(h)),
    rows: assainir(rows),
  };
}

/**
 * Noms de colonnes tirés de la première ligne.
 *
 * Deux colonnes homonymes, ou une en-tête vide, arrivent couramment dans un
 * export comptable. Sans nom distinct, la seconde écrase la première et une
 * colonne disparaît silencieusement du fichier importé — on numérote plutôt
 * que de perdre la donnée.
 */
export function entetes(premiere: readonly unknown[]): string[] {
  const vus = new Map<string, number>();
  return premiere.map((brut, index) => {
    const nom =
      brut === null || String(brut).trim() === ""
        ? `Colonne ${index + 1}`
        : String(brut).trim();
    const dejaVu = vus.get(nom);
    vus.set(nom, (dejaVu ?? 0) + 1);
    return dejaVu === undefined ? nom : `${nom} (${dejaVu + 1})`;
  });
}

function stripSpaces(value: string): string {
  return value
    .split("")
    .filter((ch) => ch !== " " && ch.charCodeAt(0) !== 160)
    .join("");
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
    text = decimalIsComma
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (hasComma) {
    text = text.replace(",", ".");
  }

  const value = Number.parseFloat(text);
  return Number.isNaN(value) ? 0 : value;
}
