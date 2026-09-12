import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EntitiesService } from "../entities/entities.service";
import { RatiosService } from "../ratios/ratios.service";
import { computeSig, type Sig } from "./sig";
import { computeDiagnostic, type Diagnostic } from "./scores";
import {
  computeBfrNormatif,
  computeSeuilRentabilite,
  joursEntreDates,
  type BfrNormatif,
  type SeuilRentabilite,
} from "./structure";
import { computeTableauFlux, type TableauFlux } from "./tableau-flux";
import {
  DELAI_PAIEMENT_DEFAUT_JOURS,
  computeBalanceAgee,
  computeConcentration,
  type BalanceAgee,
  type Concentration,
  type EcritureTiers,
  type SensTiers,
} from "./encours";

export interface SigPayload {
  periodId: string;
  periodLabel: string;
  currency: string;
  sig: Sig;
  /** Même période de l'exercice précédent, quand elle existe, pour comparer. */
  precedent: { periodId: string; periodLabel: string; sig: Sig } | null;
}

export interface FluxPayload {
  periodId: string;
  periodLabel: string;
  currency: string;
  ouverturePeriodId: string;
  ouverturePeriodLabel: string;
  flux: TableauFlux;
}

export interface DiagnosticPayload {
  periodId: string;
  periodLabel: string;
  currency: string;
  joursPeriode: number;
  diagnostic: Diagnostic;
  seuilRentabilite: SeuilRentabilite;
  bfrNormatif: BfrNormatif;
}

/**
 * Comptes portant ce que l'entreprise a accumulé par elle-même : réserves,
 * report à nouveau, et le résultat des exercices antérieurs non encore
 * affecté. Le capital social (101) en est exclu — il a été apporté, pas gagné,
 * et c'est précisément la distinction que mesure le modèle d'Altman.
 */
const PREFIXES_RESERVES = ["106", "11", "12"];

@Injectable()
export class AnalysisService {
  constructor(
    private prisma: PrismaService,
    private entitiesService: EntitiesService,
    private ratiosService: RatiosService
  ) {}

