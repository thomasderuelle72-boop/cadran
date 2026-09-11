import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Role } from "@prisma/client";
import { FecService } from "./fec.service";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

/**
 * Un FEC d'exercice complet pèse couramment quelques dizaines de mégaoctets.
 * La limite protège le serveur sans gêner un usage normal ; au-delà, c'est
 * qu'on essaie d'importer autre chose qu'un FEC.
 */
const TAILLE_MAX_OCTETS = 64 * 1024 * 1024;

/** Forme minimale du fichier remonté par multer, sans dépendre de ses types. */
interface FichierTeleverse {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/**
 * Les FEC produits par les logiciels français sont majoritairement en
 * ISO-8859-1 ; l'UTF-8 se répand. On décode en UTF-8 et on ne retombe sur le
 * latin que si le résultat contient le caractère de remplacement, signe sûr
 * que le fichier n'était pas de l'UTF-8.
 */
function decoder(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  return utf8.includes("�") ? buffer.toString("latin1") : utf8;
}

@Controller("fec")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FecController {
  constructor(private fecService: FecService) {}

  @Get("exercices")
  listerExercices(@CurrentUser() user: AuthUser, @Query("entityId") entityId: string) {
    if (!entityId) throw new BadRequestException("entityId est requis.");
    return this.fecService.listerExercices(user.organizationId, entityId);
  }

  @Post("import/:entityId")
  @Roles(Role.ADMIN, Role.DAF, Role.CONTROLEUR)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: TAILLE_MAX_OCTETS } }))
  async importer(
    @CurrentUser() user: AuthUser,
    @Param("entityId") entityId: string,
    @UploadedFile() file?: FichierTeleverse
  ) {
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    return this.fecService.importer(user.organizationId, entityId, decoder(file.buffer));
  }
}
