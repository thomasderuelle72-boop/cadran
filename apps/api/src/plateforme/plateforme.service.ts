import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PlanId, Role, StatutAbonnement } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { PLANS } from "../billing/plans";
import { NOM_DOSSIER, poserDossierTest } from "./dossier-test";
import { genererMotDePasse } from "./motdepasse";

/**
 * Administration de la plateforme : les organisations clientes vues depuis
 * l'exploitant, et non depuis l'une d'elles.
 *
 * Deux principes gouvernent ce fichier, et ils tirent dans des sens opposés.
 *
 * **L'exploitant doit pouvoir dépanner.** Un client qui ne peut plus se
 * connecter, une formule à corriger après un incident de paiement, un compte
 * à supprimer sur demande : sans ces gestes, chaque incident devient une
 * requête SQL écrite à la main en production, ce qui est à la fois plus
 * dangereux et moins traçable.
 *
 * **Cadran est sous-traitant au sens du RGPD.** Le grand livre d'un client
 * contient les noms de ses propres clients et fournisseurs. L'exploitant n'en
 * est pas responsable de traitement : il n'a pas à les lire pour son compte.
 * Aucune route d'ici ne renvoie donc d'écriture comptable. Pour entrer dans
 * un dossier, il faut ouvrir un *accès support*, qui est une session ordinaire
 * tracée dans la piste d'audit du client — c'est-à-dire visible par lui.
 *
 * Ce que l'exploitant peut lire sans accès support s'arrête aux volumes :
 * combien d'entités, combien de périodes, combien d'écritures. De quoi
 * facturer, dimensionner et diagnostiquer, pas de quoi savoir qui sont les
 * fournisseurs de qui.
 */

/** Durée d'un accès support. Assez pour dépanner, trop court pour s'installer. */
export const DUREE_ACCES_SUPPORT = "60m";

export interface LigneOrganisation {
  id: string;
  nom: string;
  plan: PlanId;
  statut: StatutAbonnement;
  finPeriode: string | null;
  resiliationDemandee: boolean;
  creeeLe: string;
  utilisateurs: number;
  entites: number;
  periodes: number;
  ecritures: number;
  derniereActivite: string | null;
}

