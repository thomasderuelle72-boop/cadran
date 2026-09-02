import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthUser } from "../common/current-user.decorator";

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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "change-me-in-production",
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
