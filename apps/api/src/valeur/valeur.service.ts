import { Injectable } from "@nestjs/common";
import { ActionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RatiosService } from "../ratios/ratios.service";
import type { RatioValue } from "../ratios/engine";
import { joursEntreDates } from "../analysis/structure";
import { calculerGain, type ContexteGain, type NatureGain } from "./gain";

export interface LigneValeur {
  actionId: string;
  entityId: string | null;
  dossier: string | null;
  devise: string;
  constat: string;
  action: string;
  statut: ActionStatus;
  creeeLe: string;
  ratioId: string | null;
  ratioLibelle: string | null;
  unite: RatioValue["unit"] | null;
  valeurInitiale: number | null;
  valeurActuelle: number | null;
  valeurCible: number | null;
  periodeLue: string | null;
  /** Ce que donne le calcul, avant toute correction. */
  gainCalcule: number | null;
  /** Ce qui compte : la correction du cabinet si elle existe, le calcul sinon. */
  gainRetenu: number | null;
  gainCorrige: boolean;
  nature: NatureGain | null;
  explication: string;
  exclue: boolean;
}

export interface BilanValeur {
  lignes: LigneValeur[];
  totaux: {
    tresorerie: number;
    resultat: number;
    /** Gains saisis à la main sur une action sans indicateur chiffrable. */
    autres: number;
    actionsComptees: number;
    dossiers: number;
  };
}

export interface FiltreValeur {
  depuis?: Date;
  statuts: ActionStatus[];
  entityId?: string;
}

/**
 * La valeur créée : ce que les actions du plan ont rapporté aux clients.
 *
 * Chaque action qui suit un indicateur est relue sur la dernière période de
 * son dossier, comme le fait le plan d'action, puis convertie en euros (voir
 * gain.ts). Le cabinet garde la main : il peut écarter une action du bilan
 * ou corriger un gain, et ces choix sont enregistrés sur l'action — ils
 * valent pour cet écran comme pour le rapport client.
 */
@Injectable()
export class ValeurService {
  constructor(
    private prisma: PrismaService,
    private ratios: RatiosService,
  ) {}

  async bilan(organizationId: string, filtre: FiltreValeur): Promise<BilanValeur> {
    const actions = await this.prisma.actionPlan.findMany({
      where: {
        organizationId,
        statut: { in: filtre.statuts },
        ...(filtre.depuis ? { createdAt: { gte: filtre.depuis } } : {}),
        ...(filtre.entityId ? { entityId: filtre.entityId } : {}),
      },
      include: { entity: { select: { name: true, currency: true } } },
      orderBy: { createdAt: "desc" },
    });

    /* La dernière période de chaque dossier, lue une fois : vingt actions
     * sur un même dossier ne doivent pas relire vingt fois ses ratios. */
    const cache = new Map<string, Promise<{ ratios: RatioValue[]; contexte: ContexteGain; label: string } | null>>();
    const derniere = (entityId: string) => {
      if (!cache.has(entityId)) {
        cache.set(
          entityId,
          (async () => {
            const periode = await this.prisma.accountingPeriod.findFirst({
              where: { entityId, entity: { organizationId } },
              orderBy: { startDate: "desc" },
            });
            if (!periode) return null;
            const { ratios, aggregates } = await this.ratios.getForPeriod(organizationId, periode.id);
            return {
              ratios: ratios as RatioValue[],
              label: periode.label,
              contexte: {
                chiffreAffaires: aggregates.chiffreAffaires,
                achatsConsommes: aggregates.achatsConsommes,
                jours: joursEntreDates(periode.startDate, periode.endDate),
              },
            };
          })(),
        );
      }
      return cache.get(entityId)!;
    };

    const lignes = await Promise.all(
      actions.map(async (a): Promise<LigneValeur> => {
        const lecture = a.entityId && a.ratioId ? await derniere(a.entityId) : null;
        const ratio = lecture?.ratios.find((r) => r.id === a.ratioId) ?? null;
        const valeurActuelle = ratio?.value ?? null;
        const gain = calculerGain(a.ratioId, a.valeurInitiale, valeurActuelle, lecture?.contexte ?? null);
        const corrige = a.gainRetenu !== null;
        return {
          actionId: a.id,
          entityId: a.entityId,
          dossier: a.entity?.name ?? null,
          devise: a.entity?.currency ?? "EUR",
          constat: a.constat,
          action: a.action,
          statut: a.statut,
          creeeLe: a.createdAt.toISOString(),
          ratioId: a.ratioId,
          ratioLibelle: ratio?.label ?? null,
          unite: ratio?.unit ?? null,
          valeurInitiale: a.valeurInitiale,
          valeurActuelle,
          valeurCible: a.valeurCible,
          periodeLue: lecture?.label ?? null,
          gainCalcule: gain.montant,
          gainRetenu: corrige ? Number(a.gainRetenu) : gain.montant,
          gainCorrige: corrige,
          nature: gain.nature,
          explication: gain.explication,
          exclue: a.exclureDeLaValeur,
        };
      }),
    );

    const comptees = lignes.filter((l) => !l.exclue && l.gainRetenu !== null);
    const somme = (f: (l: LigneValeur) => boolean) =>
      comptees.filter(f).reduce((s, l) => s + (l.gainRetenu ?? 0), 0);

    return {
      lignes,
      totaux: {
        tresorerie: somme((l) => l.nature === "tresorerie"),
        resultat: somme((l) => l.nature === "resultat"),
        autres: somme((l) => l.nature === null),
        actionsComptees: comptees.length,
        dossiers: new Set(comptees.map((l) => l.entityId)).size,
      },
    };
  }
}
