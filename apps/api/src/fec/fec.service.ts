import { BadRequestException, Injectable } from "@nestjs/common";
import { PeriodSource, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EntitiesService } from "../entities/entities.service";
import { RatiosService } from "../ratios/ratios.service";
import { AlertsService } from "../alerts/alerts.service";
import { fecEstEquilibre, parseFec, type ErreurFec } from "./fec-parser";
import { agregerParMois, type CompteNonClasse } from "./fec-aggregation";

/**
 * Nombre de lignes écrites par requête. Un FEC d'exercice complet dépasse
 * couramment la centaine de milliers d'écritures ; les insérer d'un bloc
 * dépasse les limites de paramètres de PostgreSQL.
 */
const TAILLE_LOT = 2000;

/** Au-delà, on renvoie un échantillon : la liste sert à diagnostiquer, pas à tout lister. */
const MAX_ERREURS_RENVOYEES = 50;

export interface ResumeImportFec {
  exercice: number;
  debutExercice: string | null;
  finExercice: string | null;
  ecrituresImportees: number;
  lignesIgnorees: number;
  erreurs: ErreurFec[];
  totalDebit: number;
  totalCredit: number;
  ecart: number;
  equilibre: boolean;
  periodes: Array<{ id: string; label: string; lignes: number }>;
  periodesSupprimees: number;
  comptesNonClasses: CompteNonClasse[];
  /**
   * Périodes saisies à la main qui recouvrent l'exercice importé. Elles ne
   * sont pas touchées — mais les laisser coexister avec les périodes
   * mensuelles dérivées compte deux fois la même activité dans les listes.
   */
  periodesManuellesRecouvrantes: Array<{ id: string; label: string }>;
}

@Injectable()
export class FecService {
  constructor(
    private prisma: PrismaService,
    private entitiesService: EntitiesService,
    private ratiosService: RatiosService,
    private alertsService: AlertsService
  ) {}

