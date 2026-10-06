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
    if (request.method === "OPTIONS") return next.handle();

    /*
     * Les lectures ne sont journalisées que pendant un accès support.
     *
     * Journaliser toutes les lectures ferait grossir la table d'un ordre de
     * grandeur pour une valeur nulle : un utilisateur qui consulte ses
     * propres chiffres n'est pas un événement. Un exploitant qui consulte
     * ceux d'un client en est un — c'est même ce que le client est en droit
     * de pouvoir vérifier. D'où l'asymétrie.
     */
    if (request.method === "GET" && !request.user?.support) return next.handle();

    return next.handle().pipe(
      tap({
        next: (result) => {
          const entry = this.buildEntry(context, request, result);
          if (entry) void this.auditService.record(entry);
        },
        /*
         * Les refus comptent autant que les succès.
         *
         * Une piste d'audit qui n'enregistre que ce qui a marché ne montre
         * pas une tentative d'accès à un dossier voisin, ni une rafale de
         * suppressions refusées — c'est-à-dire précisément ce qu'on vient y
         * chercher après un incident.
         */
        error: (erreur: { status?: number }) => {
          const entry = this.buildEntry(context, request, undefined, erreur?.status ?? 500);
          if (entry) void this.auditService.record(entry);
        },
      })
    );
  }

  private buildEntry(
    context: ExecutionContext,
    request: AuthenticatedRequest,
    result: unknown,
    statutErreur?: number
  ): AuditEntryInput | null {
    // L'inscription et la connexion n'ont pas encore d'utilisateur attaché à
    // la requête : l'identité vient alors de la réponse.
    const responseUser = (result as { user?: ResponseUser } | undefined)?.user;
    const organizationId = request.user?.organizationId ?? responseUser?.organizationId;
    if (!organizationId) return null;

    /*
     * Express 5 autorise un paramètre de route à valoir un tableau — un
     * segment générique répété en produit un. Aucune de nos routes n'est dans
     * ce cas, mais écrire un tableau dans la colonne `targetId` y mettrait
     * « id1,id2 », qui ne correspond à rien de consultable. On ne retient donc
     * que la première valeur, et on le dit.
     */
    const params = premiereValeur(request.params);
    const routePath = (request.route as { path?: string } | undefined)?.path ?? request.originalUrl;

    return {
      organizationId,
      userId: request.user?.userId ?? responseUser?.id ?? null,
      userEmail: request.user?.email ?? responseUser?.email ?? "inconnu",
      userRole: request.user?.role ?? responseUser?.role ?? null,
      /*
       * L'accès support est marqué dans l'action elle-même, pas seulement
       * dans les métadonnées : c'est la colonne que le client lit sur son
       * propre écran, et une prise en charge par l'éditeur doit s'y voir sans
       * qu'il ait à déplier quoi que ce soit.
       */
      action: `${request.user?.support ? "SUPPORT " : ""}${request.method} ${routePath}`,
      method: request.method,
      path: request.originalUrl,
      statusCode:
        statutErreur ??
        context.switchToHttp().getResponse<{ statusCode?: number }>()?.statusCode ??
        200,
      targetId: params.id ?? params.periodId ?? params.entityId ?? params.lineId ?? null,
      metadata: {
        params: summarizePayload(params),
        body: summarizePayload(request.body ?? {}),
        ...(request.user?.support ? { support: true } : {}),
      } as Prisma.InputJsonValue,
    };
  }
}

/**
 * Ramène les paramètres de route à une valeur simple par clé.
 *
 * Isolée et exportée pour être vérifiable : c'est la seule fonction du
 * fichier qui transforme une donnée venue de la requête, et une erreur ici
 * écrirait un identifiant faux dans la piste d'audit — c'est-à-dire la
 * désignerait, à la relecture d'un incident, comme la preuve d'une action qui
 * n'a pas eu lieu.
 */
export function premiereValeur(
  params: Record<string, string | string[]> | undefined
): Record<string, string> {
  const simples: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(params ?? {})) {
    if (Array.isArray(valeur)) {
      if (valeur.length > 0) simples[cle] = valeur[0];
    } else {
      simples[cle] = valeur;
    }
  }
  return simples;
}
