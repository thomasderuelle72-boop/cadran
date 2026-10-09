import { ServiceUnavailableException } from "@nestjs/common";
import { ConseilService } from "./conseil.service";
import type { ExecuteurOutils } from "./executeur";
import { OUTILS } from "./outils";
import {
  ErreurOpenRouter,
  appelerOpenRouter,
  corpsRequete,
  lireTour,
  messageAssistant,
  outilsOpenRouter,
  type ReponseOR,
} from "./openrouter";

/** Une réponse d'OpenRouter, comme fetch la rendrait. */
function reponseHttp(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });
}

const DEMANDE_OUTIL: ReponseOR = {
  choices: [
    {
      message: {
        content: null,
        tool_calls: [
          { id: "appel-1", type: "function", function: { name: "lister_entreprises", arguments: "{}" } },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
  usage: { prompt_tokens: 1200, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 800 } },
};

const REPONSE_FINALE: ReponseOR = {
  choices: [{ message: { content: "Le délai de paiement des clients est de 55 jours." }, finish_reason: "stop" }],
  usage: { prompt_tokens: 1500, completion_tokens: 60 },
};

describe("OpenRouter : formats", () => {
  it("présente chaque outil au format « function », avec son schéma", () => {
    const outils = outilsOpenRouter(OUTILS);
    expect(outils).toHaveLength(OUTILS.length);
    expect(outils[0]).toEqual({
      type: "function",
      function: { name: OUTILS[0].name, description: OUTILS[0].description, parameters: OUTILS[0].input_schema },
    });
  });

  it("exige sur chaque requête zéro conservation et aucune collecte", () => {
    const corps = corpsRequete({ modele: "anthropic/claude-haiku-5.5", messages: [], outils: OUTILS, maxJetons: 4000 });
    expect(corps.provider).toEqual({ zdr: true, data_collection: "deny" });
    expect(corps.model).toBe("anthropic/claude-haiku-5.5");
  });

  it("lit les appels d'outils, les jetons, et un filtre de contenu comme un refus", () => {
    expect(lireTour(DEMANDE_OUTIL)).toEqual({
      texte: "",
      outils: [{ id: "appel-1", nom: "lister_entreprises", arguments: {} }],
      refus: false,
      jetons: { entree: 1200, sortie: 40, cacheLu: 800 },
    });
    expect(lireTour({ choices: [{ message: { content: "" }, finish_reason: "content_filter" }] }).refus).toBe(true);
  });

  it("vaut un appel sans argument quand les arguments sont illisibles", () => {
    const tour = lireTour({
      choices: [{ message: { tool_calls: [{ id: "x", type: "function", function: { name: "ratios", arguments: "{pas du json" } }] } }],
    });
    expect(tour.outils[0].arguments).toEqual({});
  });

  it("réinjecte le message de l'assistant avec ses appels d'outils", () => {
    expect(messageAssistant(DEMANDE_OUTIL)).toEqual({
      role: "assistant",
      content: null,
      tool_calls: DEMANDE_OUTIL.choices![0].message!.tool_calls,
    });
  });
});

describe("OpenRouter : appel", () => {
  it("s'authentifie et envoie le corps tel quel", async () => {
    const recuperer = jest.fn(async () => reponseHttp(REPONSE_FINALE));
    await appelerOpenRouter({ cle: "cle-test", corps: { model: "m" }, recuperer: recuperer as unknown as typeof fetch });
    const [url, init] = recuperer.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer cle-test");
    expect(JSON.parse(init.body as string)).toEqual({ model: "m" });
  });

  it("traduit un statut d'échec, et une erreur dans un corps 200, en ErreurOpenRouter", async () => {
    const refus = jest.fn(async () => reponseHttp({ error: { code: 402, message: "Insufficient credits" } }, 402));
    await expect(appelerOpenRouter({ cle: "c", corps: {}, recuperer: refus as unknown as typeof fetch })).rejects.toMatchObject({
      statut: 402,
    });
    const tardive = jest.fn(async () => reponseHttp({ error: { code: 502, message: "Provider down" } }));
    await expect(appelerOpenRouter({ cle: "c", corps: {}, recuperer: tardive as unknown as typeof fetch })).rejects.toBeInstanceOf(
      ErreurOpenRouter,
    );
  });
});

describe("Conseiller par OpenRouter", () => {
  const executeur = {
    entites: async () => [{ id: "e1", name: "Bastide Confection SARL", currency: "EUR" }],
    executer: jest.fn(async () => ({ contenu: [{ id: "e1", nom: "Bastide Confection SARL" }], erreur: false })),
  } as unknown as ExecuteurOutils;
  let fetchOriginal: typeof fetch;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "cle-test";
    delete process.env.OPENROUTER_MODELE;
    fetchOriginal = global.fetch;
  });
  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    global.fetch = fetchOriginal;
  });

  it("passe par OpenRouter quand sa clé est posée, et le dit", () => {
    const service = new ConseilService(executeur);
    expect(service.configure).toBe(true);
    expect(service.description).toEqual({ fournisseur: "OpenRouter", modele: "anthropic/claude-haiku-5.5" });
  });

  it("mène la boucle : outil demandé, exécuté, résultat rendu sous le même identifiant, réponse", async () => {
    const corps: Array<{ messages: Array<Record<string, unknown>>; provider: unknown }> = [];
    const reponses = [DEMANDE_OUTIL, REPONSE_FINALE];
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      corps.push(JSON.parse(init!.body as string));
      return reponseHttp(reponses[corps.length - 1]);
    }) as unknown as typeof fetch;

    const reponse = await new ConseilService(executeur).repondre("org-1", "Quel est le délai clients de Bastide ?");

    expect(reponse.texte).toBe("Le délai de paiement des clients est de 55 jours.");
    expect(reponse.sources).toEqual([{ outil: "lister_entreprises", arguments: {}, erreur: false }]);
    expect(reponse.consommation).toEqual({ entree: 2700, sortie: 100, cacheLu: 800 });
    expect(corps).toHaveLength(2);
    // Chaque requête exige la confidentialité.
    expect(corps.every((c) => JSON.stringify(c.provider) === JSON.stringify({ zdr: true, data_collection: "deny" }))).toBe(true);
    // Le second tour porte l'appel d'outil de l'assistant, puis son résultat.
    const second = corps[1].messages;
    expect(second[0]).toMatchObject({ role: "system" });
    expect(second[2]).toMatchObject({ role: "assistant", tool_calls: [{ id: "appel-1" }] });
    expect(second[3]).toEqual({
      role: "tool",
      tool_call_id: "appel-1",
      content: JSON.stringify([{ id: "e1", nom: "Bastide Confection SARL" }]),
    });
  });

  it("annonce une indisponibilité, sans détail technique, quand le crédit est épuisé", async () => {
    global.fetch = jest.fn(async () => reponseHttp({ error: { code: 402, message: "Insufficient credits" } }, 402)) as unknown as typeof fetch;
    await expect(new ConseilService(executeur).repondre("org-1", "Question")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("dit que le conseiller n'est pas joignable quand le réseau tombe", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(new ConseilService(executeur).repondre("org-1", "Question")).rejects.toThrow("pas joignable");
  });
});