  /**
   * Importe un FEC pour une entité : remplace les écritures de l'exercice
   * concerné, régénère les périodes mensuelles qui en découlent, puis
   * recalcule ratios et alertes dans l'ordre chronologique.
   *
   * Un réimport du même exercice est idempotent. Les exercices précédents ne
   * sont jamais touchés, et les périodes saisies à la main non plus.
   */
  async importer(organizationId: string, entityId: string, contenu: string): Promise<ResumeImportFec> {
    await this.entitiesService.getOrThrow(organizationId, entityId);

    const resultat = parseFec(contenu);

    if (resultat.ecritures.length === 0) {
      // Sans une seule écriture lisible, il n'y a rien à importer et le
      // message d'erreur du parseur est la seule chose utile à renvoyer.
      throw new BadRequestException({
        message: "Aucune écriture exploitable dans ce fichier.",
        erreurs: resultat.erreurs.slice(0, MAX_ERREURS_RENVOYEES),
      });
    }

    const { periodes: periodesCalculees, comptesNonClasses } = agregerParMois(resultat.ecritures);
    const exercice = resultat.exercice;

    // Écritures : remplacement intégral de l'exercice.
    await this.prisma.ledgerEntry.deleteMany({ where: { entityId, fiscalYear: exercice } });
    for (let i = 0; i < resultat.ecritures.length; i += TAILLE_LOT) {
      const lot = resultat.ecritures.slice(i, i + TAILLE_LOT);
      await this.prisma.ledgerEntry.createMany({
        data: lot.map((ecriture) => ({
          entityId,
          fiscalYear: exercice,
          journalCode: ecriture.journalCode,
          journalLabel: ecriture.journalLabel,
          entryNum: ecriture.entryNum,
          entryDate: ecriture.entryDate,
          accountCode: ecriture.accountCode,
          accountLabel: ecriture.accountLabel,
          auxAccountCode: ecriture.auxAccountCode,
          auxAccountLabel: ecriture.auxAccountLabel,
          pieceRef: ecriture.pieceRef,
          pieceDate: ecriture.pieceDate,
          label: ecriture.label,
          debit: new Prisma.Decimal(ecriture.debit),
          credit: new Prisma.Decimal(ecriture.credit),
          lettering: ecriture.lettering,
          letteringDate: ecriture.letteringDate,
          validDate: ecriture.validDate,
        })),
      });
    }

    // Périodes mensuelles : créées ou mises à jour, jamais dupliquées.
    const periodesEcrites: Array<{ id: string; label: string; lignes: number }> = [];

    for (const mensuelle of periodesCalculees) {
      const periode = await this.prisma.accountingPeriod.upsert({
        where: { entityId_label: { entityId, label: mensuelle.label } },
        create: {
          entityId,
          label: mensuelle.label,
          startDate: mensuelle.debut,
          endDate: mensuelle.fin,
          source: PeriodSource.FEC,
        },
        update: {
          startDate: mensuelle.debut,
          endDate: mensuelle.fin,
          source: PeriodSource.FEC,
        },
      });

      await this.prisma.financialLineItem.deleteMany({ where: { periodId: periode.id } });
      if (mensuelle.lignes.length > 0) {
        await this.prisma.financialLineItem.createMany({
          data: mensuelle.lignes.map((ligne) => ({
            periodId: periode.id,
            accountCode: ligne.accountCode,
            label: ligne.label,
            amount: new Prisma.Decimal(ligne.amount),
            poste: ligne.poste,
          })),
        });
      }

      periodesEcrites.push({ id: periode.id, label: periode.label, lignes: mensuelle.lignes.length });
    }

    // Un réimport plus court laisserait derrière lui des périodes dérivées
    // qui n'ont plus de contrepartie dans le fichier : on les retire.
    const labelsConserves = new Set(periodesCalculees.map((p) => p.label));
    const premierMois = periodesCalculees[0].debut;
    const dernierMois = periodesCalculees[periodesCalculees.length - 1].fin;

    const orphelines = await this.prisma.accountingPeriod.findMany({
      where: {
        entityId,
        source: PeriodSource.FEC,
        startDate: { gte: premierMois, lte: dernierMois },
        label: { notIn: [...labelsConserves] },
      },
      select: { id: true },
    });
    if (orphelines.length > 0) {
      await this.prisma.accountingPeriod.deleteMany({
        where: { id: { in: orphelines.map((p) => p.id) } },
      });
    }

    // Recalcul dans l'ordre chronologique : la croissance du chiffre
    // d'affaires d'un mois se lit contre le mois précédent, qui doit donc
    // déjà être à jour.
    for (const periode of periodesEcrites) {
      await this.ratiosService.recomputeAndCache(periode.id);
      await this.alertsService.evaluateForPeriod(periode.id);
    }

    const periodesManuellesRecouvrantes = await this.prisma.accountingPeriod.findMany({
      where: {
        entityId,
        source: PeriodSource.MANUEL,
        startDate: { lte: dernierMois },
        endDate: { gte: premierMois },
      },
      select: { id: true, label: true },
      orderBy: { startDate: "asc" },
    });

    return {
      exercice,
      debutExercice: resultat.debutExercice?.toISOString() ?? null,
      finExercice: resultat.finExercice?.toISOString() ?? null,
      ecrituresImportees: resultat.ecritures.length,
      lignesIgnorees: resultat.erreurs.length,
      erreurs: resultat.erreurs.slice(0, MAX_ERREURS_RENVOYEES),
      totalDebit: resultat.totalDebit,
      totalCredit: resultat.totalCredit,
      ecart: resultat.ecart,
      equilibre: fecEstEquilibre(resultat),
      periodes: periodesEcrites,
      periodesSupprimees: orphelines.length,
      comptesNonClasses,
      periodesManuellesRecouvrantes,
    };
  }

  /** Exercices déjà importés pour une entité, du plus récent au plus ancien. */
  async listerExercices(organizationId: string, entityId: string) {
    await this.entitiesService.getOrThrow(organizationId, entityId);

    const groupes = await this.prisma.ledgerEntry.groupBy({
      by: ["fiscalYear"],
      where: { entityId },
      _count: { _all: true },
      _min: { entryDate: true },
      _max: { entryDate: true },
      orderBy: { fiscalYear: "desc" },
    });

    return groupes.map((groupe) => ({
      exercice: groupe.fiscalYear,
      ecritures: groupe._count._all,
      debut: groupe._min.entryDate,
      fin: groupe._max.entryDate,
    }));
  }
}
