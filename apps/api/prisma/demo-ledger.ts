/**
 * Générateur de grand livre de démonstration.
 *
 * Produit un exercice 2026 complet et équilibré pour une société fictive :
 * à-nouveaux, ventes et achats avec tiers et lettrage, paie, charges
 * externes, amortissements, emprunt, TVA et impôt. Chaque écriture est
 * équilibrée à la construction, donc le fichier l'est aussi.
 *
 * Sert à deux choses :
 *   - alimenter le jeu de démonstration, pour que la balance âgée et la
 *     concentration aient de la matière dès la première connexion ;
 *   - produire un fichier FEC d'exemple (`npm run demo:fec`) qui permet
 *     d'essayer l'import de bout en bout sur une entité vierge.
 *
 * Les montants sont choisis pour qu'une histoire se lise : un client pèse
 * 27 % du chiffre d'affaires et paie à plus de 90 jours, ce qui rend le DSO
 * et l'indice de concentration éloquents plutôt que décoratifs.
 */

export interface EcritureDemo {
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

const TVA = 0.2;
const ANNEE = 2026;

const JOURNAUX = {
  AN: "À-nouveaux",
  VTE: "Ventes",
  ACH: "Achats",
  BQ: "Banque",
  OD: "Opérations diverses",
} as const;

interface Tiers {
  code: string;
  nom: string;
  /** Part du total annuel. */
  poids: number;
  /** Jour du mois d'émission de la facture. */
  jour: number;
  /** Délai de règlement constaté, en jours. */
  delai: number;
}

/** Le premier client pèse 27 % et paie à 95 jours : c'est toute l'histoire. */
const CLIENTS: Tiers[] = [
  { code: "C001", nom: "Constructions Vallier", poids: 0.27, jour: 4, delai: 95 },
  { code: "C002", nom: "Groupe Ambert", poids: 0.19, jour: 7, delai: 62 },
  { code: "C003", nom: "Menuiseries Lafon", poids: 0.14, jour: 10, delai: 45 },
  { code: "C004", nom: "Atelier Rivaud", poids: 0.11, jour: 13, delai: 30 },
  { code: "C005", nom: "Solutions Bertholet", poids: 0.09, jour: 16, delai: 40 },
  { code: "C006", nom: "Charpentes Ozanne", poids: 0.08, jour: 19, delai: 55 },
  { code: "C007", nom: "Escaliers Mory", poids: 0.07, jour: 22, delai: 35 },
  { code: "C008", nom: "Diffusion Nadaud", poids: 0.05, jour: 25, delai: 25 },
];

const FOURNISSEURS: Tiers[] = [
  { code: "F001", nom: "Aciers Delmas", poids: 0.34, jour: 5, delai: 45 },
  { code: "F002", nom: "Bois du Forez", poids: 0.24, jour: 8, delai: 30 },
  { code: "F003", nom: "Quincaillerie Pons", poids: 0.18, jour: 12, delai: 60 },
  { code: "F004", nom: "Transports Vialle", poids: 0.13, jour: 17, delai: 30 },
  { code: "F005", nom: "Énergie Cévennes", poids: 0.11, jour: 21, delai: 30 },
];

/** Chiffre d'affaires hors taxes par mois : une saisonnalité d'atelier. */
const CA_MENSUEL = [128000, 134000, 146000, 152000, 158000, 163000, 141000, 96000, 172000, 168000, 159000, 147000];
/** Achats de matières, hors taxes. */
const ACHATS_MENSUEL = [53000, 55000, 60000, 63000, 65000, 67000, 58000, 40000, 71000, 69000, 65000, 60000];

const LOYER_MENSUEL = 4500;
const FRAIS_DIVERS_MENSUEL = 1800;
const SALAIRES_MENSUEL = 28000;
const CHARGES_SOCIALES_MENSUEL = 11000;
const IMPOTS_TAXES_MENSUEL = 900;
const DOTATION_MENSUELLE = 2500;
const INTERETS_MENSUELS = 320;
const CAPITAL_EMPRUNT_MENSUEL = 1800;
const IS_MENSUEL = 2400;

const jour = (mois: number, j: number) => new Date(Date.UTC(ANNEE, mois, j));

function ajouterJours(date: Date, jours: number): Date {
  return new Date(date.getTime() + jours * 24 * 60 * 60 * 1000);
}

const FIN_EXERCICE = new Date(Date.UTC(ANNEE, 11, 31));

function arrondi(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

/**
 * Répartit un total entre des tiers selon leurs poids, en donnant au dernier
 * le reliquat d'arrondi : la somme des parts vaut exactement le total, ce qui
 * permet d'affirmer que le chiffre d'affaires du grand livre est bien celui
 * annoncé.
 */
function repartir(total: number, tiers: Tiers[]): number[] {
  const parts = tiers.slice(0, -1).map((t) => Math.round(total * t.poids));
  const reste = total - parts.reduce((somme, part) => somme + part, 0);
  return [...parts, reste];
}

export function genererGrandLivre(): EcritureDemo[] {
  const ecritures: EcritureDemo[] = [];
  let sequence = 0;

  const ajouter = (
    journalCode: keyof typeof JOURNAUX,
    numero: string,
    date: Date,
    accountCode: string,
    accountLabel: string,
    debit: number,
    credit: number,
    label: string,
    extra: Partial<EcritureDemo> = {}
  ) => {
    ecritures.push({
      journalCode,
      journalLabel: JOURNAUX[journalCode],
      entryNum: numero,
      entryDate: date,
      accountCode,
      accountLabel,
      auxAccountCode: null,
      auxAccountLabel: null,
      pieceRef: null,
      pieceDate: date,
      label,
      debit: arrondi(debit),
      credit: arrondi(credit),
      lettering: null,
      letteringDate: null,
      validDate: date,
      ...extra,
    });
  };

  // --- À-nouveaux : bilan d'ouverture, équilibré à 314 000 -----------------
  const ouverture = jour(0, 1);
  sequence += 1;
  const numAn = `AN${String(sequence).padStart(5, "0")}`;
  const anouveaux: Array<[string, string, number, number]> = [
    ["215000", "Matériel industriel", 180000, 0],
    ["281500", "Amortissements du matériel industriel", 0, 60000],
    ["370000", "Stocks de marchandises", 52000, 0],
    ["411000", "Clients", 96000, 0],
    ["445660", "TVA déductible", 8000, 0],
    ["512000", "Banque", 38000, 0],
    ["101000", "Capital social", 0, 100000],
    ["110000", "Report à nouveau", 0, 96000],
    ["164000", "Emprunts auprès des établissements de crédit", 0, 90000],
    ["401000", "Fournisseurs", 0, 24000],
    ["445710", "TVA collectée", 0, 4000],
  ];
  for (const [code, libelle, debit, credit] of anouveaux) {
    // Les créances et dettes d'ouverture sont lettrées : elles ont été
    // réglées au premier trimestre et ne doivent pas polluer la balance âgée.
    const estTiers = code === "411000" || code === "401000";
    ajouter("AN", numAn, ouverture, code, libelle, debit, credit, "À-nouveau 2026", {
      pieceRef: "AN-2026",
      ...(estTiers
        ? {
            auxAccountCode: code === "411000" ? "C001" : "F001",
            auxAccountLabel: code === "411000" ? "Constructions Vallier" : "Aciers Delmas",
            lettering: "AN",
            letteringDate: jour(2, 31),
          }
        : {}),
    });
  }

  // --- Exploitation, mois par mois ----------------------------------------
  for (let mois = 0; mois < 12; mois++) {
    const partsClients = repartir(CA_MENSUEL[mois], CLIENTS);
    const partsFournisseurs = repartir(ACHATS_MENSUEL[mois], FOURNISSEURS);

    let tvaCollectee = 0;
    let tvaDeductible = 0;

    // Ventes.
    CLIENTS.forEach((client, index) => {
      const ht = partsClients[index];
      if (ht <= 0) return;
      const tva = arrondi(ht * TVA);
      const ttc = arrondi(ht + tva);
      tvaCollectee += tva;

      const dateFacture = jour(mois, client.jour);
      sequence += 1;
      const numero = `VT${String(sequence).padStart(5, "0")}`;
      const reference = `FA-${ANNEE}-${String(mois + 1).padStart(2, "0")}${client.code}`;

      const dateReglement = ajouterJours(dateFacture, client.delai);
      const regle = dateReglement <= FIN_EXERCICE;
      const lettre = regle ? `L${numero}` : null;

      ajouter("VTE", numero, dateFacture, "411000", "Clients", ttc, 0, `Facture ${client.nom}`, {
        auxAccountCode: client.code,
        auxAccountLabel: client.nom,
        pieceRef: reference,
        lettering: lettre,
        letteringDate: regle ? dateReglement : null,
      });
      ajouter("VTE", numero, dateFacture, "706000", "Prestations de services", 0, ht, `Facture ${client.nom}`, {
        pieceRef: reference,
      });
      ajouter("VTE", numero, dateFacture, "445710", "TVA collectée", 0, tva, `Facture ${client.nom}`, {
        pieceRef: reference,
      });

      if (regle) {
        sequence += 1;
        const numeroReglement = `BQ${String(sequence).padStart(5, "0")}`;
        ajouter("BQ", numeroReglement, dateReglement, "512000", "Banque", ttc, 0, `Règlement ${client.nom}`, {
          pieceRef: reference,
        });
        ajouter("BQ", numeroReglement, dateReglement, "411000", "Clients", 0, ttc, `Règlement ${client.nom}`, {
          auxAccountCode: client.code,
          auxAccountLabel: client.nom,
          pieceRef: reference,
          lettering: lettre,
          letteringDate: dateReglement,
        });
      }
    });

    // Achats de matières.
    FOURNISSEURS.forEach((fournisseur, index) => {
      const ht = partsFournisseurs[index];
      if (ht <= 0) return;
      const tva = arrondi(ht * TVA);
      const ttc = arrondi(ht + tva);
      tvaDeductible += tva;

      const dateFacture = jour(mois, fournisseur.jour);
      sequence += 1;
      const numero = `AC${String(sequence).padStart(5, "0")}`;
      const reference = `FF-${ANNEE}-${String(mois + 1).padStart(2, "0")}${fournisseur.code}`;

      const dateReglement = ajouterJours(dateFacture, fournisseur.delai);
      const regle = dateReglement <= FIN_EXERCICE;
      const lettre = regle ? `L${numero}` : null;

      ajouter("ACH", numero, dateFacture, "601000", "Achats de matières premières", ht, 0, `Facture ${fournisseur.nom}`, {
        pieceRef: reference,
      });
      ajouter("ACH", numero, dateFacture, "445660", "TVA déductible", tva, 0, `Facture ${fournisseur.nom}`, {
        pieceRef: reference,
      });
      ajouter("ACH", numero, dateFacture, "401000", "Fournisseurs", 0, ttc, `Facture ${fournisseur.nom}`, {
        auxAccountCode: fournisseur.code,
        auxAccountLabel: fournisseur.nom,
        pieceRef: reference,
        lettering: lettre,
        letteringDate: regle ? dateReglement : null,
      });

      if (regle) {
        sequence += 1;
        const numeroReglement = `BQ${String(sequence).padStart(5, "0")}`;
        ajouter("BQ", numeroReglement, dateReglement, "401000", "Fournisseurs", ttc, 0, `Règlement ${fournisseur.nom}`, {
          auxAccountCode: fournisseur.code,
          auxAccountLabel: fournisseur.nom,
          pieceRef: reference,
          lettering: lettre,
          letteringDate: dateReglement,
        });
        ajouter("BQ", numeroReglement, dateReglement, "512000", "Banque", 0, ttc, `Règlement ${fournisseur.nom}`, {
          pieceRef: reference,
        });
      }
    });

    // Loyer et frais divers, réglés au comptant.
    const chargesExternes = LOYER_MENSUEL + FRAIS_DIVERS_MENSUEL;
    const tvaCharges = arrondi(chargesExternes * TVA);
    tvaDeductible += tvaCharges;
    sequence += 1;
    const numCharges = `AC${String(sequence).padStart(5, "0")}`;
    const dateCharges = jour(mois, 5);
    ajouter("ACH", numCharges, dateCharges, "613000", "Locations", LOYER_MENSUEL, 0, "Loyer de l'atelier");
    ajouter("ACH", numCharges, dateCharges, "626000", "Frais postaux et télécommunications", FRAIS_DIVERS_MENSUEL, 0, "Frais généraux");
    ajouter("ACH", numCharges, dateCharges, "445660", "TVA déductible", tvaCharges, 0, "Loyer et frais généraux");
    ajouter("ACH", numCharges, dateCharges, "512000", "Banque", 0, chargesExternes + tvaCharges, "Loyer et frais généraux");

    // Paie : constatation puis versement dans le mois.
    sequence += 1;
    const numPaie = `OD${String(sequence).padStart(5, "0")}`;
    const datePaie = jour(mois, 28);
    ajouter("OD", numPaie, datePaie, "641000", "Rémunérations du personnel", SALAIRES_MENSUEL, 0, "Salaires du mois");
    ajouter("OD", numPaie, datePaie, "645000", "Charges de sécurité sociale", CHARGES_SOCIALES_MENSUEL, 0, "Charges sociales");
    ajouter("OD", numPaie, datePaie, "421000", "Personnel — rémunérations dues", 0, SALAIRES_MENSUEL, "Salaires du mois");
    ajouter("OD", numPaie, datePaie, "431000", "Sécurité sociale", 0, CHARGES_SOCIALES_MENSUEL, "Charges sociales");

    sequence += 1;
    const numVersement = `BQ${String(sequence).padStart(5, "0")}`;
    ajouter("BQ", numVersement, datePaie, "421000", "Personnel — rémunérations dues", SALAIRES_MENSUEL, 0, "Virement des salaires");
    ajouter("BQ", numVersement, datePaie, "431000", "Sécurité sociale", CHARGES_SOCIALES_MENSUEL, 0, "Versement des cotisations");
    ajouter("BQ", numVersement, datePaie, "512000", "Banque", 0, SALAIRES_MENSUEL + CHARGES_SOCIALES_MENSUEL, "Paie du mois");

    // Impôts et taxes.
    sequence += 1;
    const numImpots = `BQ${String(sequence).padStart(5, "0")}`;
    ajouter("BQ", numImpots, jour(mois, 15), "635000", "Impôts et taxes", IMPOTS_TAXES_MENSUEL, 0, "Taxes assises sur les salaires");
    ajouter("BQ", numImpots, jour(mois, 15), "512000", "Banque", 0, IMPOTS_TAXES_MENSUEL, "Taxes assises sur les salaires");

    // Échéance d'emprunt : intérêts en charge, capital en réduction de dette.
    sequence += 1;
    const numEmprunt = `BQ${String(sequence).padStart(5, "0")}`;
    ajouter("BQ", numEmprunt, jour(mois, 5), "661000", "Charges d'intérêts", INTERETS_MENSUELS, 0, "Intérêts de l'emprunt");
    ajouter("BQ", numEmprunt, jour(mois, 5), "164000", "Emprunts auprès des établissements de crédit", CAPITAL_EMPRUNT_MENSUEL, 0, "Amortissement de l'emprunt");
    ajouter("BQ", numEmprunt, jour(mois, 5), "512000", "Banque", 0, INTERETS_MENSUELS + CAPITAL_EMPRUNT_MENSUEL, "Échéance d'emprunt");

    // Amortissement de l'outil industriel.
    sequence += 1;
    const numDotation = `OD${String(sequence).padStart(5, "0")}`;
    const finDeMois = new Date(Date.UTC(ANNEE, mois + 1, 0));
    ajouter("OD", numDotation, finDeMois, "681100", "Dotations aux amortissements", DOTATION_MENSUELLE, 0, "Dotation du mois");
    ajouter("OD", numDotation, finDeMois, "281500", "Amortissements du matériel industriel", 0, DOTATION_MENSUELLE, "Dotation du mois");

    // Impôt sur les sociétés : provision mensuelle, versée le mois suivant.
    sequence += 1;
    const numIs = `OD${String(sequence).padStart(5, "0")}`;
    ajouter("OD", numIs, finDeMois, "695000", "Impôts sur les bénéfices", IS_MENSUEL, 0, "Impôt sur les sociétés");
    ajouter("OD", numIs, finDeMois, "444000", "État — impôt sur les bénéfices", 0, IS_MENSUEL, "Impôt sur les sociétés");

    sequence += 1;
    const numIsRegle = `BQ${String(sequence).padStart(5, "0")}`;
    ajouter("BQ", numIsRegle, finDeMois, "444000", "État — impôt sur les bénéfices", IS_MENSUEL, 0, "Acompte d'impôt sur les sociétés");
    ajouter("BQ", numIsRegle, finDeMois, "512000", "Banque", 0, IS_MENSUEL, "Acompte d'impôt sur les sociétés");

    // Déclaration de TVA : la collectée du mois, moins la déductible, réglée
    // au comptant pour garder l'exemple lisible.
    const tvaDue = arrondi(tvaCollectee - tvaDeductible);
    sequence += 1;
    const numTva = `OD${String(sequence).padStart(5, "0")}`;
    ajouter("OD", numTva, finDeMois, "445710", "TVA collectée", tvaCollectee, 0, "Déclaration de TVA");
    ajouter("OD", numTva, finDeMois, "445660", "TVA déductible", 0, tvaDeductible, "Déclaration de TVA");
    if (tvaDue >= 0) {
      ajouter("OD", numTva, finDeMois, "512000", "Banque", 0, tvaDue, "Règlement de TVA");
    } else {
      ajouter("OD", numTva, finDeMois, "512000", "Banque", -tvaDue, 0, "Crédit de TVA remboursé");
    }
  }

  return ecritures.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
}

const FORMAT_DATE = (date: Date | null): string =>
  date
    ? `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`
    : "";

const MONTANT = (valeur: number): string => valeur.toFixed(2).replace(".", ",");

/** Sérialise le grand livre au format FEC, séparateur pipe. */
export function versFec(ecritures: EcritureDemo[]): string {
  const enTete = [
    "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib",
    "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
    "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise",
  ].join("|");

  const lignes = ecritures.map((e) =>
    [
      e.journalCode,
      e.journalLabel,
      e.entryNum,
      FORMAT_DATE(e.entryDate),
      e.accountCode,
      e.accountLabel,
      e.auxAccountCode ?? "",
      e.auxAccountLabel ?? "",
      e.pieceRef ?? "",
      FORMAT_DATE(e.pieceDate),
      e.label,
      MONTANT(e.debit),
      MONTANT(e.credit),
      e.lettering ?? "",
      FORMAT_DATE(e.letteringDate),
      FORMAT_DATE(e.validDate),
      "",
      "",
    ].join("|")
  );

  return [enTete, ...lignes].join("\n") + "\n";
}
