import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { VALIDATEURS, cleConnue } from "./validation";

@Injectable()
export class PreferencesService {
  constructor(private prisma: PrismaService) {}

  private validateur(cle: string) {
    if (!cleConnue(cle)) throw new NotFoundException("Réglage inconnu.");
    return VALIDATEURS[cle];
  }

  /** La valeur enregistrée, ou `null` : l'écran applique alors son défaut. */
  async lire(organizationId: string, cle: string): Promise<{ valeur: unknown }> {
    const valider = this.validateur(cle);
    const enBase = await this.prisma.preferenceCabinet.findUnique({
      where: { organizationId_cle: { organizationId, cle } },
    });
    if (!enBase) return { valeur: null };
    const verdict = valider(enBase.valeur);
    return { valeur: verdict.valide ? verdict.valeur : null };
  }

  async enregistrer(organizationId: string, cle: string, brut: unknown): Promise<{ valeur: unknown }> {
    const verdict = this.validateur(cle)(brut);
    if (!verdict.valide) throw new BadRequestException(verdict.motif);
    await this.prisma.preferenceCabinet.upsert({
      where: { organizationId_cle: { organizationId, cle } },
      create: { organizationId, cle, valeur: verdict.valeur as object },
      update: { valeur: verdict.valeur as object },
    });
    return { valeur: verdict.valeur };
  }

  /** Revenir au défaut : on efface la ligne plutôt que d'enregistrer le défaut, qui peut évoluer. */
  async effacer(organizationId: string, cle: string): Promise<{ valeur: null }> {
    this.validateur(cle);
    await this.prisma.preferenceCabinet.deleteMany({ where: { organizationId, cle } });
    return { valeur: null };
  }
}
