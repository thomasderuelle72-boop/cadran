import { LONGUEUR_PAR_DEFAUT, bitsEntropie, genererMotDePasse } from "./motdepasse";

describe("génération d'un mot de passe provisoire", () => {
  it("produit la longueur demandée, tirets non comptés", () => {
    const motDePasse = genererMotDePasse(20);
    expect(motDePasse.replace(/-/g, "")).toHaveLength(20);
    expect(motDePasse).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{1,5})*$/);
  });

  it("n'emploie aucun caractère ambigu", () => {
    // Recopié à la main ou dicté par téléphone, « O » contre « 0 » coûte un
    // appel au support que la longueur du mot de passe rend inutile.
    const tirages = Array.from({ length: 200 }, () => genererMotDePasse()).join("");
    expect(tirages).not.toMatch(/[0O1lI]/);
  });

  it("ne répète pas deux tirages", () => {
    // Un générateur mal câblé — graine fixe, Math.random figé en test —
    // produit deux fois la même valeur, et personne ne le remarque.
    const tirages = new Set(Array.from({ length: 500 }, () => genererMotDePasse()));
    expect(tirages.size).toBe(500);
  });

  it("répartit les caractères sans privilégier le début de l'alphabet", () => {
    // Le biais du modulo se voit ici : avec `octet % 56`, les premiers signes
    // sortent environ 1,14 fois plus souvent que les derniers.
    const compte = new Map<string, number>();
    for (const signe of Array.from({ length: 2000 }, () => genererMotDePasse()).join("").replace(/-/g, "")) {
      compte.set(signe, (compte.get(signe) ?? 0) + 1);
    }
    const effectifs = [...compte.values()];
    const moyenne = effectifs.reduce((a, b) => a + b, 0) / effectifs.length;
    // Large, parce qu'un test aléatoire qui échoue une fois sur cent est un
    // test qu'on finit par ignorer. Un biais de modulo le dépasserait.
    expect(Math.min(...effectifs)).toBeGreaterThan(moyenne * 0.8);
    expect(Math.max(...effectifs)).toBeLessThan(moyenne * 1.2);
  });

  it("refuse de fabriquer un mot de passe trop court", () => {
    expect(() => genererMotDePasse(8)).toThrow(/12/);
  });

  it("annonce une entropie qui ne compte pas les tirets", () => {
    // 20 signes dans un alphabet de 56 : environ 116 bits. Compter les
    // tirets ferait annoncer une solidité qu'on n'a pas.
    expect(bitsEntropie(LONGUEUR_PAR_DEFAUT)).toBe(116);
  });
});
