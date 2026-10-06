import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { ExecuteurOutils } from "./executeur";
import { CONSIGNE_STABLE, contexteSession } from "./consigne";
import { OUTILS, TOURS_MAX } from "./outils";
import { boucleConseil } from "./boucle";
import { lireEnv } from "../config/environnement";

/**
 * Le conseiller : une boucle d'appels d'outils autour du modèle.
 *
 * **Boucle écrite à la main plutôt que l'assistant du SDK.** Deux raisons.
 * D'abord le coût : chaque tour est facturé, et je veux une borne dure, le
 * compte exact des jetons consommés et la trace de chaque outil appelé.
 * Ensuite la stabilité : cette boucle tient en quarante lignes et ne dépend
 * d'aucune interface en version bêta, dans un produit qui ne doit pas casser
 * quand une bêta évolue.
 *
 * **Absence de clé = fonctionnalité inerte, pas démarrage en échec.** Même
 * principe que Stripe et le courriel : une instance mal configurée le dit
 * franchement au lieu de tomber.
 */

export type { SourceCitee } from "./boucle";

export interface Reponse {
  texte: string;
  sources: import("./boucle").SourceCitee[];
  /** Jetons consommés, pour mesurer avant de facturer. */
  consommation: { entree: number; sortie: number; cacheLu: number };
  /** Vrai si la boucle a été arrêtée par la borne plutôt que par le modèle. */
  tronquee: boolean;
}

/* Le modèle le plus capable : c'est un produit de conseil financier, et la
 * qualité du raisonnement est exactement ce qu'on vend. */
const MODELE = "claude-opus-5-5";

@Injectable()
export class ConseilService {
  private readonly logger = new Logger(ConseilService.name);
  private readonly client: Anthropic | null;

  constructor(private executeur: ExecuteurOutils) {
    const cle = lireEnv("ANTHROPIC_API_KEY");
    if (!cle) {
      this.logger.warn(
        "ANTHROPIC_API_KEY absente : le conseiller est désactivé sur cette instance."
      );
      this.client = null;
      return;
    }
    this.client = new Anthropic({ apiKey: cle });
  }

  get configure(): boolean {
    return this.client !== null;
  }

  async repondre(organizationId: string, question: string): Promise<Reponse> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "Le conseiller n'est pas activé sur cette instance. Écrivez-nous si vous souhaitez y accéder."
      );
    }
    const client = this.client;

    const entites = await this.executeur.entites(organizationId);
    const contexte = contexteSession({
      aujourdHui: new Date(),
      entites: entites.map((e) => ({ id: e.id, nom: e.name, devise: e.currency })),
    });

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
    const parId = new Map<string, Anthropic.ToolUseBlock>();

    const issue = await boucleConseil({
      interroger: async () => {
        const reponse = await this.interrogerModele(client, {
          model: MODELE,
          max_tokens: 4000,
          /* L'effort par défaut de ce modèle est « medium ». On le pose
           * explicitement : lire des états financiers et en tirer un
           * conseil est le genre de tâche qui paie un effort supérieur. */
          output_config: { effort: "high" },
          system: [
            {
              type: "text",
              text: CONSIGNE_STABLE,
              /* La consigne et le catalogue d'outils ne changent pas d'une
               * question à l'autre : mis en cache, ils ne sont facturés au
               * plein tarif qu'une fois par fenêtre. Le contexte de
               * session, qui porte la date, vient après la coupure pour ne
               * pas invalider ce qui précède. */
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: contexte },
          ],
          tools: OUTILS,
          messages,
        });

        const demandes = reponse.content.filter(
          (bloc): bloc is Anthropic.ToolUseBlock => bloc.type === "tool_use"
        );
        for (const demande of demandes) parId.set(demande.id, demande);

        if (reponse.stop_reason === "refusal") {
          this.logger.warn(`Question refusée : ${reponse.stop_details?.category ?? "sans motif"}`);
        }

        return {
          texte: texteDe(reponse.content),
          outils: demandes.map((d) => ({
            id: d.id,
            nom: d.name,
            arguments: (d.input ?? {}) as Record<string, unknown>,
          })),
          refus: reponse.stop_reason === "refusal",
          jetons: {
            entree: reponse.usage.input_tokens,
            sortie: reponse.usage.output_tokens,
            cacheLu: reponse.usage.cache_read_input_tokens ?? 0,
          },
        };
      },

      memoriser: (tour) => {
        /* On réinjecte les blocs d'origine, et non une reconstruction :
         * l'API attend exactement ce qu'elle a produit. */
        const blocs: Anthropic.ContentBlockParam[] = [];
        if (tour.texte) blocs.push({ type: "text", text: tour.texte });
        for (const outil of tour.outils) {
          const bloc = parId.get(outil.id);
          if (bloc) blocs.push(bloc);
        }
        if (blocs.length > 0) messages.push({ role: "assistant", content: blocs });
      },

      remettreResultats: (resultats) => {
        messages.push({
          role: "user",
          content: resultats.map((r) => ({
            type: "tool_result" as const,
            tool_use_id: r.id,
            content: JSON.stringify(r.contenu),
            is_error: r.erreur,
          })),
        });
      },

      executer: (demande) => this.executeur.executer(organizationId, demande.nom, demande.arguments),
    });

    if (issue.tronquee) {
      this.logger.warn(`Borne de ${TOURS_MAX} tours atteinte sans réponse finale.`);
    }

    return {
      texte: issue.texte,
      sources: issue.sources,
      consommation: issue.consommation,
      tronquee: issue.tronquee,
    };
  }
  /**
   * Un appel au modèle, dont les pannes sont traduites.
   *
   * Sans cette traduction, la moindre indisponibilité remonte en « Internal
   * server error » : l'utilisateur ne sait ni si le problème vient de lui,
   * ni s'il doit réessayer, ni s'il doit prévenir quelqu'un. Les classes
   * d'erreur du SDK sont examinées de la plus précise à la plus générale ;
   * on ne lit jamais le texte du message pour décider.
   */
  private async interrogerModele(
    client: Anthropic,
    requete: Anthropic.MessageCreateParamsNonStreaming
  ): Promise<Anthropic.Message> {
    try {
      return await client.messages.create(requete);
    } catch (erreur) {
      if (erreur instanceof Anthropic.AuthenticationError) {
        /* Mauvaise configuration de notre côté, pas une erreur du client :
         * il ne peut rien y faire, et il doit pouvoir nous le signaler. */
        this.logger.error("Clé du modèle refusée : le conseiller est mal configuré.");
        throw new ServiceUnavailableException(
          "Le conseiller est momentanément indisponible. Nous sommes prévenus ; " +
            "les autres écrans restent accessibles."
        );
      }
      if (erreur instanceof Anthropic.RateLimitError) {
        throw new ServiceUnavailableException(
          "Trop de questions en même temps. Réessayez dans une minute."
        );
      }
      if (erreur instanceof Anthropic.APIConnectionError) {
        throw new ServiceUnavailableException(
          "Le conseiller n'est pas joignable pour l'instant. Réessayez dans un instant."
        );
      }
      if (erreur instanceof Anthropic.APIError) {
        this.logger.error(`Erreur du modèle (${erreur.status}) : ${erreur.message}`);
        throw new BadGatewayException(
          "Le conseiller n'a pas pu répondre. Réessayez ; si cela persiste, écrivez-nous."
        );
      }
      throw erreur;
    }
  }
}

function texteDe(contenu: Anthropic.ContentBlock[]): string {
  return contenu
    .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === "text")
    .map((bloc) => bloc.text)
    .join("\n")
    .trim();
}
