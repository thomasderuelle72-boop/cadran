import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Désignation du ou des administrateurs de la plateforme au démarrage.
 *
 * Il faut bien un premier compte, et sur un hébergement dont la base n'est
 * joignable que depuis son réseau privé, on ne peut pas se contenter d'un
 * script lancé depuis un poste. D'où cet amorçage.
 *
 * **Aucun mot de passe ne passe par ici.** La variable ne porte qu'une
 * adresse : le compte se crée par la page d'inscription ordinaire, avec un
 * mot de passe que son titulaire choisit et qui ne transite nulle part. La
 * variable ne fait qu'une chose, lever le drapeau d'administration sur un
 * compte qui existe déjà.
 *
 * C'est la différence entre « voici l'adresse de la personne de confiance »
 * et « voici ses identifiants ». La première tient dans une variable
 * d'environnement sans rien compromettre ; la seconde finirait dans les
 * journaux de déploiement, dans l'historique du terminal, et dans la copie
 * d'écran qu'on envoie au support de l'hébergeur.
 *
 * L'opération est idempotente : relancée à chaque démarrage, elle ne fait
 * rien quand le drapeau est déjà levé. Elle ne le retire jamais non plus —
 * retirer un droit se fait depuis la console, où c'est tracé.
 */
export const VARIABLE = "CADRAN_ADMIN_PLATEFORME";

@Injectable()
export class AmorcagePlateforme implements OnApplicationBootstrap {
  private readonly logger = new Logger(AmorcagePlateforme.name);

  constructor(private prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const adresses = lireAdresses(process.env[VARIABLE]);
    if (adresses.length === 0) return;

    for (const email of adresses) {
      try {
        const compte = await this.prisma.user.findUnique({ where: { email } });
        if (!compte) {
          /* Pas une erreur : on désigne souvent l'administrateur avant qu'il
           * ne se soit inscrit. Le démarrage suivant le trouvera. */
          this.logger.warn(
            `${VARIABLE} : aucun compte pour ${email}. Inscrivez-vous sur le site, ` +
              `le prochain démarrage lèvera le droit.`
          );
          continue;
        }
        if (compte.administrateurPlateforme) continue;

        await this.prisma.user.update({
          where: { id: compte.id },
          data: { administrateurPlateforme: true },
        });
        this.logger.log(`${email} est désormais administrateur de la plateforme.`);
      } catch (erreur) {
        /* Un amorçage raté ne doit pas empêcher l'API de servir : le reste
         * des clients n'y est pour rien. */
        this.logger.error(`${VARIABLE} : échec sur ${email}`, erreur as Error);
      }
    }
  }
}

/**
 * Lit la variable : une ou plusieurs adresses séparées par des virgules.
 *
 * Isolée pour être vérifiable. Une casse mal normalisée ici — les adresses
 * sont stockées en minuscules — ferait échouer l'amorçage en silence, et on
 * chercherait longtemps du côté des droits.
 */
export function lireAdresses(valeur: string | undefined): string[] {
  if (!valeur) return [];
  return [
    ...new Set(
      valeur
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter((part) => part.includes("@"))
    ),
  ];
}
