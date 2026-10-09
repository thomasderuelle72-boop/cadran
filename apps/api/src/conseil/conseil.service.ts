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
import { lireEnv, lireEnvOuDefaut } from "../config/environnement";
import {
  ErreurOpenRouter,
  MODELE_OPENROUTER_PAR_DEFAUT,
  appelerOpenRouter,
  corpsRequete,
  lireTour,
  messageAssistant,
  type MessageOR,
  type ReponseOR,
} from "./openrouter";

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

/**
 * Qui répond. OpenRouter passe devant quand sa clé est posée : c'est le
 * chemin le moins cher, et le choix du modèle se fait par une variable
 * (OPENROUTER_MODELE) sans toucher au code. Sinon Anthropic en direct.
 */
type Fournisseur =
  | { type: "openrouter"; cle: string; modele: string }
  | { type: "anthropic"; client: Anthropic };

const MESSAGE_MAL_CONFIGURE =
  "Le conseiller est momentanément indisponible. Nous sommes prévenus ; les autres écrans restent accessibles.";

@Injectable()
export class ConseilService {
  private readonly logger = new Logger(ConseilService.name);
  private readonly fournisseur: Fournisseur | null;

  constructor(private executeur: ExecuteurOutils) {
    const cleOpenRouter = lireEnv("OPENROUTER_API_KEY");
    if (cleOpenRouter) {
      const modele = lireEnvOuDefaut("OPENROUTER_MODELE", MODELE_OPENROUTER_PAR_DEFAUT);
      this.logger.log(`Conseiller par OpenRouter, modèle ${modele}, sans conservation des données.`);
      this.fournisseur = { type: "openrouter", cle: cleOpenRouter, modele };
      return;
    }
    const cle = lireEnv("ANTHROPIC_API_KEY");
    if (!cle) {
      this.logger.warn(
        "Ni OPENROUTER_API_KEY ni ANTHROPIC_API_KEY : le conseiller est désactivé sur cette instance."
      );
      this.fournisseur = null;
      return;
    }
    this.fournisseur = { type: "anthropic", client: new Anthropic({ apiKey: cle }) };
  }

  get configure(): boolean {
    return this.fournisseur !== null;
  }

  /** Ce que l'écran affiche pour dire à qui partent les questions. */
  get description(): { fournisseur: string; modele: string } | null {
    if (!this.fournisseur) return null;
    return this.fournisseur.type === "openrouter"
      ? { fournisseur: "OpenRouter", modele: this.fournisseur.modele }
      : { fournisseur: "Anthropic", modele: MODELE };
  }

  async repondre(organizationId: string, question: string): Promise<Reponse> {
    if (!this.fournisseur) {
      throw new ServiceUnavailableException(
        "Le conseiller n'est pas activé sur cette instance. Écrivez-nous si vous souhaitez y accéder."
      );
    }

    const entites = await this.executeur.entites(organizationId);
    const contexte = contexteSession({
      aujourdHui: new Date(),
      entites: entites.map((e) => ({ id: e.id, nom: e.name, devise: e.currency })),
    });

    const issue =
      this.fournisseur.type === "openrouter"
        ? await this.boucleOpenRouter(this.fournisseur, organizationId, question, contexte)
        : await this.boucleAnthropic(this.fournisseur.client, organizationId, question, contexte);

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
   * La boucle par OpenRouter. Même boucle, même borne, mêmes outils : seul
   * change le format des messages. La consigne et le contexte de session
   * forment le message système.
   */
  private boucleOpenRouter(
    fournisseur: { cle: string; modele: string },
    organizationId: string,
    question: string,
    contexte: string
  ) {
    const messages: MessageOR[] = [
      { role: "system", content: `${CONSIGNE_STABLE}\n\n${contexte}` },
      { role: "user", content: question },
    ];
    let derniere: ReponseOR | null = null;

    return boucleConseil({
      interroger: async () => {
        derniere = await this.interrogerOpenRouter(
          fournisseur,
          corpsRequete({ modele: fournisseur.modele, messages, outils: OUTILS, maxJetons: 4000 })
        );
        return lireTour(derniere);
      },
      memoriser: () => {
        if (derniere) messages.push(messageAssistant(derniere));
      },
      remettreResultats: (resultats) => {
        for (const r of resultats) {
          messages.push({ role: "tool", tool_call_id: r.id, content: JSON.stringify(r.contenu) });
        }
      },
      executer: (demande) => this.executeur.executer(organizationId, demande.nom, demande.arguments),
    });
  }

  private async interrogerOpenRouter(
    fournisseur: { cle: string; modele: string },
    corps: unknown
  ): Promise<ReponseOR> {
    try {
      return await appelerOpenRouter({ cle: fournisseur.cle, corps });
    } catch (erreur) {
      if (erreur instanceof ErreurOpenRouter) {
        if (erreur.statut === 401 || erreur.statut === 403) {
          this.logger.error("Clé OpenRouter refusée : le conseiller est mal configuré.");
          throw new ServiceUnavailableException(MESSAGE_MAL_CONFIGURE);
        }
        if (erreur.statut === 402) {
          this.logger.error(`Crédit OpenRouter épuisé : ${erreur.message}`);
          throw new ServiceUnavailableException(MESSAGE_MAL_CONFIGURE);
        }
        if (erreur.statut === 429) {
          throw new ServiceUnavailableException("Trop de questions en même temps. Réessayez dans une minute.");
        }
        if (erreur.statut === 400 || erreur.statut === 404) {
          /* Modèle inconnu, ou aucun hébergeur de ce modèle ne s'engage à
           * ne rien conserver : c'est à corriger dans OPENROUTER_MODELE. */
          this.logger.error(
            `OpenRouter refuse le modèle « ${fournisseur.modele} » (${erreur.statut}) : ${erreur.message}`
          );
          throw new ServiceUnavailableException(MESSAGE_MAL_CONFIGURE);
        }
        this.logger.error(`Erreur OpenRouter (${erreur.statut}) : ${erreur.message}`);
        throw new BadGatewayException(
          "Le conseiller n'a pas pu répondre. Réessayez ; si cela persiste, écrivez-nous."
        );
      }
      if (erreur instanceof Error && (erreur.name === "TimeoutError" || erreur.name === "AbortError" || erreur instanceof TypeError)) {
        throw new ServiceUnavailableException(
          "Le conseiller n'est pas joignable pour l'instant. Réessayez dans un instant."
        );
      }
      throw erreur;
    }
  }

  private boucleAnthropic(client: Anthropic, organizationId: string, question: string, contexte: string) {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
    const parId = new Map<string, Anthropic.ToolUseBlock>();

    return boucleConseil({
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
        throw new ServiceUnavailableException(MESSAGE_MAL_CONFIGURE);
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
