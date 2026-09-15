import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import {
  COOKIE_CSRF,
  COOKIE_SESSION,
  METHODES_SANS_EFFET,
  csrfValide,
  origineAutorisee,
} from "./session";

export const ENTETE_CSRF = "x-jeton-csrf";

/**
 * Exige la preuve du double envoi sur les requêtes modifiantes authentifiées
 * par cookie.
 *
 * Le garde ne s'applique **que** lorsqu'un cookie de session accompagne la
 * requête, et c'est le point important : le danger de la falsification vient
 * de ce que le navigateur attache les cookies tout seul, à l'initiative de
 * n'importe quelle page. Une requête sans cookie de session — une connexion,
 * un appel muni d'un en-tête `Authorization` posé à la main, la notification
 * de Stripe — n'est pas falsifiable de cette façon et n'a rien à prouver.
 *
 * C'est aussi ce qui évite d'avoir à tenir une liste d'exemptions, toujours
 * incomplète d'une route.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly origines: string[];

  constructor(config: ConfigService) {
    this.origines = (config.get<string>("CORS_ORIGINS") ?? "http://localhost:5173")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    /* Le garde est global : il voit aussi passer les contextes non HTTP
     * (tâches planifiées, par exemple), où il n'y a pas de requête. */
    if (context.getType() !== "http") return true;

    const requete = context.switchToHttp().getRequest<Request>();
    if (METHODES_SANS_EFFET.has(requete.method)) return true;

    const cookies = (requete.cookies ?? {}) as Record<string, string | undefined>;
    if (!cookies[COOKIE_SESSION]) return true;

    if (!origineAutorisee(requete.headers.origin, this.origines)) {
      throw new ForbiddenException("Origine non autorisée.");
    }

    if (!csrfValide(cookies[COOKIE_CSRF], requete.headers[ENTETE_CSRF])) {
      throw new ForbiddenException(
        "Jeton anti-CSRF absent ou invalide. Rechargez la page et recommencez."
      );
    }

    return true;
  }
}
