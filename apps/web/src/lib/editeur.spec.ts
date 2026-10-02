import { describe, expect, it } from "vitest";
import {
  EDITEUR,
  HEBERGEURS,
  MARQUEUR_MANQUANT,
  champsManquants,
  identiteComplete,
  mention,
  type IdentiteEditeur,
} from "./editeur";

const COMPLET: IdentiteEditeur = {
  denomination: "Cadran",
  formeJuridique: "SAS",
  capitalSocial: 1000,
  siege: "1 rue de l'Exemple, 75001 Paris",
  siren: "123456789",
  villeRcs: "Paris",
  tvaIntracommunautaire: "FR00123456789",
  directeurPublication: "Prénom Nom",
  courriel: "contact@cadran.fr",
  telephone: null,
};

describe("affichage d'une mention", () => {
  it("rend la valeur quand elle existe", () => {
    expect(mention("SAS")).toBe("SAS");
    expect(mention(1000)).toBe("1000");
  });

  it("rend un marqueur visible pour un champ absent", () => {
    // Le point de tout le fichier : jamais de valeur plausible à la place
    // d'une mention légale manquante.
    expect(mention(null)).toBe(MARQUEUR_MANQUANT);
    expect(mention("")).toBe(MARQUEUR_MANQUANT);
  });

  it("rend zéro, qui est une valeur et non une absence", () => {
    // Un capital social de 0 € existe (entreprise individuelle) ; le
    // confondre avec « non renseigné » afficherait un marqueur à tort.
    expect(mention(0)).toBe("0");
  });
});

describe("complétude de l'identité", () => {
  it("reconnaît une identité complète", () => {
    expect(identiteComplete(COMPLET)).toBe(true);
    expect(champsManquants(COMPLET)).toEqual([]);
  });

  it("refuse une identité à laquelle il manque le SIREN", () => {
    expect(identiteComplete({ ...COMPLET, siren: null })).toBe(false);
    expect(champsManquants({ ...COMPLET, siren: null })).toContain("numéro SIREN");
  });

  it("refuse l'identité livrée, qui n'est pas encore renseignée", () => {
    // Tant que la société n'est pas immatriculée, la page doit le dire.
    // Ce test échouera le jour où le fichier sera rempli : c'est voulu, il
    // faudra alors le remplacer par l'assertion inverse.
    expect(identiteComplete(EDITEUR)).toBe(false);
    expect(champsManquants(EDITEUR).length).toBeGreaterThan(0);
  });

  it("ne compte pas le téléphone comme obligatoire", () => {
    // Un moyen de contact direct suffit, et le courriel en est un.
    expect(identiteComplete({ ...COMPLET, telephone: null })).toBe(true);
  });
});

describe("hébergeurs", () => {
  it("en déclare au moins un, avec nom, adresse et pays", () => {
    // La LCEN impose de nommer l'hébergeur ; le RGPD impose de savoir où
    // les données atterrissent.
    expect(HEBERGEURS.length).toBeGreaterThan(0);
    for (const h of HEBERGEURS) {
      expect(h.nom).not.toBe("");
      expect(h.adresse).not.toBe("");
      expect(h.pays).not.toBe("");
    }
  });

  it("couvre à la fois le site et les données", () => {
    // Deux prestataires distincts : les deux doivent être déclarés, et la
    // base de données est celui qui compte pour le RGPD.
    expect(HEBERGEURS.length).toBeGreaterThanOrEqual(2);
  });
});

describe("adresse de contact", () => {
  it("est toujours renseignée", () => {
    // C'est la seule mention qu'on puisse donner avant immatriculation, et
    // elle est obligatoire.
    expect(EDITEUR.courriel).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });
});
