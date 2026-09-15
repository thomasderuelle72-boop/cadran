import { echapper, gabarit } from "./gabarit";

describe("échappement", () => {
  it("neutralise une balise dans un nom d'utilisateur", () => {
    expect(echapper('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("échappe l'esperluette avant tout le reste", () => {
    // Dans l'autre ordre, « &lt; » produit par l'échappement du chevron
    // serait re-échappé en « &amp;lt; » et s'afficherait tel quel.
    expect(echapper("a & <b>")).toBe("a &amp; &lt;b&gt;");
  });
});

describe("gabarit de courriel", () => {
  const lien = "https://cadran.fr/mot-de-passe/nouveau?jeton=abc123";

  const rendu = gabarit("Réinitialiser votre mot de passe", {
    paragraphes: ["Bonjour Camille,", "Ce lien est valable une heure."],
    action: { lien, libelle: "Choisir un nouveau mot de passe" },
    rappelLien: true,
  });

  it("met le lien dans un href, et non dans le corps du texte HTML", () => {
    // C'est tout l'objet de la version HTML : le quoted-printable coupait
    // l'URL en texte seul, un href ne se coupe pas.
    expect(rendu.html).toContain(`href="${lien}"`);
  });

  it("reprend l'adresse en clair sous le bouton", () => {
    // Un client qui n'affiche pas le HTML doit pouvoir la copier.
    expect(rendu.html).toContain("copiez cette adresse");
    expect(rendu.html.split(lien).length - 1).toBe(2);
  });

  it("fournit toujours une version texte contenant le lien", () => {
    // Une version texte absente est en soi un signal de pourriel.
    expect(rendu.texte).toContain(lien);
    expect(rendu.texte).toContain("Bonjour Camille,");
  });

  it("n'insère pas de bouton quand il n'y a pas d'action", () => {
    const sansAction = gabarit("Mot de passe modifié", {
      paragraphes: ["Votre mot de passe vient d'être modifié."],
    });
    expect(sansAction.html).not.toContain("<a ");
    expect(sansAction.texte).toContain("Votre mot de passe vient d'être modifié.");
  });

  it("échappe le lien comme valeur d'attribut", () => {
    const douteux = gabarit("T", {
      paragraphes: ["p"],
      action: { lien: 'https://x/"><script>', libelle: "Ouvrir" },
    });
    expect(douteux.html).not.toContain('"><script>');
  });

  it("garde les styles en ligne : aucune feuille ni balise style", () => {
    // Les clients de messagerie suppriment l'un et l'autre.
    expect(rendu.html).not.toContain("<style");
    expect(rendu.html).not.toContain("<link");
  });
});
