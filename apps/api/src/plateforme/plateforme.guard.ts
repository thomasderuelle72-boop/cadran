import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthenticatedRequest } from "../common/current-user.decorator";

/**
 * Réserve une route à l'administration de la plateforme.
 *
 * Le drapeau vient de `AuthUser`, que la stratégie JWT a relu en base à
 * l'instant même (voir jwt.strategy.ts) : retirer le droit à quelqu'un prend
 * effet à sa requête suivante, sans attendre l'expiration de son jeton.
 *
 * Le garde refuse aussi la chaîne : on n'administre pas la plateforme depuis
 * une session d'accès support. Sans cette règle, un administrateur entré
 * chez un client pourrait, de là, ouvrir un accès chez un autre — et la piste
 * d'audit du second client montrerait une prise en charge dont l'origine
 * serait le premier. Une session support est une impasse volontaire.
 */
@Injectable()
export class PlateformeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user?.administrateurPlateforme) {
      throw new ForbiddenException("Réservé à l'administration de la plateforme.");
    }
    if (user.support) {
      throw new ForbiddenException(
        "Quittez l'accès support avant d'administrer la plateforme."
      );
    }
    return true;
  }
}
