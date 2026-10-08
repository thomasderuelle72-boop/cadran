import { IsString, MaxLength } from "class-validator";

export class SupprimerEntityDto {
  /** Le nom exact du dossier, recopié par l'utilisateur : voir entities.service.ts. */
  @IsString()
  @MaxLength(200)
  nom!: string;
}
