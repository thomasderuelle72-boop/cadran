import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { Role } from "@prisma/client";
import { MarqueService, type Emplacement } from "./marque.service";
import { POIDS_MAX } from "./image";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { RolesGuard } from "../common/roles.guard";
import { Roles } from "../common/roles.decorator";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";

/** Forme minimale du fichier remonté par multer, sans dépendre de ses types. */
interface FichierTeleverse {
  buffer: Buffer;
  size: number;
}

const EMPLACEMENTS: Emplacement[] = ["logo", "signature"];

@Controller("marque")
@UseGuards(JwtAuthGuard)
export class MarqueController {
  constructor(private marque: MarqueService) {}

  /** Lisible par tous : un collaborateur a le droit de savoir sous quelle
   *  identité partent les documents qu'il produit. */
  @Get()
  lire(@CurrentUser() user: AuthUser) {
    return this.marque.lire(user.organizationId, user.administrateurPlateforme);
  }

  /**
   * Les octets d'une image, pour l'aperçu.
   *
   * L'adresse ne porte aucun identifiant : c'est la session qui désigne
   * l'organisation, si bien qu'un lien copié hors du navigateur ne donne
   * accès à rien. `no-store` l'empêche d'être conservé par un proxy ou par le
   * cache disque du navigateur, où il survivrait à la déconnexion.
   */
  @Get(":emplacement")
  @Header("Cache-Control", "private, no-store")
  async image(
    @CurrentUser() user: AuthUser,
    @Param("emplacement") emplacement: string,
    @Res() reponse: Response
  ) {
    const { octets, format } = await this.marque.image(
      user.organizationId,
      lireEmplacement(emplacement)
    );
    reponse.type(format).send(octets);
  }

  /** Modifiable par les seuls administrateurs : la marque engage le cabinet
   *  auprès de ses propres clients. */
  @Put()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  enregistrer(
    @CurrentUser() user: AuthUser,
    @Body()
    corps: {
      nomAffiche?: string | null;
      mentionsPied?: string | null;
      couleurAccent?: string | null;
      signataireNom?: string | null;
      signataireFonction?: string | null;
    }
  ) {
    return this.marque.enregistrer(user.organizationId, corps, user.administrateurPlateforme);
  }

  /**
   * Téléversement d'un logo ou d'une signature.
   *
   * La limite de multer coupe la lecture au-delà du poids admis : sans
   * elle, le serveur garderait en mémoire tout ce qu'on lui envoie avant
   * même de pouvoir le refuser. Le contrôle de format et de dimensions se
   * fait ensuite sur les octets — jamais sur le type déclaré.
   */
  @Post(":emplacement")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor("fichier", { limits: { fileSize: POIDS_MAX } }))
  televerser(
    @CurrentUser() user: AuthUser,
    @Param("emplacement") emplacement: string,
    @UploadedFile() fichier?: FichierTeleverse
  ) {
    if (!fichier?.buffer) {
      throw new BadRequestException("Aucun fichier reçu : le champ doit s'appeler « fichier ».");
    }
    return this.marque.televerser(
      user.organizationId,
      lireEmplacement(emplacement),
      fichier.buffer,
      user.administrateurPlateforme
    );
  }

  @Delete(":emplacement")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  retirer(@CurrentUser() user: AuthUser, @Param("emplacement") emplacement: string) {
    return this.marque.retirer(
      user.organizationId,
      lireEmplacement(emplacement),
      user.administrateurPlateforme
    );
  }
}

function lireEmplacement(valeur: string): Emplacement {
  if ((EMPLACEMENTS as string[]).includes(valeur)) return valeur as Emplacement;
  throw new BadRequestException(`Emplacement inconnu. Valeurs admises : ${EMPLACEMENTS.join(", ")}.`);
}