  private async periodeOuThrow(organizationId: string, periodId: string) {
    const periode = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, entity: { organizationId } },
      include: { entity: true },
    });
    if (!periode) throw new NotFoundException("Période introuvable.");
    return periode;
  }

  async sig(organizationId: string, periodId: string): Promise<SigPayload> {
    const periode = await this.periodeOuThrow(organizationId, periodId);
    const { aggregates } = await this.ratiosService.getForPeriod(organizationId, periodId);

    const precedente = await this.prisma.accountingPeriod.findFirst({
      where: { entityId: periode.entityId, startDate: { lt: periode.startDate } },
      orderBy: { startDate: "desc" },
    });

    let precedent: SigPayload["precedent"] = null;
    if (precedente) {
      const donnees = await this.ratiosService.getForPeriod(organizationId, precedente.id);
      precedent = {
        periodId: precedente.id,
        periodLabel: precedente.label,
        sig: computeSig(donnees.aggregates),
      };
    }

    return {
      periodId,
      periodLabel: periode.label,
      currency: periode.entity.currency,
      sig: computeSig(aggregates),
      precedent,
    };
  }

  /**
   * Le tableau de flux se construit par différence entre deux bilans : il
   * demande donc la période demandée *et* celle qui la précède. Sur la
   * première période importée, il n'existe pas — mieux vaut le dire que
   * d'inventer un bilan d'ouverture à zéro, qui présenterait la totalité du
   * bilan comme des flux de l'exercice.
   */
  async flux(organizationId: string, periodId: string): Promise<FluxPayload> {
    const periode = await this.periodeOuThrow(organizationId, periodId);

    const precedente = await this.prisma.accountingPeriod.findFirst({
      where: { entityId: periode.entityId, startDate: { lt: periode.startDate } },
      orderBy: { startDate: "desc" },
    });
    if (!precedente) {
      throw new NotFoundException(
        "Le tableau de flux compare deux bilans successifs : il faut une période antérieure à celle-ci."
      );
    }

    const cloture = await this.ratiosService.getForPeriod(organizationId, periodId);
    const ouverture = await this.ratiosService.getForPeriod(organizationId, precedente.id);

    return {
      periodId,
      periodLabel: periode.label,
      currency: periode.entity.currency,
      ouverturePeriodId: precedente.id,
      ouverturePeriodLabel: precedente.label,
      flux: computeTableauFlux(ouverture.aggregates, cloture.aggregates),
    };
  }

  /**
   * Réserves accumulées à une date donnée, lues sur le grand livre.
   *
   * Renvoie null quand l'entité n'a aucune écriture : le score qui en dépend
   * se déclarera alors indisponible plutôt que de reposer sur une
   * approximation muette.
   */
  private async reservesAccumulees(entityId: string, aLaDate: Date): Promise<number | null> {
    const lignes = await this.prisma.ledgerEntry.findMany({
      where: { entityId, entryDate: { lte: aLaDate } },
      select: { accountCode: true, debit: true, credit: true },
    });
    if (lignes.length === 0) return null;

    return lignes
      .filter((ligne) => PREFIXES_RESERVES.some((prefixe) => ligne.accountCode.startsWith(prefixe)))
      .reduce(
        (somme, ligne) =>
          somme + this.ratiosService.toNumber(ligne.credit) - this.ratiosService.toNumber(ligne.debit),
        0
      );
  }

  async diagnostic(organizationId: string, periodId: string): Promise<DiagnosticPayload> {
    const periode = await this.periodeOuThrow(organizationId, periodId);
    const { aggregates, derived } = await this.ratiosService.getForPeriod(organizationId, periodId);

    // Les scores et le point mort se lisent sur la durée réelle de la
    // période : un trimestre et un exercice ne se comparent pas tels quels.
    const joursPeriode = joursEntreDates(periode.startDate, periode.endDate);
    const reserves = await this.reservesAccumulees(periode.entityId, periode.endDate);

    return {
      periodId,
      periodLabel: periode.label,
      currency: periode.entity.currency,
      joursPeriode,
      diagnostic: computeDiagnostic({
        aggregates,
        derived,
        reservesEtReportANouveau: reserves,
        joursPeriode,
      }),
      seuilRentabilite: computeSeuilRentabilite(aggregates, joursPeriode),
      bfrNormatif: computeBfrNormatif(aggregates, derived, joursPeriode),
    };
  }

  private async ecrituresTiers(entityId: string, debut?: Date, fin?: Date): Promise<EcritureTiers[]> {
    const lignes = await this.prisma.ledgerEntry.findMany({
      where: {
        entityId,
        ...(debut || fin
          ? { entryDate: { ...(debut ? { gte: debut } : {}), ...(fin ? { lte: fin } : {}) } }
          : {}),
      },
      orderBy: { entryDate: "asc" },
    });

    return lignes.map((ligne) => ({
      journalCode: ligne.journalCode,
      entryNum: ligne.entryNum,
      entryDate: ligne.entryDate,
      accountCode: ligne.accountCode,
      auxAccountCode: ligne.auxAccountCode,
      auxAccountLabel: ligne.auxAccountLabel,
      pieceDate: ligne.pieceDate,
      debit: this.ratiosService.toNumber(ligne.debit),
      credit: this.ratiosService.toNumber(ligne.credit),
      lettering: ligne.lettering,
    }));
  }

  async balanceAgee(
    organizationId: string,
    entityId: string,
    sens: SensTiers,
    dateReference?: Date,
    delaiPaiementJours: number = DELAI_PAIEMENT_DEFAUT_JOURS
  ): Promise<BalanceAgee & { entityId: string; currency: string; ecrituresAnalysees: number }> {
    const entite = await this.entitiesService.getOrThrow(organizationId, entityId);
    const ecritures = await this.ecrituresTiers(entityId);

    // Sans date explicite, on se place à la dernière écriture connue plutôt
    // qu'à aujourd'hui : une balance âgée arrêtée après la fin des données
    // vieillirait tout l'encours d'un coup, sans que rien n'ait bougé.
    const derniere = ecritures.reduce<Date | null>(
      (max, ligne) => (!max || ligne.entryDate > max ? ligne.entryDate : max),
      null
    );
    const reference = dateReference ?? derniere ?? new Date();

    return {
      ...computeBalanceAgee(ecritures, sens, reference, delaiPaiementJours),
      entityId,
      currency: entite.currency,
      ecrituresAnalysees: ecritures.length,
    };
  }

  async concentration(
    organizationId: string,
    entityId: string,
    sens: SensTiers,
    debut?: Date,
    fin?: Date
  ): Promise<Concentration & { entityId: string; currency: string }> {
    const entite = await this.entitiesService.getOrThrow(organizationId, entityId);
    const ecritures = await this.ecrituresTiers(entityId, debut, fin);

    return {
      ...computeConcentration(ecritures, sens),
      entityId,
      currency: entite.currency,
    };
  }
}
