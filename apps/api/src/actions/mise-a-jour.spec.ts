import { Prisma } from "@prisma/client";
import { donneesMiseAJour } from "./mise-a-jour";

describe("donneesMiseAJour", () => {
  it("ne touche pas aux champs absents", () => {
    const data = donneesMiseAJour({ statut: "FAITE" });

    expect(data).toEqual({ statut: "FAITE" });
    // Le point du test : pas de clé echeance, donc Prisma la laisse en place.
    expect("echeance" in data).toBe(false);
    expect("impactEstime" in data).toBe(false);
  });

  it("écrit les valeurs renseignées", () => {
    const data = donneesMiseAJour({
      constat: "Le DSO dérive",
      action: "Relancer à J+30",
      ratioId: "dso",
      valeurInitiale: 83,
      valeurCible: 65,
      impactEstime: 84000,
      responsable: "Marie",
      echeance: "2026-06-30T00:00:00.000Z",
    });

    expect(data.constat).toBe("Le DSO dérive");
    expect(data.ratioId).toBe("dso");
    expect(data.valeurCible).toBe(65);
    expect(data.impactEstime).toEqual(new Prisma.Decimal(84000));
    expect(data.echeance).toEqual(new Date("2026-06-30T00:00:00.000Z"));
  });

  it("efface les champs mis à null", () => {
    const data = donneesMiseAJour({
      ratioId: null,
      valeurInitiale: null,
      valeurCible: null,
      impactEstime: null,
      responsable: null,
      echeance: null,
    });

    expect(data.ratioId).toBeNull();
    expect(data.valeurInitiale).toBeNull();
    expect(data.valeurCible).toBeNull();
    expect(data.responsable).toBeNull();
    // Les deux qui se transformaient silencieusement : Decimal(0) et le
    // 1er janvier 1970.
    expect(data.impactEstime).toBeNull();
    expect(data.echeance).toBeNull();
  });

  it("garde un impact ou une cible à zéro, qui n'est pas un effacement", () => {
    const data = donneesMiseAJour({ impactEstime: 0, valeurCible: 0 });

    expect(data.impactEstime).toEqual(new Prisma.Decimal(0));
    expect(data.valeurCible).toBe(0);
  });
});
