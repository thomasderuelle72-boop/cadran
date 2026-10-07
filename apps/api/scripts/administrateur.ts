/**
 * Création d'un administrateur de la plateforme, en ligne de commande.
 *
 * Il faut bien un premier compte, et il ne peut pas venir de l'application :
 * un écran capable de se donner les pleins pouvoirs serait, par construction,
 * une porte dérobée. Il vient donc d'ici, c'est-à-dire d'un accès à la base.
 *
 * Le mot de passe n'est **jamais** écrit dans un fichier du dépôt ni dans une
 * variable d'environnement de l'hébergeur. Il est tiré au hasard, affiché une
 * fois, et seul son condensat bcrypt est conservé. Perdu, il se refait ; il ne
 * se retrouve pas.
 *
 * Usage :
 *   npm run administrateur --workspace=apps/api -- \
 *     --email vous@exemple.fr --nom "Votre Nom" [--organisation "Cadran"] \
 *     [--mot-de-passe "…"] [--sans-plateforme]
 *
 * Contre la base de production, préfixer par DATABASE_URL=… : le script ne va
 * jamais ailleurs que là où cette variable pointe, et il le dit avant d'agir.
 */
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { bitsEntropie, genererMotDePasse } from "../src/plateforme/motdepasse";

const prisma = new PrismaClient();

interface Options {
  email: string;
  nom: string;
  organisation: string;
  motDePasse?: string;
  plateforme: boolean;
}

function lireOptions(argv: string[]): Options {
  const valeurs = new Map<string, string>();
  const drapeaux = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const cle = argv[i].slice(2);

    /* Tous les mots jusqu'au drapeau suivant, pas seulement le premier : npm
     * perd les guillemets en transmettant ce qui suit `--`, si bien que
     * `--nom "Thomas Deruelle"` arrive ici en deux morceaux. Ne garder que le
     * premier enregistrait silencieusement un prénom pour un nom complet. */
    const morceaux: string[] = [];
    while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      morceaux.push(argv[i + 1]);
      i += 1;
    }

    if (morceaux.length > 0) valeurs.set(cle, morceaux.join(" "));
    else drapeaux.add(cle);
  }

  const email = valeurs.get("email")?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("--email est obligatoire et doit être une adresse.");
  }
  const motDePasse = valeurs.get("mot-de-passe");
  if (motDePasse && motDePasse.length < 12) {
    throw new Error("Un mot de passe fourni à la main fait au moins 12 caractères.");
  }

  return {
    email,
    nom: valeurs.get("nom")?.trim() || email.split("@")[0],
    organisation: valeurs.get("organisation")?.trim() || "Cadran",
    motDePasse,
    // Le droit d'administrer la plateforme est l'objet du script : il est
    // donné par défaut, et retiré explicitement si on ne le veut pas.
    plateforme: !drapeaux.has("sans-plateforme"),
  };
}

/** Masque l'URL de base : elle contient le mot de passe du serveur. */
function cibleLisible(url: string | undefined): string {
  if (!url) return "(DATABASE_URL absente)";
  try {
    const analysee = new URL(url);
    return `${analysee.host}${analysee.pathname}`;
  } catch {
    return "(DATABASE_URL illisible)";
  }
}

