import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Request } from "express";

export interface AuthUser {
  userId: string;
  /**
   * Organisation sur laquelle porte la requête. Normalement celle du compte ;
   * en accès support, celle du client pris en charge.
   */
  organizationId: string;
  role: Role;
  email: string;
  /**
   * Droit d'administrer la plateforme. Relu en base à chaque requête, jamais
   * porté par le jeton : un drapeau signé il y a dix heures ne prouve rien de
   * l'instant présent.
   */
  administrateurPlateforme: boolean;
  /**
   * Vrai quand la session est un accès support ouvert par la plateforme sur
   * l'organisation d'un client. L'organisation du compte lui-même reste dans
   * `organisationOrigine`, pour pouvoir revenir.
   */
  support: boolean;
  organisationOrigine: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