@Injectable()
export class PlateformeService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService
  ) {}

  /**
   * Toutes les organisations, avec leurs volumes.
   *
   * Les comptages passent par `groupBy` plutôt que par une sous-requête par
   * organisation : à cent clients, la version naïve fait quatre cents
   * allers-retours, et la page met dix secondes à s'afficher — assez pour
   * qu'on cesse de l'ouvrir, donc pour que la console ne serve à rien.
   */
  async organisations(): Promise<LigneOrganisation[]> {
    const [organisations, utilisateurs, entites, periodes, ecritures, connexions] =
      await Promise.all([
        this.prisma.organization.findMany({
          include: { subscription: true },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.user.groupBy({ by: ["organizationId"], _count: { _all: true } }),
        this.prisma.entity.groupBy({ by: ["organizationId"], _count: { _all: true } }),
        this.prisma.accountingPeriod.groupBy({ by: ["entityId"], _count: { _all: true } }),
        this.prisma.ledgerEntry.groupBy({ by: ["entityId"], _count: { _all: true } }),
        this.prisma.user.groupBy({
          by: ["organizationId"],
          _max: { derniereConnexion: true },
        }),
      ]);

    /* Périodes et écritures pendent à l'entité, pas à l'organisation : il
     * faut le chemin de l'une à l'autre pour les remonter. */
    const entiteVersOrg = new Map(
      (await this.prisma.entity.findMany({ select: { id: true, organizationId: true } })).map(
        (e) => [e.id, e.organizationId]
      )
    );
    const parOrganisation = (
      lignes: Array<{ entityId: string; _count: { _all: number } }>
    ): Map<string, number> => {
      const total = new Map<string, number>();
      for (const ligne of lignes) {
        const org = entiteVersOrg.get(ligne.entityId);
        if (!org) continue;
        total.set(org, (total.get(org) ?? 0) + ligne._count._all);
      }
      return total;
    };

    const nbUtilisateurs = new Map(utilisateurs.map((u) => [u.organizationId, u._count._all]));
    const nbEntites = new Map(entites.map((e) => [e.organizationId, e._count._all]));
    const nbPeriodes = parOrganisation(periodes);
    const nbEcritures = parOrganisation(ecritures);
    const derniere = new Map(connexions.map((c) => [c.organizationId, c._max.derniereConnexion]));

    return organisations.map((org) => ({
      id: org.id,
      nom: org.name,
      plan: org.subscription?.plan ?? "essai",
      statut: org.subscription?.statut ?? "essai",
      finPeriode: org.subscription?.finPeriode?.toISOString() ?? null,
      resiliationDemandee: org.subscription?.resiliationDemandee ?? false,
      creeeLe: org.createdAt.toISOString(),
      utilisateurs: nbUtilisateurs.get(org.id) ?? 0,
      entites: nbEntites.get(org.id) ?? 0,
      periodes: nbPeriodes.get(org.id) ?? 0,
      ecritures: nbEcritures.get(org.id) ?? 0,
      derniereActivite: derniere.get(org.id)?.toISOString() ?? null,
    }));
  }

  /** Les comptes d'une organisation. Jamais ses données comptables. */
  async utilisateurs(organizationId: string) {
    await this.exigerOrganisation(organizationId);
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        derniereConnexion: true,
        administrateurPlateforme: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Change la formule d'un client sans passer par Stripe.
   *
   * Nécessaire : offrir un mois après un incident, débloquer un compte dont
   * le paiement a échoué pour une raison bancaire, basculer un client que
   * l'on facture sur devis. Le champ Stripe n'est pas touché — si un
   * abonnement existe là-bas, il continue sa vie, et c'est voulu : écrire
   * dans les deux sens créerait deux sources de vérité qui divergeraient.
   */
  async changerFormule(
    organizationId: string,
    modifications: { plan?: PlanId; statut?: StatutAbonnement; finPeriode?: string | null }
  ) {
    await this.exigerOrganisation(organizationId);
    if (modifications.plan && !PLANS[modifications.plan]) {
      throw new BadRequestException("Formule inconnue.");
    }

    const finPeriode =
      modifications.finPeriode === undefined
        ? undefined
        : modifications.finPeriode === null
          ? null
          : lireDate(modifications.finPeriode);

    return this.prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        plan: modifications.plan ?? "essai",
        statut: modifications.statut ?? "essai",
        finPeriode: finPeriode ?? null,
      },
      update: {
        ...(modifications.plan ? { plan: modifications.plan } : {}),
        ...(modifications.statut ? { statut: modifications.statut } : {}),
        ...(finPeriode === undefined ? {} : { finPeriode }),
      },
    });
  }

  /**
   * Donne un mot de passe provisoire à un utilisateur bloqué.
   *
   * Le mot de passe n'est renvoyé qu'ici, une fois : il n'est stocké qu'en
   * empreinte, et aucune route ne le relit. Toutes les sessions de ce compte
   * tombent dans la foulée — un dépannage ne doit pas laisser ouverte la
   * session de celui qui avait peut-être pris le compte.
   *
   * C'est le geste le plus intrusif de ce service : il donne, le temps d'une
   * connexion, accès au dossier d'un client. Il est journalisé comme tel.
   */
  async reinitialiserMotDePasse(userId: string): Promise<{ email: string; motDePasse: string }> {
    const utilisateur = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!utilisateur) throw new NotFoundException("Compte introuvable.");

    const motDePasse = genererMotDePasse();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(motDePasse, 10),
        sessionsValablesApres: new Date(),
      },
    });
    return { email: utilisateur.email, motDePasse };
  }

  /** Donne ou retire le droit d'administrer la plateforme. */
  async changerDroitPlateforme(userId: string, accorde: boolean) {
    const utilisateur = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!utilisateur) throw new NotFoundException("Compte introuvable.");

    /* Retirer le droit coupe aussi les accès support ouverts par ce compte :
     * la stratégie JWT les refuse dès lors que le drapeau est tombé. Rien à
     * faire de plus ici — c'est l'intérêt de ne pas l'avoir mis dans le
     * jeton. */
    return this.prisma.user.update({
      where: { id: userId },
      data: { administrateurPlateforme: accorde },
      select: { id: true, email: true, administrateurPlateforme: true },
    });
  }

  /**
   * Ouvre un accès support sur l'organisation d'un client.
   *
   * Renvoie un jeton de session marqué `support`. Il expire seul au bout
   * d'une heure, et cesse de valoir à la seconde où le compte perd son droit
   * d'administration. Chaque requête faite avec lui est journalisée dans la
   * piste d'audit du client, qui la voit depuis son propre écran — ce qui est
   * la seule façon honnête de disposer de cet accès.
   */
  async ouvrirAcces(administrateurId: string, organizationId: string) {
    const organisation = await this.exigerOrganisation(organizationId);
    return {
      jeton: this.jwt.sign(
        { sub: administrateurId, org: organizationId, support: true },
        { expiresIn: DUREE_ACCES_SUPPORT }
      ),
      organisation: { id: organisation.id, nom: organisation.name },
    };
  }

  /**
   * Supprime une organisation et tout ce qui en dépend.
   *
   * Exige le nom exact en confirmation. Ce n'est pas une politesse : les
   * identifiants se ressemblent tous, et la liste se trie — la ligne cliquée
   * n'est pas toujours celle qu'on croit. Taper le nom force à regarder.
   *
   * Irréversible, et c'est l'intention : une demande d'effacement au titre de
   * l'article 17 du RGPD n'est pas satisfaite par une colonne « supprimé ».
   */
  async supprimerOrganisation(organizationId: string, nomConfirme: string) {
    const organisation = await this.exigerOrganisation(organizationId);
    if (nomConfirme !== organisation.name) {
      throw new BadRequestException(
        "Le nom saisi ne correspond pas : la suppression n'a pas été effectuée."
      );
    }

    const administrateurs = await this.prisma.user.count({
      where: { organizationId, administrateurPlateforme: true },
    });
    if (administrateurs > 0) {
      throw new BadRequestException(
        "Cette organisation héberge un administrateur de la plateforme. " +
          "Retirez-lui le droit, ou déplacez-le, avant de la supprimer."
      );
    }

    await this.prisma.organization.delete({ where: { id: organizationId } });
    return { supprimee: organisation.name };
  }

  /** Vue d'ensemble : ce qu'on regarde le matin. */
  /**
   * Pose — ou retire — le dossier de test dans une organisation.
   *
   * Existe comme route et non seulement comme script parce qu'un script ne
   * s'exécute pas sur un serveur déployé : c'est précisément là qu'on a besoin
   * d'un dossier d'essai, pour éprouver les écrans sur la vraie installation
   * plutôt que sur une base locale qui n'a jamais tout à fait la même tête.
   *
   * La suppression de l'ancien et la construction du nouveau tiennent dans une
   * seule transaction : interrompue, l'opération ne laisse pas des exercices
   * sans ratios, qui feraient chercher un bogue du calcul là où il n'y a qu'un
   * import inachevé.
   */
  async dossierTest(organizationId: string, action: "creer" | "supprimer") {
    await this.exigerOrganisation(organizationId);

    const existant = await this.prisma.entity.findFirst({
      where: { organizationId, name: NOM_DOSSIER },
    });

    if (action === "supprimer") {
      if (!existant) return { cree: false, supprime: false, nom: NOM_DOSSIER };
      await this.prisma.entity.delete({ where: { id: existant.id } });
      return { cree: false, supprime: true, nom: NOM_DOSSIER };
    }

    const pose = await poserDossierTest(this.prisma, organizationId);
    return { cree: true, supprime: pose.remplace, nom: NOM_DOSSIER };
  }

  async sante() {
    const depuis = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [organisations, utilisateurs, actifs, echecs, parStatut] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { derniereConnexion: { gte: depuis } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: depuis }, statusCode: { gte: 400 } } }),
      this.prisma.subscription.groupBy({ by: ["statut"], _count: { _all: true } }),
    ]);

    return {
      organisations,
      utilisateurs,
      /* « Actifs » veut dire : connectés dans les sept derniers jours. Un
       * chiffre d'usage, pas de facturation. */
      utilisateursActifs7j: actifs,
      ecritsEnEchec7j: echecs,
      abonnements: Object.fromEntries(parStatut.map((s) => [s.statut, s._count._all])),
    };
  }

  private async exigerOrganisation(organizationId: string) {
    const organisation = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organisation) throw new NotFoundException("Organisation introuvable.");
    return organisation;
  }
}

/** Une date invalide écrite en base rendrait l'abonnement illisible. */
function lireDate(valeur: string): Date {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) throw new BadRequestException("Date invalide.");
  return date;
}

/** Les rôles qu'un administrateur de plateforme peut poser. Pas de surprise. */
export const ROLES_ADMISSIBLES: Role[] = ["ADMIN", "DAF", "CONTROLEUR", "LECTEUR"];
