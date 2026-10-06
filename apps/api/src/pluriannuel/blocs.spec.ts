import { BLOCS_MAX, TABLEAU_PAR_DEFAUT, validerBloc, validerBlocs } from "./blocs";

describe("validation d'un bloc de tableau de bord", () => {
  it("accepte une courbe de plusieurs mesures de même unité", () => {
    const verdict = validerBloc({
      type: "courbe",
      titre: "Activité",
      mesures: ["agregat.chiffreAffaires", "derive.ebitda"],
    });
    expect(verdict.valide).toBe(true);
  });

  it("refuse de mêler deux unités sur un même axe", () => {
    /*
     * La règle qui compte. Un chiffre d'affaires en millions et une marge en
     * pourcentage sur un seul axe ne montrent rien ; le réflexe est d'ajouter
     * un second axe, et deux échelles permettent de faire dire n'importe quoi
     * à deux courbes selon la façon dont on les cadre.
     */
    const verdict = validerBloc({
      type: "courbe",
      mesures: ["agregat.chiffreAffaires", "ratio.marge_nette"],
    });
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) expect(verdict.motif).toContain("unité");
  });

  it("tolère le mélange d'unités dans un tableau, qui n'a pas d'axe", () => {
    const verdict = validerBloc({
      type: "tableau",
      mesures: ["agregat.chiffreAffaires", "ratio.marge_nette", "ratio.dso"],
    });
    expect(verdict.valide).toBe(true);
  });

  it("refuse d'empiler des grandeurs qui se recouvrent", () => {
    // EBITDA et résultat net : l'un contient l'autre. Les empiler donne une
    // hauteur qui ne correspond à rien.
    const verdict = validerBloc({
      type: "empile",
      mesures: ["derive.ebitda", "derive.resultatNet"],
    });
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) expect(verdict.motif).toContain("additionne");
  });

  it("accepte d'empiler des postes qui se complètent", () => {
    const verdict = validerBloc({
      type: "empile",
      mesures: ["agregat.achatsConsommes", "agregat.chargesExternes", "agregat.chargesPersonnel"],
    });
    expect(verdict.valide).toBe(true);
  });

  it("borne le nombre de séries d'une forme colorée", () => {
    // La palette validée compte quatre teintes ; une cinquième série serait
    // indiscernable pour une partie des lecteurs.
    const verdict = validerBloc({
      type: "courbe",
      mesures: [
        "agregat.chiffreAffaires",
        "agregat.achatsConsommes",
        "agregat.chargesExternes",
        "agregat.chargesPersonnel",
        "agregat.impotsTaxes",
      ],
    });
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) expect(verdict.motif).toContain("4");
  });

  it("n'admet qu'une mesure sur une tuile", () => {
    const verdict = validerBloc({
      type: "tuile",
      mesures: ["agregat.chiffreAffaires", "derive.ebitda"],
    });
    expect(verdict.valide).toBe(false);
  });

  it("refuse une mesure inconnue plutôt que de l'ignorer", () => {
    // L'ignorer afficherait un graphique amputé d'une série que
    // l'utilisateur croit avoir choisie.
    const verdict = validerBloc({ type: "courbe", mesures: ["agregat.inventé"] });
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) expect(verdict.motif).toContain("inventé");
  });

  it("refuse un bloc sans mesure, un type inconnu, un objet quelconque", () => {
    expect(validerBloc({ type: "courbe", mesures: [] }).valide).toBe(false);
    expect(validerBloc({ type: "camembert", mesures: ["agregat.stocks"] }).valide).toBe(false);
    expect(validerBloc(null).valide).toBe(false);
    expect(validerBloc("courbe").valide).toBe(false);
  });

  it("donne un titre par défaut tiré de la première mesure", () => {
    const verdict = validerBloc({ type: "courbe", mesures: ["agregat.chiffreAffaires"] });
    expect(verdict.valide).toBe(true);
    if (verdict.valide) expect(verdict.bloc.titre).toBe("Chiffre d'affaires");
  });

  it("tronque un titre démesuré au lieu de le refuser", () => {
    const verdict = validerBloc({
      type: "courbe",
      titre: "x".repeat(500),
      mesures: ["agregat.stocks"],
    });
    expect(verdict.valide).toBe(true);
    if (verdict.valide) expect(verdict.bloc.titre).toHaveLength(80);
  });
});

describe("validation d'un tableau complet", () => {
  it("accepte le tableau proposé par défaut", () => {
    // Si la configuration par défaut ne passait pas sa propre validation,
    // chaque nouvelle entité démarrerait sur un écran en erreur.
    const verdict = validerBlocs(TABLEAU_PAR_DEFAUT);
    expect(verdict.valide).toBe(true);
  });

  it("dit quel bloc est en cause", () => {
    const verdict = validerBlocs([
      { type: "courbe", mesures: ["agregat.chiffreAffaires"] },
      { type: "courbe", mesures: ["agregat.chiffreAffaires", "ratio.dso"] },
    ]);
    expect(verdict.valide).toBe(false);
    if (!verdict.valide) expect(verdict.motif).toContain("Bloc 2");
  });

  it("borne le nombre de blocs", () => {
    const trop = Array.from({ length: BLOCS_MAX + 1 }, () => ({
      type: "tuile",
      mesures: ["agregat.chiffreAffaires"],
    }));
    expect(validerBlocs(trop).valide).toBe(false);
  });

  it("refuse autre chose qu'une liste", () => {
    expect(validerBlocs({ blocs: [] }).valide).toBe(false);
  });
});
