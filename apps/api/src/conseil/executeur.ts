import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnalysisService } from "../analysis/analysis.service";
import { RatiosService } from "../ratios/ratios.service";
import { outilConnu } from "./outils";

/**
 * Exécution des outils demandés par le modèle.
 *
 * Toute la sécurité tient en une ligne de discipline : `organizationId` vient
 * du jeton de session et n'est jamais lu dans les arguments produits par le
 * modèle. Il est passé en premier à chaque méthode de service, qui filtre
 * dessus comme pour n'importe quelle requête d'écran. Un identifiant
 * d'entreprise inventé par le modèle — ou soufflé par un utilisateur
 * malveillant dans sa question — ne ramène donc rien : la méthode lève
 * « introuvable ».
 *
 * Les erreurs ne remontent pas en exception. Elles sont rendues au modèle
 * comme un résultat d'outil en échec, pour qu'il puisse le dire à
 * l'utilisateur ou essayer autrement. Une exception interromprait la
 * conversation sur une erreur technique, là où « cette période n'existe pas »
 * est une réponse acceptable.
 */

export interface ResultatOutil {
  /** Rendu tel quel au modèle, sérialisé en JSON. */
  contenu: unknown;
  erreur: boolean;
}

@Injectable()
export class ExecuteurOutils {
  private readonly logger = new Logger(ExecuteurOutils.name);

  constructor(
    private prisma: PrismaService,
    private analysis: AnalysisService,
    private ratios: RatiosService
  ) {}

  /** Les entreprises de l'organisation, pour le contexte de session. */
  async entites(organizationId: string) {
    return this.prisma.entity.findMany({
      where: { organizationId },
      select: { id: true, name: true, currency: true },
      orderBy: { name: "asc" },
    });
  }

  async executer(
    organizationId: string,
    nom: string,
    arguments_: Record<string, unknown>
  ): Promise<ResultatOutil> {
    if (!outilConnu(nom)) {
      return { contenu: { erreur: `Outil inconnu : ${nom}.` }, erreur: true };
    }

    try {
      return { contenu: await this.appeler(organizationId, nom, arguments_), erreur: false };
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      /* En journal, pas dans la réponse : le message d'une exception de
       * service peut nommer des identifiants internes. Le modèle reçoit de
       * quoi se corriger, pas de quoi décrire notre base. */
      this.logger.warn(`Outil ${nom} en échec : ${message}`);
      return {
        contenu: { erreur: message, outil: nom },
        erreur: true,
      };
    }
  }

  private async appeler(
    organizationId: string,
    nom: string,
    a: Record<string, unknown>
  ): Promise<unknown> {
    const entreprise = () => texte(a.entrepriseId, "entrepriseId");
    const periode = () => texte(a.periodeId, "periodeId");
    const sens = (): "CLIENT" | "FOURNISSEUR" =>
      a.sens === "FOURNISSEUR" ? "FOURNISSEUR" : "CLIENT";

    switch (nom) {
      case "lister_entreprises":
        return this.prisma.entity.findMany({
          where: { organizationId },
          select: { id: true, name: true, currency: true, nafCode: true },
          orderBy: { name: "asc" },
        });

      case "lister_periodes":
        return this.prisma.accountingPeriod.findMany({
          // Le filtre passe par l'entité, elle-même filtrée sur
          // l'organisation : une entreprise d'un autre client ne remonte
          // aucune période plutôt qu'une erreur révélatrice.
          where: { entityId: entreprise(), entity: { organizationId } },
          select: { id: true, label: true, startDate: true, endDate: true },
          orderBy: { startDate: "asc" },
        });

      case "soldes_intermediaires":
        return this.analysis.sig(organizationId, periode());

      case "flux_tresorerie":
        return this.analysis.flux(organizationId, periode());

      case "diagnostic_fragilite":
        return this.analysis.diagnostic(organizationId, periode());

      case "encours_et_retards":
        return this.analysis.balanceAgee(organizationId, entreprise(), sens());

      case "concentration":
        return this.analysis.concentration(organizationId, entreprise(), sens());

      case "tendance":
        return this.ratios.getTrend(organizationId, entreprise());

      case "detail_compte":
        return this.analysis.ecrituresDuCompte(organizationId, entreprise(), texte(a.compte, "compte"), {
          // Borné : le modèle n'a pas besoin du grand livre entier pour
          // expliquer la composition d'un poste, et chaque ligne renvoyée
          // est facturée au jeton.
          limite: 60,
        });

      default:
        throw new Error(`Outil déclaré mais non câblé : ${nom}.`);
    }
  }
}

/** Le modèle peut produire un argument d'un autre type que celui annoncé. */
function texte(valeur: unknown, nom: string): string {
  if (typeof valeur !== "string" || valeur.trim() === "") {
    throw new Error(`Le paramètre « ${nom} » est absent ou vide.`);
  }
  return valeur.trim();
}
