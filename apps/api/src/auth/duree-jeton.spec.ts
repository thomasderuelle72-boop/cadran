import { DUREE_PAR_DEFAUT, lireDuree } from "./duree-jeton";

describe("lecture de JWT_EXPIRES_IN", () => {
  const muet = () => undefined;

  it("accepte les durées avec unité", () => {
    expect(lireDuree("12h", muet)).toBe("12h");
    expect(lireDuree("7d", muet)).toBe("7d");
    expect(lireDuree("30m", muet)).toBe("30m");
  });

  it("rend un nombre nu en nombre, pas en chaîne", () => {
    // jsonwebtoken lit un nombre comme des secondes et une chaîne de
    // chiffres comme des millisecondes : « 3600 » laissé en chaîne ferait
    // des sessions de 3,6 secondes.
    expect(lireDuree("3600", muet)).toBe(3600);
  });

  it("tolère les espaces autour", () => {
    expect(lireDuree("  24h  ", muet)).toBe("24h");
  });

  it("retombe sur la valeur par défaut quand la variable est absente ou vide", () => {
    expect(lireDuree(undefined, muet)).toBe(DUREE_PAR_DEFAUT);
    expect(lireDuree("   ", muet)).toBe(DUREE_PAR_DEFAUT);
  });

  it("refuse ce que jsonwebtoken ne sait pas lire, et le dit", () => {
    // Le cas qui comptait : une valeur abîmée ne lève aucune erreur à la
    // signature, elle produit une échéance absurde qu'on découvre en
    // production.
    const messages: string[] = [];
    const avertir = (m: string) => messages.push(m);

    expect(lireDuree("douze heures", avertir)).toBe(DUREE_PAR_DEFAUT);
    expect(lireDuree("12 hours", avertir)).toBe(DUREE_PAR_DEFAUT);
    expect(lireDuree("12h ", avertir)).toBe("12h"); // celui-ci passe
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("JWT_EXPIRES_IN");
    expect(messages[0]).toContain(DUREE_PAR_DEFAUT);
  });
});
