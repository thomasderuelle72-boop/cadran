import { describe, expect, it } from "vitest";
import { valeurCookie } from "./client";

/*
 * Cette fonction porte deux décisions : « une session semble-t-elle
 * ouverte ? » et « le navigateur a-t-il refusé les cookies ? ». La seconde
 * sert à afficher un message à l'utilisateur plutôt que de le renvoyer sur
 * l'écran de connexion sans explication — elle doit donc être juste.
 */
describe("lecture d'un cookie", () => {
  it("trouve un cookie seul", () => {
    expect(valeurCookie("cadran_csrf=abc", "cadran_csrf")).toBe("abc");
  });

  it("trouve un cookie au milieu d'autres", () => {
    expect(valeurCookie("a=1; cadran_csrf=abc; b=2", "cadran_csrf")).toBe("abc");
  });

  it("trouve un cookie en dernière position", () => {
    expect(valeurCookie("a=1; cadran_csrf=abc", "cadran_csrf")).toBe("abc");
  });

  it("rend null sur une chaîne vide — le cas des cookies refusés", () => {
    // Safari bloque les cookies tiers : la connexion répond 200 mais
    // document.cookie reste vide. C'est ce cas qui déclenche le message.
    expect(valeurCookie("", "cadran_csrf")).toBeNull();
  });

  it("ne confond pas un cookie dont le nom se termine par le nôtre", () => {
    // Sans le préfixe « ; » dans la recherche, celui-ci passait pour le bon.
    expect(valeurCookie("faux_cadran_csrf=pirate", "cadran_csrf")).toBeNull();
  });

  it("ne confond pas un cookie dont le nom commence par le nôtre", () => {
    expect(valeurCookie("cadran_csrf_autre=x", "cadran_csrf")).toBeNull();
  });

  it("distingue le jeton CSRF du cookie de session", () => {
    // Le cookie de session est httpOnly : il n'apparaît jamais ici. Si on
    // le trouvait, c'est qu'il aurait perdu cet attribut.
    expect(valeurCookie("cadran_session=jwt", "cadran_csrf")).toBeNull();
  });

  it("rend une valeur vide plutôt que null pour un cookie vidé", () => {
    expect(valeurCookie("cadran_csrf=", "cadran_csrf")).toBe("");
  });
});
