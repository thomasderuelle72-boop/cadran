import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EntitiesService } from "./entities.service";
import { NOM_DOSSIER } from "../plateforme/dossier-test";

/**
 * Suppression d'un dossier et quota : les deux endroits où une erreur coûte
 * cher — un dossier effacé par mégarde, ou un client bloqué par son propre
 * dossier de démonstration.
 */

interface Entite {
  id: string;
  organizationId: string;
  name: string;
}

function service(entites: Entite[]) {
  const supprimes: string[] = [];
  const comptes: unknown[] = [];
  const prisma = {
    entity: {
      findFirst: ({ where }: { where: Partial<Entite> & { id?: string } }) =>
        Promise.resolve(
          entites.find(
            (e) =>
              (!where.id || e.id === where.id) &&
              (!where.organizationId || e.organizationId === where.organizationId) &&
              (!where.name || e.name === where.name)
          ) ?? null
        ),
      delete: ({ where }: { where: { id: string } }) => {
        supprimes.push(where.id);
        return Promise.resolve({});
      },
      count: (args: unknown) => {
        comptes.push(args);
        return Promise.resolve(0);
      },
      create: ({ data }: { data: unknown }) => Promise.resolve(data),
    },
  };
  const billing = { exigerQuota: () => Promise.resolve() };
  return { service: new EntitiesService(prisma as never, billing as never), supprimes, comptes };
}

const NOVA: Entite = { id: "e1", organizationId: "org-a", name: "Atelier Nova SAS" };
const AUTRE_ORG: Entite = { id: "e2", organizationId: "org-b", name: "Atelier Nova SAS" };

describe("suppression d'un dossier", () => {
  it("supprime quand le nom recopié est exact", async () => {
    const { service: s, supprimes } = service([NOVA]);
    await expect(s.supprimer("org-a", "e1", "Atelier Nova SAS")).resolves.toEqual({ supprime: "Atelier Nova SAS" });
    expect(supprimes).toEqual(["e1"]);
  });

  it("tolère des espaces autour du nom, pas une faute", async () => {
    const { service: s, supprimes } = service([NOVA]);
    await s.supprimer("org-a", "e1", "  Atelier Nova SAS ");
    expect(supprimes).toEqual(["e1"]);

    const second = service([NOVA]);
    await expect(second.service.supprimer("org-a", "e1", "atelier nova sas")).rejects.toThrow(BadRequestException);
    expect(second.supprimes).toEqual([]);
  });

  it("n'atteint jamais le dossier d'une autre organisation, même avec son nom", async () => {
    const { service: s, supprimes } = service([NOVA, AUTRE_ORG]);
    await expect(s.supprimer("org-a", "e2", "Atelier Nova SAS")).rejects.toThrow(NotFoundException);
    expect(supprimes).toEqual([]);
  });
});

describe("quota de dossiers", () => {
  it("ne compte pas le dossier de démonstration", async () => {
    const { service: s, comptes } = service([]);
    await s.create("org-a", { name: "Nouveau dossier" });
    expect(comptes).toEqual([{ where: { organizationId: "org-a", name: { not: NOM_DOSSIER } } }]);
  });
});
