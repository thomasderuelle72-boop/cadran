import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { Prisma, Role } from "@prisma/client";
import { AuthenticatedRequest } from "../common/current-user.decorator";
import { AuditEntryInput, AuditService, summarizePayload } from "./audit.service";

interface ResponseUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
}

/**
 * Journalise toute requête qui modifie des données, une fois qu'elle a
 * réussi. Passer par un interceptor global plutôt que par des appels
 * dispersés dans chaque service garantit qu'aucune mutation n'échappe à la
 * piste d'audit, y compris celles ajoutées plus tard.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.method === "GET" || request.method === "OPTIONS") return next.handle();

    return next.handle().pipe(
      tap((result) => {
        const entry = this.buildEntry(context, request, result);
        if (entry) void this.auditService.record(entry);
      })
    );
  }

  private buildEntry(
    context: ExecutionContext,
    request: AuthenticatedRequest,
    result: unknown
  ): AuditEntryInput | null {
    // L'inscription et la connexion n'ont pas encore d'utilisateur attaché à
    // la requête : l'identité vient alors de la réponse.
    const responseUser = (result as { user?: ResponseUser } | undefined)?.user;
    const organizationId = request.user?.organizationId ?? responseUser?.organizationId;
    if (!organizationId) return null;

    const params: Record<string, string> = request.params ?? {};
    const routePath = (request.route as { path?: string } | undefined)?.path ?? request.originalUrl;

    return {
      organizationId,
      userId: request.user?.userId ?? responseUser?.id ?? null,
      userEmail: request.user?.email ?? responseUser?.email ?? "inconnu",
      userRole: request.user?.role ?? responseUser?.role ?? null,
      action: `${request.method} ${routePath}`,
      method: request.method,
      path: request.originalUrl,
      statusCode: context.switchToHttp().getResponse<{ statusCode?: number }>()?.statusCode ?? 200,
      targetId: params.id ?? params.periodId ?? params.entityId ?? params.lineId ?? null,
      metadata: {
        params: summarizePayload(params),
        body: summarizePayload(request.body ?? {}),
      } as Prisma.InputJsonValue,
    };
  }
}
