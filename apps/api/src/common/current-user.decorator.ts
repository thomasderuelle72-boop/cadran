import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Request } from "express";

export interface AuthUser {
  userId: string;
  organizationId: string;
  role: Role;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
