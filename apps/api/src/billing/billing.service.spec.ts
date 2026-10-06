import { ForbiddenException } from "@nestjs/common";
import { BillingService } from "./billing.service";

/**
 * Le garde de fonction, éprouvé pour ce qu'il est : la seule chose qui fasse
 * tenir la promesse de la page de tarifs.
 *
 * Il existait avant, correctement écrit, et aucun appelant ne l'invoquait :
 * la consolidation était annoncée à partir de Cabinet et servie à l'essai.
 * Un test sur la fonction seule n'aurait rien vu — il en fallait un qui parte
 * de la formule et finisse sur le refus.
 */
function service(plan: string) {
  const prisma = {
    subscription: {
      upsert: () => Promise.resolve({ plan, statut: "actif" }),
    },
  };
  return new BillingService(prisma as never, { configure: false } as never);
}

describe("exigerFonction", () => {
  it("refuse la consolidation à l'essai, et le dit avec le nom de la formule", async () => {
    await expect(service("essai").exigerFonction("org", "consolidation")).rejects.toThrow(
      ForbiddenException
    );
    await expect(service("essai").exigerFonction("org", "consolidation")).rejects.toThrow(
      /Essai/
    );
  });

  it("refuse la consolidation à la formule Indépendant", async () => {
    await expect(service("solo").exigerFonction("org", "consolidation")).rejects.toThrow(
      ForbiddenException
    );
  });

  it("l'accorde à partir de Cabinet, comme l'annonce la page de tarifs", async () => {
    await expect(service("cabinet").exigerFonction("org", "consolidation")).resolves.toBeUndefined();
    await expect(service("groupe").exigerFonction("org", "consolidation")).resolves.toBeUndefined();
  });

  it("accorde l'import FEC à toutes les formules du catalogue", async () => {
    // Aujourd'hui aucune formule ne l'exclut : le garde est une sécurité pour
    // le jour où l'on en créerait une, pas une restriction en vigueur.
    for (const plan of ["essai", "solo", "cabinet", "groupe"]) {
      await expect(service(plan).exigerFonction("org", "fec")).resolves.toBeUndefined();
    }
  });

  it("accorde tout à la formule interne", async () => {
    await expect(service("interne").exigerFonction("org", "consolidation")).resolves.toBeUndefined();
    await expect(service("interne").exigerFonction("org", "fec")).resolves.toBeUndefined();
  });

  it("accorde la consolidation à un administrateur de plateforme chez un client", async () => {
    /*
     * Le cas du dépannage : reproduire un bogue de consolidation chez un
     * client en formule Indépendant. Refuser n'empêcherait que l'assistance,
     * et consulter ne laisse rien derrière soi.
     */
    await expect(
      service("solo").exigerFonction("org", "consolidation", true)
    ).resolves.toBeUndefined();
  });
});
