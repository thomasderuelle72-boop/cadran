import { Injectable, Logger } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntryInput {
  organizationId: string;
  userId: string | null;
  userEmail: string;
  userRole: Role | null;
  action: string;
  method: string;
  path: string;
  statusCode: number;
  targetId: string | null;
  metadata: Prisma.InputJsonValue | undefined;
}

const SECRET_KEY_PATTERN = /password|secret|token|hash/i;
const MAX_DEPTH = 2;

/**
 * Réduit un corps de requête à un résumé consignable : jamais de secret, et
 * jamais le contenu intégral d'un import de plusieurs milliers de lignes —
 * seulement son volume, qui est l'information utile pour un audit.
 */
export function summarizePayload(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return { nombre: value.length };
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const summary: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) continue;
      summary[key] = depth >= MAX_DEPTH ? "…" : summarizePayload(entry, depth + 1);
    }
    return summary;
  }
  if (typeof value === "string" && value.length > 200) return `${value.slice(0, 200)}…`;
  return value;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Une écriture d'audit ne doit jamais faire échouer l'opération métier qui
   * vient de réussir : l'erreur est journalisée, pas propagée.
   */
  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (error) {
      this.logger.error(`Écriture de la piste d'audit impossible (${entry.action})`, error as Error);
    }
  }

  async list(organizationId: string, limit: number, cursor?: string) {
    const entries = await this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = entries.length > limit;
    return { items: hasMore ? entries.slice(0, limit) : entries, nextCursor: hasMore ? entries[limit - 1].id : null };
  }
}
