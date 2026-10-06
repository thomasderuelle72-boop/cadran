import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { COOKIE_SESSION } from "./session";
import { AuthUser } from "../common/current-user.decorator";
import { getJwtSecret } from "./jwt-secret";
import { PrismaService } from "../prisma/prisma.service";

export interface JwtPayload {
  sub: string;
  /** Organisation visée. Égale à celle du compte, sauf en accès support. */
  org: string;
  /** Marque un accès support ouvert par un administrateur de la plateforme. */
  support?: true;
  /** Posé par la bibliothèque : instant d'émission, en secondes. */
  iat?: number;
}

/**
 * Validation d'une session.
 *
 * Le jeton ne dit plus que *qui* appelle. Tout ce qui autorise — rôle,
 * organisation, droit d'administrer la plateforme — est relu en base à chaque
 * requête.
 *
 * Avant, ces valeurs étaient recopiées dans le jeton à la connexion et crues
 * telles quelles pendant toute sa durée de vie. Un utilisateur rétrogradé
 * restait administrateur jusqu'à expiration ; un compte supprimé continuait
 * d'ouvrir des portes ; changer son mot de passe après un vol de session ne
 * fermait pas la session volée. Un jeton est une affirmation figée : il ne
 * peut pas porter un droit révocable.
 *
 * Le coût est une lecture par clé primaire par requête. C'est le bon prix.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      /*
       * Le cookie d'abord, l'en-tête ensuite.
       *
       * Le cookie est la voie du navigateur : il est `httpOnly`, donc le
       * jeton n'est jamais exposé au JavaScript de la page.
       *
       * L'en-tête `Authorization` reste accepté pour les clients hors
       * navigateur — curl, une intégration future, les tests. Le conserver ne
       * réintroduit pas la falsification de requête : un navigateur n'ajoute
       * jamais cet en-tête de lui-même, il faut que l'appelant l'écrive.
       */
      jwtFromRequest: ExtractJwt.fromExtractors<Request>([
        (requete) => (requete.cookies?.[COOKIE_SESSION] as string | undefined) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const utilisateur = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        administrateurPlateforme: true,
        sessionsValablesApres: true,
      },
    });
    if (!utilisateur) throw new UnauthorizedException("Session invalide.");

    if (jetonRevoque(payload.iat, utilisateur.sessionsValablesApres)) {
      throw new UnauthorizedException("Session expirée : reconnectez-vous.");
    }

    /*
     * Accès support : le jeton désigne l'organisation d'un client. Il ne vaut
     * que tant que le compte est encore administrateur de la plateforme —
     * retirer le droit coupe les accès support en cours, immédiatement.
     */
    if (payload.support) {
      if (!utilisateur.administrateurPlateforme) {
        throw new UnauthorizedException("Accès support révoqué.");
      }
      return {
        userId: utilisateur.id,
        email: utilisateur.email,
        organizationId: payload.org,
        role: "ADMIN",
        administrateurPlateforme: true,
        support: true,
        organisationOrigine: utilisateur.organizationId,
      };
    }

    /*
     * Session ordinaire : l'organisation et le rôle viennent de la base, pas
     * du jeton. Un jeton qui désignerait une autre organisation ne sert donc
     * à rien, même signé.
     */
    return {
      userId: utilisateur.id,
      email: utilisateur.email,
      organizationId: utilisateur.organizationId,
      role: utilisateur.role,
      administrateurPlateforme: utilisateur.administrateurPlateforme,
      support: false,
      organisationOrigine: utilisateur.organizationId,
    };
  }
}

/**
 * Un jeton émis avant la dernière révocation vaut-il encore ?
 *
 * `iat` est en secondes, tronqué vers le bas ; la date de révocation est à la
 * milliseconde. Comparer sans tronquer les deux rejetterait le jeton émis
 * dans la même seconde que la révocation — exactement celui qu'on vient
 * d'émettre en changeant le mot de passe, ce qui déconnecterait l'utilisateur
 * de la session qu'il vient d'ouvrir.
 *
 * Isolée du reste pour être vérifiable : c'est la seule arithmétique du
 * fichier, et une erreur de signe y ouvrirait toutes les sessions révoquées.
 */
export function jetonRevoque(iat: number | undefined, revocation: Date | null): boolean {
  if (!revocation) return false;
  // Sans `iat`, impossible de dater le jeton : on le tient pour révoqué.
  if (iat === undefined) return true;
  return iat < Math.floor(revocation.getTime() / 1000);
}
