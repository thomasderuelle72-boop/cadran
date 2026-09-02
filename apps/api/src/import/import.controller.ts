import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { LinePoste } from "@prisma/client";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { PCG_PREFIX_MAPPING, POSTE_LABELS, suggestPoste } from "./pcg-mapping";

@Controller("import")
@UseGuards(JwtAuthGuard)
export class ImportController {
  @Get("reference")
  reference() {
    return {
      postes: Object.values(LinePoste).map((poste) => ({ poste, label: POSTE_LABELS[poste] })),
      pcgMapping: PCG_PREFIX_MAPPING,
    };
  }

  @Get("suggest")
  suggest(@Query("accountCode") accountCode: string) {
    return { accountCode, suggestedPoste: suggestPoste(accountCode ?? "") };
  }
}
