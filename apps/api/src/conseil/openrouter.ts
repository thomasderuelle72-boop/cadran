import type { DefinitionOutil } from "./outils";
import type { DemandeOutil, TourModele } from "./boucle";

/**
 * Le conseiller par OpenRouter : une passerelle vers des centaines de modèles,
 * derrière une interface au format « chat completions ».
 *
 * **La confidentialité n'est pas une option.** Chaque requête exige
 * `zdr: true` (l'hébergeur ne conserve ni la question ni la réponse) et
 * `data_collection: "deny"` (il ne s'en sert pas pour entraîner un modèle).
 * Les questions portent sur les comptes des clients d'un cabinet, couverts
 * par le secret professionnel ; les modèles gratuits d'OpenRouter, eux,
 * journalisent les échanges (« Your use is logged […] to improve NVIDIA
 * products ») et sont donc écartés d'office — OpenRouter refuse la requête
 * plutôt que de l'envoyer à un hébergeur qui ne respecte pas la règle.
 *
 * Tout ce qui se vérifie sans réseau — format des outils, lecture d'une
 * réponse, corps de la requête — est en fonctions pures, testées.
 */

export const URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

/** Claude Haiku 5.5 : appels d'outils fiables, français soigné, servi sans conservation par Amazon et Google. */
export const MODELE_OPENROUTER_PAR_DEFAUT = "anthropic/claude-haiku-5.5";

export interface AppelOutilOR {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type MessageOR =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: AppelOutilOR[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ReponseOR {
  choices?: Array<{
    message?: { content?: string | null; tool_calls?: AppelOutilOR[] | null };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number } | null;
  };
  error?: { code?: number | string; message?: string };
}

/** Une panne d'OpenRouter, avec son statut HTTP : c'est sur lui, jamais sur le texte, qu'on décide. */
export class ErreurOpenRouter extends Error {
  constructor(
    readonly statut: number,
    message: string,
  ) {
    super(message);
  }
}

/** Les outils au format « function » attendu par OpenRouter. */
export function outilsOpenRouter(outils: DefinitionOutil[]) {
  return outils.map((o) => ({
    type: "function" as const,
    function: { name: o.name, description: o.description, parameters: o.input_schema },
  }));
}

export function corpsRequete(options: {
  modele: string;
  messages: MessageOR[];
  outils: DefinitionOutil[];
  maxJetons: number;
}) {
  return {
    model: options.modele,
    messages: options.messages,
    tools: outilsOpenRouter(options.outils),
    max_tokens: options.maxJetons,
    provider: {
      // Ni conservation, ni entraînement : la requête échoue plutôt que de partir ailleurs.
      zdr: true,
      data_collection: "deny",
    },
  };
}

/** Des arguments d'outil illisibles valent un appel sans argument : l'exécuteur dira ce qui manque. */
function argumentsDe(brut: string | undefined): Record<string, unknown> {
  if (!brut) return {};
  try {
    const valeur: unknown = JSON.parse(brut);
    return valeur && typeof valeur === "object" && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Une réponse d'OpenRouter, lue comme un tour de la boucle. */
export function lireTour(reponse: ReponseOR): TourModele {
  const choix = reponse.choices?.[0];
  const message = choix?.message;
  const outils: DemandeOutil[] = (message?.tool_calls ?? [])
    .filter((appel) => appel.type === "function" && appel.function?.name)
    .map((appel) => ({ id: appel.id, nom: appel.function.name, arguments: argumentsDe(appel.function.arguments) }));
  return {
    texte: (message?.content ?? "").trim(),
    outils,
    // Le filtre de contenu de l'hébergeur a coupé la réponse : on le traite comme un refus.
    refus: choix?.finish_reason === "content_filter",
    jetons: {
      entree: reponse.usage?.prompt_tokens ?? 0,
      sortie: reponse.usage?.completion_tokens ?? 0,
      cacheLu: reponse.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    },
  };
}

/** Le message de l'assistant à réinjecter tel quel au tour suivant. */
export function messageAssistant(reponse: ReponseOR): MessageOR {
  const message = reponse.choices?.[0]?.message;
  const appels = message?.tool_calls ?? [];
  return appels.length > 0
    ? { role: "assistant", content: message?.content ?? null, tool_calls: appels }
    : { role: "assistant", content: message?.content ?? "" };
}

/**
 * Un appel à OpenRouter.
 *
 * Une réponse 200 peut porter une erreur dans son corps (un hébergeur tombé
 * après l'acceptation de la requête) : elle est traitée comme une panne.
 */
export async function appelerOpenRouter(options: {
  cle: string;
  corps: unknown;
  recuperer?: typeof fetch;
  delaiMs?: number;
}): Promise<ReponseOR> {
  const recuperer = options.recuperer ?? fetch;
  const reponse = await recuperer(URL_OPENROUTER, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.cle}`,
      "Content-Type": "application/json",
      "X-Title": "Cadran",
    },
    body: JSON.stringify(options.corps),
    signal: AbortSignal.timeout(options.delaiMs ?? 90_000),
  });
  let corps: ReponseOR;
  try {
    corps = (await reponse.json()) as ReponseOR;
  } catch {
    throw new ErreurOpenRouter(reponse.status || 502, "Réponse illisible d'OpenRouter.");
  }
  if (!reponse.ok) {
    throw new ErreurOpenRouter(reponse.status, corps.error?.message ?? `Statut ${reponse.status}`);
  }
  if (corps.error) {
    const statut = typeof corps.error.code === "number" ? corps.error.code : 502;
    throw new ErreurOpenRouter(statut, corps.error.message ?? "Erreur de l'hébergeur du modèle.");
  }
  return corps;
}
