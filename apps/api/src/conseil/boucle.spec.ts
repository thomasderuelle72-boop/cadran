import {
  TEXTE_REFUS,
  TEXTE_TRONQUE,
  type DemandeOutil,
  type ResultatOutilBoucle,
  type TourModele,
  boucleConseil,
} from "./boucle";

const SANS_JETON = { entree: 0, sortie: 0, cacheLu: 0 };

function tour(partiel: Partial<TourModele> = {}): TourModele {
  return { texte: "", outils: [], refus: false, jetons: SANS_JETON, ...partiel };
}

function outil(nom: string, id = "u1", args: Record<string, unknown> = {}): DemandeOutil {
  return { id, nom, arguments: args };
}

/** Monte une boucle dont le modèle est un répondeur scripté. */
type Execution = (demande: DemandeOutil) => Promise<{ contenu: unknown; erreur: boolean }>;

function monter(reponses: TourModele[], executer?: Execution) {
  const remises: ResultatOutilBoucle[][] = [];
  const memorises: TourModele[] = [];
  const appels: DemandeOutil[] = [];
  let index = 0;

  const issue = boucleConseil({
    interroger: async () => reponses[Math.min(index++, reponses.length - 1)],
    memoriser: (t) => memorises.push(t),
    remettreResultats: (r) => remises.push(r),
    executer: async (demande) => {
      appels.push(demande);
      return (executer ?? executionParDefaut)(demande);
    },
    toursMax: 4,
  });

  return { issue, remises, memorises, appels, nombreInterrogations: () => index };
}

const executionParDefaut: Execution = async (demande) => ({
  contenu: { ok: demande.nom },
  erreur: false,
});

describe("boucle de conseil", () => {
  it("rend le texte quand le modèle ne demande aucun outil", async () => {
    const { issue } = monter([tour({ texte: "Votre trésorerie est saine." })]);
    const resultat = await issue;
    expect(resultat.texte).toBe("Votre trésorerie est saine.");
    expect(resultat.tronquee).toBe(false);
    expect(resultat.sources).toEqual([]);
  });

  it("exécute les outils demandés puis rend la réponse suivante", async () => {
    const { issue, appels } = monter([
      tour({ outils: [outil("tendance", "u1", { entrepriseId: "e1" })] }),
      tour({ texte: "Août s'effondre." }),
    ]);
    const resultat = await issue;
    expect(appels.map((a) => a.nom)).toEqual(["tendance"]);
    expect(resultat.texte).toBe("Août s'effondre.");
    expect(resultat.sources).toEqual([
      { outil: "tendance", arguments: { entrepriseId: "e1" }, erreur: false },
    ]);
  });

  it("remet tous les résultats d'un tour en un seul message", async () => {
    // Les répartir sur plusieurs messages apprend au modèle à ne plus
    // demander ses outils en parallèle, et chaque tour est facturé.
    const { issue, remises } = monter([
      tour({
        outils: [outil("tendance", "u1"), outil("concentration", "u2"), outil("flux_tresorerie", "u3")],
      }),
      tour({ texte: "fini" }),
    ]);
    await issue;
    expect(remises).toHaveLength(1);
    expect(remises[0].map((r) => r.id)).toEqual(["u1", "u2", "u3"]);
  });

  it("enchaîne plusieurs tours d'outils", async () => {
    const { issue, appels, remises } = monter([
      tour({ outils: [outil("lister_entreprises", "u1")] }),
      tour({ outils: [outil("lister_periodes", "u2")] }),
      tour({ outils: [outil("soldes_intermediaires", "u3")] }),
      tour({ texte: "voici" }),
    ]);
    const resultat = await issue;
    expect(appels).toHaveLength(3);
    expect(remises).toHaveLength(3);
    expect(resultat.texte).toBe("voici");
    expect(resultat.tronquee).toBe(false);
  });

  it("s'arrête sur sa borne plutôt que de boucler", async () => {
    // Un modèle qui redemande indéfiniment des outils consomme sans
    // produire, et rien d'autre ne plafonne la dépense.
    const { issue, nombreInterrogations } = monter([tour({ outils: [outil("tendance")] })]);
    const resultat = await issue;
    expect(resultat.tronquee).toBe(true);
    expect(resultat.texte).toBe(TEXTE_TRONQUE);
    expect(nombreInterrogations()).toBe(4);
  });

  it("compte les jetons même quand elle n'aboutit pas", async () => {
    // Ils sont facturés de toute façon : ne les compter qu'en cas de succès
    // sous-estimerait le coût, qui est ce qu'on cherche à mesurer.
    const { issue } = monter([
      tour({ outils: [outil("tendance")], jetons: { entree: 100, sortie: 20, cacheLu: 80 } }),
    ]);
    const resultat = await issue;
    expect(resultat.tronquee).toBe(true);
    expect(resultat.consommation).toEqual({ entree: 400, sortie: 80, cacheLu: 320 });
  });

  it("cumule les jetons de tous les tours", async () => {
    const { issue } = monter([
      tour({ outils: [outil("tendance")], jetons: { entree: 1000, sortie: 50, cacheLu: 900 } }),
      tour({ texte: "fini", jetons: { entree: 1200, sortie: 300, cacheLu: 1100 } }),
    ]);
    expect((await issue).consommation).toEqual({ entree: 2200, sortie: 350, cacheLu: 2000 });
  });

  it("s'arrête net sur un refus, sans exécuter d'outil", async () => {
    const { issue, appels } = monter([tour({ refus: true, jetons: { entree: 10, sortie: 0, cacheLu: 0 } })]);
    const resultat = await issue;
    expect(resultat.refusee).toBe(true);
    expect(resultat.texte).toBe(TEXTE_REFUS);
    expect(appels).toEqual([]);
    // Un refus est facturé : il doit compter.
    expect(resultat.consommation.entree).toBe(10);
  });

  it("ne mémorise pas un tour refusé", async () => {
    // Le renvoyer au modèle au tour suivant n'aurait aucun sens : la boucle
    // s'arrête là.
    const { issue, memorises } = monter([tour({ refus: true })]);
    await issue;
    expect(memorises).toEqual([]);
  });

  it("poursuit après l'échec d'un outil, en le signalant", async () => {
    // « Cette période n'existe pas » est une réponse acceptable ; une
    // exception interromprait la conversation sur une erreur technique.
    const { issue } = monter(
      [tour({ outils: [outil("soldes_intermediaires", "u1", { periodeId: "faux" })] }), tour({ texte: "je n'ai pas trouvé cette période" })],
      async () => ({ contenu: { erreur: "Période introuvable." }, erreur: true })
    );
    const resultat = await issue;
    expect(resultat.texte).toBe("je n'ai pas trouvé cette période");
    expect(resultat.sources[0].erreur).toBe(true);
  });

  it("trace chaque outil appelé, dans l'ordre, avec ses arguments", async () => {
    // C'est ce qui permet d'afficher à l'utilisateur d'où sortent les
    // chiffres — la promesse que le modèle n'invente rien.
    const { issue } = monter([
      tour({ outils: [outil("lister_entreprises", "u1"), outil("tendance", "u2", { entrepriseId: "e1" })] }),
      tour({ texte: "fini" }),
    ]);
    expect((await issue).sources).toEqual([
      { outil: "lister_entreprises", arguments: {}, erreur: false },
      { outil: "tendance", arguments: { entrepriseId: "e1" }, erreur: false },
    ]);
  });
});
