import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { COOKIE_SESSION } from "./session";
import { AuthUser } from "../common/current-user.decorator";
import { getJwtSecret } from "./jwt-secret";

interface JwtPayload {
  sub: string;
  organizationId: string;
  role: AuthUser["role"];
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
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

  validate(payload: JwtPayload): AuthUser {
    return {
      userId: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
      email: payload.email,
    };
  }
}
