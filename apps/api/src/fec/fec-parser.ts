/**
 * Parseur de Fichier des Écritures Comptables (FEC).
 *
 * Le FEC est le format normé par l'arrêté du 29 juillet 2013 (article A47 A-1
 * du Livre des procédures fiscales) que toute entreprise française tenant une
 * comptabilité informatisée doit pouvoir produire. Tous les logiciels
 * comptables l'exportent, et sa structure est fixée : c'est ce qui en fait le
 * seul format d'import qui ne demande aucun mapping à l'utilisateur.
 *
 * Ce module est volontairement pur — aucune dépendance NestJS ni Prisma — pour
 * être testable ligne à ligne. Il valide et convertit ; il ne décide rien.
 */

/** Les 18 colonnes obligatoires, dans l'ordre de l'arrêté. */
export const COLONNES_FEC = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompAuxNum",
  "CompAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "EcritureLet",
  "DateLet",
  "ValidDate",
  "Montantdevise",
  "Idevise",
] as const;

/**
 * Variante admise pour les comptabilités qui tiennent un montant signé par un
 * sens plutôt qu'une paire débit/crédit. On l'accepte et on la ramène à la
 * forme débit/crédit dès la lecture, pour que la suite n'ait qu'un seul cas.
 */
const COLONNES_MONTANT_SENS = ["Montant", "Sens"] as const;

export interface EcritureFec {
  journalCode: string;
  journalLabel: string;
  entryNum: string;
  entryDate: Date;
  accountCode: string;
  accountLabel: string;
  auxAccountCode: string | null;
  auxAccountLabel: string | null;
  pieceRef: string | null;
  pieceDate: Date | null;
  label: string;
  debit: number;
  credit: number;
  lettering: string | null;
  letteringDate: Date | null;
  validDate: Date | null;
}

export interface ErreurFec {
  /** Numéro de ligne dans le fichier, en-tête comprise (la première vaut 1). */
  ligne: number;
  message: string;
}

export interface ResultatFec {
  ecritures: EcritureFec[];
  erreurs: ErreurFec[];
  separateur: string;
  /** Année de clôture de l'exercice, déduite de la dernière date d'écriture. */
  exercice: number;
  debutExercice: Date | null;
  finExercice: Date | null;
  totalDebit: number;
  totalCredit: number;
  /**
   * Écart débit/crédit sur l'ensemble du fichier. Un FEC équilibré est à
   * zéro ; au-delà d'un centime, le fichier est incomplet ou tronqué et tout
   * ce qu'on en dérivera sera faux.
   */
  ecart: number;
}

/** Au-delà, on arrête de collecter : la liste ne sert plus à diagnostiquer. */
const MAX_ERREURS = 200;

/** Tolérance d'équilibre, en unité de devise (arrondis de conversion). */
export const TOLERANCE_EQUILIBRE_FEC = 0.01;

