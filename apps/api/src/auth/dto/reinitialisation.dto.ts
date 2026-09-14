import { IsEmail, IsString, MinLength } from "class-validator";

export class DemandeReinitialisationDto {
  @IsEmail({}, { message: "Adresse électronique invalide." })
  email!: string;
}

export class ReinitialisationDto {
  @IsString()
  @MinLength(10, { message: "Jeton invalide." })
  jeton!: string;

  /**
   * Même exigence qu'à l'inscription : une réinitialisation ne doit pas être
   * une porte dérobée pour poser un mot de passe plus faible que celui qu'on
   * aurait refusé à la création.
   */
  @IsString()
  @MinLength(8, { message: "Le mot de passe doit faire au moins 8 caractères." })
  motDePasse!: string;
}
