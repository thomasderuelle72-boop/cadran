import { PrismaClient } from "@prisma/client";
import { NOM_DOSSIER, construireDossierTest } from "../src/plateforme/dossier-test";

/**
 * Crée ou retire le dossier de test depuis la ligne de commande.
 *
 *   npx tsx scripts/dossier-test.ts --organisation "Atelier Nova Group"
 *   npx tsx scripts/dossier-test.ts --organisation "..." --supprimer
 *
 * Les données et la construction vivent dans `src/plateforme/dossier-test.ts`,
 * d'où la console d'administration les appelle aussi : un script ne s'exécute
 * pas sur un serveur déployé, et c'est là qu'on a besoin d'un dossier d'essai.
 */

const prisma = new PrismaClient();

function lireOptions(argv: string[]) {
  const options: { organisation?: string; supprimer: boolean } = { supprimer: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--organisation") options.organisation = argv[i + 1];
    if (argv[i] === "--supprimer") options.supprimer = true;
  }
  return options;
}

async function main() {
  const options = lireOptions(process.argv.slice(2));

  const organisations = await prisma.organization.findMany({ select: { id: true, name: true } });
  if (organisations.length === 0) {
    throw new Error("Aucune organisation en base. Créez d'abord un compte.");
  }

  /*
   * Le nom est exigé dès qu'il y a plusieurs organisations. En deviner une
   * poserait le dossier chez un client au lieu du compte interne, et un
   * dossier fictif dans un dossier réel est précisément ce qu'on ne veut pas.
   */
  const organisation = options.organisation
    ? organisations.find((o) => o.name === options.organisation)
    : organisations.length === 1
      ? organisations[0]
      : undefined;

  if (!organisation) {
    throw new Error(
      `Précisez --organisation. Connues : ${organisations.map((o) => `« ${o.name} »`).join(", ")}.`
    );
  }

  const existant = await prisma.entity.findFirst({
    where: { organizationId: organisation.id, name: NOM_DOSSIER },
  });

  if (options.supprimer) {
    if (!existant) {
      console.log("Aucun dossier de test à supprimer.");
      return;
    }
    await prisma.entity.delete({ where: { id: existant.id } });
    console.log(`Dossier de test supprimé (${organisation.name}).`);
    return;
  }

  /*
   * Tout dans une transaction : la suppression de l'ancien dossier et la
   * construction du nouveau.
   *
   * Sans elle, une interruption au milieu — un Ctrl-C, un réseau qui tombe,
   * une erreur sur le troisième exercice — laisse des périodes sans ratios.
   * L'écran affiche alors un dossier dont certains exercices sont vides, ce
   * qui ressemble à un bogue du calcul plutôt qu'à un import inachevé : on
   * cherche au mauvais endroit. C'est arrivé pendant la mise au point.
   */
  await prisma.$transaction(
    async (tx) => {
      if (existant) {
        await tx.entity.delete({ where: { id: existant.id } });
        console.log(`Ancien dossier de test supprimé (${organisation.name}).`);
      }
      await construireDossierTest(tx, organisation.id, (ligne) => console.log(ligne));
    },
    { timeout: 60000 }
  );

  console.log(`\nDossier « ${NOM_DOSSIER} » créé dans « ${organisation.name} ».`);
  console.log("Pour le retirer : npx tsx scripts/dossier-test.ts --supprimer");
}

main()
  .catch((erreur) => {
    console.error(`\nÉchec : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
