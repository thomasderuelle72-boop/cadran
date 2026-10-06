import { jetonRevoque } from "./jwt.strategy";

/**
 * Une erreur de signe ici rouvrirait toutes les sessions qu'on croit fermées,
 * sans que rien ne le signale : la connexion marcherait, simplement.
 */
describe("révocation d'un jeton", () => {
  /** `iat` du JWT : en secondes, tronqué vers le bas. */
  const secondes = (date: Date) => Math.floor(date.getTime() / 1000);

  it("laisse passer quand rien n'a été révoqué", () => {
    expect(jetonRevoque(secondes(new Date("2026-01-01T10:00:00Z")), null)).toBe(false);
  });

  it("rejette un jeton émis avant la révocation", () => {
    const emis = secondes(new Date("2026-01-01T10:00:00Z"));
    const revocation = new Date("2026-01-01T12:00:00Z");
    expect(jetonRevoque(emis, revocation)).toBe(true);
  });

  it("laisse passer un jeton émis après la révocation", () => {
    const revocation = new Date("2026-01-01T12:00:00Z");
    const emis = secondes(new Date("2026-01-01T12:00:05Z"));
    expect(jetonRevoque(emis, revocation)).toBe(false);
  });

  it("laisse passer le jeton émis dans la même seconde que la révocation", () => {
    /*
     * Le cas qui compte : changer son mot de passe révoque, puis émet
     * aussitôt un nouveau jeton. Comparer des millisecondes à des secondes
     * tronquées rejetterait ce jeton-là, et l'utilisateur serait déconnecté
     * de la session qu'il vient d'ouvrir — un défaut qu'on attribuerait au
     * mot de passe plutôt qu'à l'arithmétique.
     */
    const revocation = new Date("2026-01-01T12:00:00.800Z");
    const emis = secondes(new Date("2026-01-01T12:00:00.900Z")); // tronqué à 12:00:00
    expect(jetonRevoque(emis, revocation)).toBe(false);
  });

  it("rejette un jeton sans date d'émission", () => {
    // Sans `iat`, impossible de le dater : le tenir pour valable laisserait
    // un jeton forgé sans ce champ échapper à toute révocation.
    expect(jetonRevoque(undefined, new Date("2026-01-01T12:00:00Z"))).toBe(true);
  });

  it("ne rejette pas un jeton sans date quand rien n'est révoqué", () => {
    expect(jetonRevoque(undefined, null)).toBe(false);
  });
});
