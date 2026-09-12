/**
 * Produit `exemples/fec-demonstration.txt`, un Fichier des Écritures
 * Comptables complet et équilibré, et vérifie qu'il se relit correctement.
 *
 *   npm run demo:fec
 *
 * Le fichier sert à essayer l'import de bout en bout : créez une entité
 * vierge, importez-le, et les périodes mensuelles, les ratios, les soldes
 * intermédiaires, le tableau de flux et la balance âgée se remplissent.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { genererGrandLivre, versFec } from "../apps/api/prisma/demo-ledger";
import { parseFec, fecEstEquilibre } from "../apps/api/src/fec/fec-parser";
import { agregerParMois } from "../apps/api/src/fec/fec-aggregation";
import { bilanEstEquilibre, computeDerived } from "../apps/api/src/ratios/engine";
import { computeBalanceAgee } from "../apps/api/src/analysis/encours";

const destination = join(__dirname, "..", "exemples", "fec-demonstration.txt");

const livre = genererGrandLivre();
const contenu = versFec(livre);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, contenu, "utf8");

const totalDebit = livre.reduce((somme, e) => somme + e.debit, 0);
const totalCredit = livre.reduce((somme, e) => somme + e.credit, 0);

console.log(`Écrit : ${destination}`);
console.log(`  ${livre.length} écritures · débit ${totalDebit.toFixed(2)} · crédit ${totalCredit.toFixed(2)}`);

// Relecture : le fichier doit repasser par le parseur sans une seule erreur.
const relu = parseFec(contenu);
if (relu.erreurs.length > 0) {
  console.error("Le fichier produit n'est pas relisible :", relu.erreurs.slice(0, 5));
  process.exit(1);
}
if (!fecEstEquilibre(relu)) {
  console.error(`Le fichier produit est déséquilibré de ${relu.ecart}.`);
  process.exit(1);
}
console.log(`  relu sans erreur · exercice ${relu.exercice} · équilibré`);

// Et les bilans mensuels qui en découlent doivent tous boucler.
const { periodes, comptesNonClasses } = agregerParMois(relu.ecritures);
let desequilibrees = 0;
for (const periode of periodes) {
  const derived = computeDerived(periode.agregats);
  if (!bilanEstEquilibre(derived)) {
    desequilibrees += 1;
    console.error(`  ${periode.cle} : bilan déséquilibré de ${derived.ecartBilan.toFixed(2)}`);
  }
}
if (comptesNonClasses.length > 0) {
  console.error(`  comptes non classés : ${comptesNonClasses.map((c) => c.accountCode).join(", ")}`);
  process.exit(1);
}
if (desequilibrees > 0) process.exit(1);

console.log(`  ${periodes.length} bilans mensuels, tous équilibrés`);

// Enfin : la balance âgée doit se raccorder au bilan.
//
// L'encours d'une balance âgée est le solde non lettré des comptes de tiers ;
// le bilan, lui, porte leur solde total. Les deux ne coïncident que si toute
// écriture lettrée a bien sa contrepartie de règlement dans le fichier. Un
// solde d'ouverture lettré mais jamais encaissé passerait les contrôles
// précédents tout en faisant diverger les deux écrans de plusieurs dizaines de
// milliers d'euros — c'est le genre d'écart qui ruine la confiance dans
// l'outil, donc il est vérifié ici.
const derniere = relu.ecritures.reduce(
  (max, e) => (e.entryDate > max ? e.entryDate : max),
  relu.ecritures[0].entryDate
);
const pourEncours = relu.ecritures.map((e) => ({
  journalCode: e.journalCode,
  entryNum: e.entryNum,
  entryDate: e.entryDate,
  accountCode: e.accountCode,
  auxAccountCode: e.auxAccountCode,
  auxAccountLabel: e.auxAccountLabel,
  pieceDate: e.pieceDate,
  debit: e.debit,
  credit: e.credit,
  lettering: e.lettering,
}));

const soldeComptes = (prefixe: string, sens: "DEBIT" | "CREDIT") =>
  Math.round(
    relu.ecritures
      .filter((e) => e.accountCode.startsWith(prefixe))
      .reduce((somme, e) => somme + (sens === "DEBIT" ? e.debit - e.credit : e.credit - e.debit), 0) * 100
  ) / 100;

let divergences = 0;
for (const [prefixe, sens, cote] of [
  ["41", "DEBIT", "CLIENT"],
  ["40", "CREDIT", "FOURNISSEUR"],
] as const) {
  const auBilan = soldeComptes(prefixe, sens);
  const encours = computeBalanceAgee(pourEncours, cote, derniere).encoursTotal;
  if (Math.abs(auBilan - encours) > 0.01) {
    divergences += 1;
    console.error(
      `  ${cote} : le bilan porte ${auBilan.toFixed(2)} mais la balance âgée ${encours.toFixed(2)} ` +
        `(écart ${(auBilan - encours).toFixed(2)}). Une écriture lettrée n'a pas sa contrepartie de règlement.`
    );
  }
}
if (divergences > 0) process.exit(1);
console.log("  balance âgée raccordée au bilan, côté clients et côté fournisseurs");