async function main() {
  const options = lireOptions(process.argv.slice(2));
  console.log(`Base visée : ${cibleLisible(process.env.DATABASE_URL)}`);

  const motDePasse = options.motDePasse ?? genererMotDePasse();
  const passwordHash = await bcrypt.hash(motDePasse, 10);

  const existant = await prisma.user.findUnique({ where: { email: options.email } });

  if (existant) {
    /*
     * Le compte existe : on le promeut sans toucher à son organisation. Le
     * déplacer emporterait avec lui l'accès à des données qui ne sont pas les
     * siennes, ce qui n'est jamais ce qu'on veut dire par « donne-lui les
     * droits ».
     */
    await prisma.user.update({
      where: { id: existant.id },
      data: {
        role: Role.ADMIN,
        administrateurPlateforme: options.plateforme,
        ...(options.motDePasse || !process.env.CADRAN_CONSERVER_MOT_DE_PASSE
          ? { passwordHash, sessionsValablesApres: new Date() }
          : {}),
      },
    });
    /*
     * La formule suit le droit, sur cette branche comme sur l'autre.
     *
     * Elle ne le faisait pas : promouvoir un compte existant lui donnait la
     * console d'administration et le laissait sur son ancien forfait — essai
     * compris, échéance comprise. L'administrateur se retrouvait bridé par une
     * limite de dossiers sur sa propre installation, et l'oubli était invisible
     * puisque le script n'affichait rien de l'abonnement sur ce chemin. C'est
     * ce chemin qu'emprunte toute installation déjà en service.
     *
     * Conditionné à `--plateforme` : un simple passage au rôle ADMIN ne doit
     * pas offrir une formule sans limite à l'organisation d'un client.
     */
    const abonnement = options.plateforme
      ? await prisma.subscription.upsert({
          where: { organizationId: existant.organizationId },
          create: {
            organizationId: existant.organizationId,
            plan: "interne",
            statut: "actif",
            finPeriode: null,
          },
          update: { plan: "interne", statut: "actif", finPeriode: null },
        })
      : null;

    console.log(`\nCompte existant promu : ${options.email}`);
    console.log(`  rôle                      ADMIN`);
    console.log(`  administrateur plateforme ${options.plateforme ? "oui" : "non"}`);
    if (abonnement) {
      console.log(
        `  formule                   ${abonnement.plan} (${abonnement.statut}, ` +
          `${abonnement.finPeriode ? abonnement.finPeriode.toISOString().slice(0, 10) : "sans échéance"})`
      );
    }
    console.log(`  mot de passe              ${motDePasse}`);
    console.log(`  (les sessions ouvertes de ce compte sont closes)`);
  } else {
    /* L'organisation d'accueil est retrouvée par son nom plutôt que créée
     * systématiquement : relancer le script ne doit pas semer des doublons. */
    const organisation =
      (await prisma.organization.findFirst({ where: { name: options.organisation } })) ??
      (await prisma.organization.create({ data: { name: options.organisation } }));

    await prisma.user.create({
      data: {
        email: options.email,
        name: options.nom,
        passwordHash,
        role: Role.ADMIN,
        organizationId: organisation.id,
        administrateurPlateforme: options.plateforme,
      },
    });

    /* La formule interne, sans échéance : l'exploitant ne se facture pas
     * lui-même, et un essai qui expire lui fermerait sa propre console. Elle
     * plutôt que « Groupe » pour que son accès ne dépende d'aucun produit
     * vendu — retoucher les quotas de Groupe pour une raison tarifaire ne doit
     * pas retoucher l'accès de celui qui administre. */
    const abonnement = await prisma.subscription.upsert({
      where: { organizationId: organisation.id },
      create: { organizationId: organisation.id, plan: "interne", statut: "actif", finPeriode: null },
      update: { plan: "interne", statut: "actif", finPeriode: null },
    });

    console.log(`\nCompte créé : ${options.email}`);
    console.log(`  organisation              ${organisation.name}`);
    console.log(`  rôle                      ADMIN`);
    console.log(`  administrateur plateforme ${options.plateforme ? "oui" : "non"}`);
    /* Lu dans ce que la base a réellement enregistré, et non recopié à la
     * main : le littéral disait encore « groupe » longtemps après que le code
     * eut basculé sur « interne ». Un script qui ment sur ce qu'il vient de
     * faire est pire qu'un script muet. */
    console.log(
      `  formule                   ${abonnement.plan} (${abonnement.statut}, ` +
        `${abonnement.finPeriode ? abonnement.finPeriode.toISOString().slice(0, 10) : "sans échéance"})`
    );
    console.log(`  mot de passe              ${motDePasse}`);
  }

  if (!options.motDePasse) {
    console.log(
      `\n  Environ ${bitsEntropie(motDePasse.replace(/-/g, "").length)} bits d'entropie. ` +
        `Rangez-le dans un gestionnaire de mots de passe : il n'est stocké qu'en condensat ` +
        `et ne peut pas être relu.`
    );
  }
}

main()
  .catch((erreur) => {
    console.error(`\nÉchec : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
