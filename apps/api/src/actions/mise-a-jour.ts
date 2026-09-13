import { Prisma } from "@prisma/client";
import type { UpdateActionPlanDto } from "./dto/action-plan.dto";

/**
 * Traduit une modification partielle en données Prisma.
 *
 * Trois cas, et non deux. Un champ absent ne doit pas être touché : une
 * modification de statut ne peut pas effacer l'échéance au passage. Un champ
 * à `null` doit être effacé : une cible posée par erreur doit pouvoir être
 * retirée, sinon l'action reste mesurée contre un objectif qui n'existe pas.
 * Un champ renseigné est écrit.
 *
 * Confondre le second et le premier cas, ce que fait un simple
 * `!== undefined` suivi d'une conversion, transformait `null` en Decimal(0)
 * ou en 1er janvier 1970 selon le champ.
 */
export function donneesMiseAJour(dto: UpdateActionPlanDto): Prisma.ActionPlanUpdateInput {
  const data: Prisma.ActionPlanUpdateInput = {};

  if (dto.constat !== undefined) data.constat = dto.constat;
  if (dto.action !== undefined) data.action = dto.action;
  if (dto.statut !== undefined) data.statut = dto.statut;

  // Les champs facultatifs : `null` efface, une valeur écrit.
  if (dto.ratioId !== undefined) data.ratioId = dto.ratioId ?? null;
  if (dto.valeurInitiale !== undefined) data.valeurInitiale = dto.valeurInitiale ?? null;
  if (dto.valeurCible !== undefined) data.valeurCible = dto.valeurCible ?? null;
  if (dto.responsable !== undefined) data.responsable = dto.responsable ?? null;

  if (dto.impactEstime !== undefined) {
    data.impactEstime =
      dto.impactEstime === null ? null : new Prisma.Decimal(dto.impactEstime);
  }

  if (dto.echeance !== undefined) {
    data.echeance = dto.echeance === null ? null : new Date(dto.echeance);
  }

  return data;
}