function normaliserEnTete(valeur: string): string {
  return valeur
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * L'arrêté admet le pipe et la tabulation ; certains exports utilisent le
 * point-virgule. On retient celui qui découpe l'en-tête en le plus de colonnes,
 * ce qui évite de se tromper quand un libellé contient l'un des autres.
 */
function detecterSeparateur(ligneEnTete: string): string {
  const candidats = ["|", "\t", ";"];
  let meilleur = "|";
  let maxColonnes = 0;
  for (const candidat of candidats) {
    const colonnes = ligneEnTete.split(candidat).length;
    if (colonnes > maxColonnes) {
      maxColonnes = colonnes;
      meilleur = candidat;
    }
  }
  return meilleur;
}

/**
 * Les montants sont écrits avec la virgule comme séparateur décimal. Les
 * espaces (y compris insécables) servent parfois de séparateur de milliers.
 */
export function lireMontant(valeur: string): number | null {
  const nettoye = valeur
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .trim();
  if (nettoye === "") return 0;
  const nombre = Number(nettoye);
  return Number.isFinite(nombre) ? nombre : null;
}

/**
 * Les dates sont au format AAAAMMJJ. On construit en UTC pour qu'une écriture
 * du 1er janvier reste au 1er janvier quel que soit le fuseau du serveur.
 */
export function lireDate(valeur: string): Date | null {
  const nettoye = valeur.trim();
  if (!/^\d{8}$/.test(nettoye)) return null;
  const annee = Number(nettoye.slice(0, 4));
  const mois = Number(nettoye.slice(4, 6));
  const jour = Number(nettoye.slice(6, 8));
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  // Rejette les dates qui « débordent » (31 février devient 3 mars).
  if (date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) return null;
  return date;
}

function videEnNull(valeur: string | undefined): string | null {
  const nettoye = (valeur ?? "").trim();
  return nettoye === "" ? null : nettoye;
}

export function parseFec(contenu: string): ResultatFec {
  const lignes = contenu.split(/\r\n|\r|\n/);
  const erreurs: ErreurFec[] = [];
  const ecritures: EcritureFec[] = [];

  const indexEnTete = lignes.findIndex((ligne) => ligne.trim() !== "");
  if (indexEnTete === -1) {
    return {
      ecritures: [],
      erreurs: [{ ligne: 1, message: "Le fichier est vide." }],
      separateur: "|",
      exercice: new Date().getUTCFullYear(),
      debutExercice: null,
      finExercice: null,
      totalDebit: 0,
      totalCredit: 0,
      ecart: 0,
    };
  }

  const separateur = detecterSeparateur(lignes[indexEnTete]);
  const enTetes = lignes[indexEnTete].split(separateur).map(normaliserEnTete);

  // Position de chaque colonne attendue. L'arrêté fixe l'ordre, mais accepter
  // un ordre différent coûte une indirection et évite de rejeter un fichier
  // parfaitement exploitable.
  const position = new Map<string, number>();
  for (const colonne of COLONNES_FEC) {
    const index = enTetes.indexOf(normaliserEnTete(colonne));
    if (index !== -1) position.set(colonne, index);
  }
  for (const colonne of COLONNES_MONTANT_SENS) {
    const index = enTetes.indexOf(normaliserEnTete(colonne));
    if (index !== -1) position.set(colonne, index);
  }

  const montantSens = position.has("Montant") && position.has("Sens");
  const manquantes = COLONNES_FEC.filter((colonne) => {
    if (montantSens && (colonne === "Debit" || colonne === "Credit")) return false;
    return !position.has(colonne);
  });

  if (manquantes.length > 0) {
    erreurs.push({
      ligne: indexEnTete + 1,
      message: `Colonnes absentes de l'en-tête : ${manquantes.join(", ")}. Un FEC doit en comporter 18.`,
    });
    return {
      ecritures: [],
      erreurs,
      separateur,
      exercice: new Date().getUTCFullYear(),
      debutExercice: null,
      finExercice: null,
      totalDebit: 0,
      totalCredit: 0,
      ecart: 0,
    };
  }

  const champ = (colonnes: string[], nom: string): string => {
    const index = position.get(nom);
    return index === undefined ? "" : (colonnes[index] ?? "");
  };

  let totalDebit = 0;
  let totalCredit = 0;
  let debutExercice: Date | null = null;
  let finExercice: Date | null = null;

  for (let i = indexEnTete + 1; i < lignes.length; i++) {
    const brute = lignes[i];
    if (brute.trim() === "") continue;

    const numeroLigne = i + 1;
    const colonnes = brute.split(separateur);

    const ajouterErreur = (message: string) => {
      if (erreurs.length < MAX_ERREURS) erreurs.push({ ligne: numeroLigne, message });
    };

    const entryDate = lireDate(champ(colonnes, "EcritureDate"));
    if (!entryDate) {
      ajouterErreur("Date d'écriture illisible (format attendu : AAAAMMJJ).");
      continue;
    }

    const accountCode = champ(colonnes, "CompteNum").trim();
    if (accountCode === "") {
      ajouterErreur("Numéro de compte absent.");
      continue;
    }

    let debit: number | null;
    let credit: number | null;

    if (montantSens) {
      const montant = lireMontant(champ(colonnes, "Montant"));
      const sens = champ(colonnes, "Sens").trim().toUpperCase();
      if (montant === null) {
        ajouterErreur("Montant illisible.");
        continue;
      }
      if (sens !== "D" && sens !== "C") {
        ajouterErreur(`Sens « ${sens} » inattendu (D ou C attendu).`);
        continue;
      }
      debit = sens === "D" ? montant : 0;
      credit = sens === "C" ? montant : 0;
    } else {
      debit = lireMontant(champ(colonnes, "Debit"));
      credit = lireMontant(champ(colonnes, "Credit"));
      if (debit === null || credit === null) {
        ajouterErreur("Montant débit ou crédit illisible.");
        continue;
      }
    }

    totalDebit += debit;
    totalCredit += credit;

    if (!debutExercice || entryDate < debutExercice) debutExercice = entryDate;
    if (!finExercice || entryDate > finExercice) finExercice = entryDate;

    ecritures.push({
      journalCode: champ(colonnes, "JournalCode").trim(),
      journalLabel: champ(colonnes, "JournalLib").trim(),
      entryNum: champ(colonnes, "EcritureNum").trim(),
      entryDate,
      accountCode,
      accountLabel: champ(colonnes, "CompteLib").trim(),
      auxAccountCode: videEnNull(champ(colonnes, "CompAuxNum")),
      auxAccountLabel: videEnNull(champ(colonnes, "CompAuxLib")),
      pieceRef: videEnNull(champ(colonnes, "PieceRef")),
      pieceDate: lireDate(champ(colonnes, "PieceDate")),
      label: champ(colonnes, "EcritureLib").trim(),
      debit,
      credit,
      lettering: videEnNull(champ(colonnes, "EcritureLet")),
      letteringDate: lireDate(champ(colonnes, "DateLet")),
      validDate: lireDate(champ(colonnes, "ValidDate")),
    });
  }

  const ecart = Math.round((totalDebit - totalCredit) * 100) / 100;

  return {
    ecritures,
    erreurs,
    separateur,
    // L'exercice porte le nom de son année de clôture : un exercice
    // 01/07/2025 – 30/06/2026 est « l'exercice 2026 ».
    exercice: finExercice ? finExercice.getUTCFullYear() : new Date().getUTCFullYear(),
    debutExercice,
    finExercice,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    ecart,
  };
}

export function fecEstEquilibre(resultat: Pick<ResultatFec, "ecart">): boolean {
  return Math.abs(resultat.ecart) <= TOLERANCE_EQUILIBRE_FEC;
}
