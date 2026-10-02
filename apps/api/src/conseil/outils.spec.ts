import { NOMS_OUTILS, OUTILS, TOURS_MAX, outilConnu } from "./outils";
import { CONSIGNE_STABLE, REGLE_CARDINALE, contexteSession } from "./consigne";

describe("catalogue d'outils", () => {
  it("porte des noms uniques", () => {
    expect(new Set(NOMS_OUTILS).size).toBe(OUTILS.length);
  });

  it("nomme ses outils en français, comme le reste du domaine", () => {
    for (const nom of NOMS_OUTILS) {
      expect(nom).toMatch(/^[a-z][a-z_]*$/);
    }
  });

  it("décrit chaque outil assez pour qu'il soit choisi à bon escient", () => {
    // Une description laconique fait appeler le mauvais outil, ce qui coûte
    // un aller-retour et produit une réponse à côté.
    for (const outil of OUTILS) {
      expect(outil.description.length).toBeGreaterThan(80);
    }
  });

  it("ferme chaque schéma et valide strictement", () => {
    // Sans additionalProperties: false, un argument inventé passe en
    // silence ; sans strict, un argument manquant n'est refusé qu'à
    // l'exécution.
    for (const outil of OUTILS) {
      expect(outil.input_schema.additionalProperties).toBe(false);
      expect(outil.strict).toBe(true);
    }
  });

  it("rend obligatoire tout paramètre déclaré", () => {
    // Un paramètre facultatif que le modèle omet produit une requête
    // incomplète qu'il faut rattraper côté service ; il est plus simple
    // d'exiger une valeur explicite.
    for (const outil of OUTILS) {
      const declares = Object.keys(outil.input_schema.properties).sort();
      expect([...outil.input_schema.required].sort()).toEqual(declares);
    }
  });

  it("décrit chaque paramètre", () => {
    for (const outil of OUTILS) {
      for (const [nom, schema] of Object.entries(outil.input_schema.properties)) {
        expect(schema.description.length).toBeGreaterThan(15);
        expect(nom).not.toBe("");
      }
    }
  });

  it("n'expose aucun outil d'écriture", () => {
    // L'agent conseille, il ne modifie rien. Un outil de création ou de
    // suppression ouvrirait une action non consentie sur les données du
    // client.
    for (const nom of NOMS_OUTILS) {
      expect(nom).not.toMatch(/creer|supprimer|modifier|importer|enregistrer/);
    }
  });

  it("n'accepte jamais d'identifiant d'organisation en argument", () => {
    // Le cloisonnement vient du jeton de session. Laisser le modèle fournir
    // cet identifiant, c'est lui laisser désigner les données d'un autre
    // client.
    for (const outil of OUTILS) {
      for (const nom of Object.keys(outil.input_schema.properties)) {
        expect(nom.toLowerCase()).not.toContain("organization");
        expect(nom.toLowerCase()).not.toContain("organisation");
      }
    }
  });

  it("reconnaît ses outils et rejette les autres", () => {
    expect(outilConnu("tendance")).toBe(true);
    expect(outilConnu("supprimer_tout")).toBe(false);
    expect(outilConnu("")).toBe(false);
  });

  it("borne le nombre d'allers-retours", () => {
    // Sans borne, un modèle qui boucle sur des appels d'outils consomme
    // sans produire, et rien ne plafonne la dépense.
    expect(TOURS_MAX).toBeGreaterThanOrEqual(3);
    expect(TOURS_MAX).toBeLessThanOrEqual(10);
  });
});

describe("consigne", () => {
  it("énonce la règle cardinale", () => {
    expect(CONSIGNE_STABLE).toContain(REGLE_CARDINALE);
    expect(REGLE_CARDINALE).toMatch(/ne calculez jamais/i);
  });

  it("interdit explicitement chaque forme de calcul", () => {
    for (const verbe of ["additionnez", "divisez", "extrapolez", "estimez"]) {
      expect(CONSIGNE_STABLE).toContain(verbe);
    }
  });

  it("interdit de présenter une projection comme une prévision", () => {
    // C'est la même honnêteté que la page d'accueil et les conditions
    // générales : prolonger un rythme n'est pas prévoir.
    expect(CONSIGNE_STABLE).toMatch(/prolonge le rythme/);
    expect(CONSIGNE_STABLE).toMatch(/pas une prévision/);
  });

  it("écarte le conseil juridique, fiscal et en investissement", () => {
    expect(CONSIGNE_STABLE).toMatch(/juridique/);
    expect(CONSIGNE_STABLE).toMatch(/[Ff]iscal/);
  });

  it("ne contient aucun chiffre d'exemple qui pourrait être recopié", () => {
    // Un montant d'exemple dans la consigne finit par ressortir dans une
    // réponse comme s'il venait des données.
    expect(CONSIGNE_STABLE).not.toMatch(/\d[\d\s]*€/);
  });
});

describe("contexte de session", () => {
  const aujourdHui = new Date("2026-10-02T09:00:00Z");

  it("donne la date du jour en toutes lettres", () => {
    const texte = contexteSession({ aujourdHui, entites: [] });
    expect(texte).toContain("2 octobre 2026");
  });

  it("énumère les entreprises avec leur identifiant", () => {
    const texte = contexteSession({
      aujourdHui,
      entites: [
        { id: "ent_1", nom: "Atelier Nova Industrie", devise: "EUR" },
        { id: "ent_2", nom: "Atelier Nova GmbH", devise: "USD" },
      ],
    });
    expect(texte).toContain("Atelier Nova Industrie");
    expect(texte).toContain("ent_1");
    expect(texte).toContain("USD");
  });

  it("dit de ne pas demander laquelle quand il n'y en a qu'une", () => {
    // Faire choisir entre une seule option est une question de trop.
    const texte = contexteSession({
      aujourdHui,
      entites: [{ id: "ent_1", nom: "Seule", devise: "EUR" }],
    });
    expect(texte).toMatch(/inutile de demander/);
  });

  it("dit de demander laquelle quand il y en a plusieurs", () => {
    const texte = contexteSession({
      aujourdHui,
      entites: [
        { id: "a", nom: "A", devise: "EUR" },
        { id: "b", nom: "B", devise: "EUR" },
      ],
    });
    expect(texte).toMatch(/demandez laquelle/);
  });

  it("oriente vers l'import quand il n'y a aucune donnée", () => {
    const texte = contexteSession({ aujourdHui, entites: [] });
    expect(texte).toMatch(/aucune entreprise/);
    expect(texte).toMatch(/écritures comptables/);
  });
});
