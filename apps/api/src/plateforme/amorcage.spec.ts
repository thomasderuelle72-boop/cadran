import { lireAdresses } from "./amorcage";

describe("lecture de la variable d'amorçage", () => {
  it("accepte une adresse seule", () => {
    expect(lireAdresses("thomas@exemple.fr")).toEqual(["thomas@exemple.fr"]);
  });

  it("accepte plusieurs adresses séparées par des virgules", () => {
    expect(lireAdresses("a@exemple.fr, b@exemple.fr")).toEqual(["a@exemple.fr", "b@exemple.fr"]);
  });

  it("normalise la casse", () => {
    // Les adresses sont stockées en minuscules : sans cette normalisation,
    // l'amorçage ne trouverait rien et échouerait en silence.
    expect(lireAdresses("Thomas@Exemple.FR")).toEqual(["thomas@exemple.fr"]);
  });

  it("ignore les entrées qui ne sont pas des adresses", () => {
    expect(lireAdresses("thomas@exemple.fr,,  , vrai")).toEqual(["thomas@exemple.fr"]);
  });

  it("ne traite pas deux fois la même adresse", () => {
    expect(lireAdresses("a@exemple.fr,A@exemple.fr")).toEqual(["a@exemple.fr"]);
  });

  it("ne fait rien sans variable", () => {
    expect(lireAdresses(undefined)).toEqual([]);
    expect(lireAdresses("")).toEqual([]);
  });
});
