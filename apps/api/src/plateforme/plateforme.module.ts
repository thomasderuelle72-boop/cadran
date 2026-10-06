import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PlateformeController } from "./plateforme.controller";
import { PlateformeService } from "./plateforme.service";
import { AmorcagePlateforme } from "./amorcage";
import { getJwtSecret } from "../auth/jwt-secret";

@Module({
  /* Le même secret que les sessions ordinaires : un accès support est une
   * session, pas un canal parallèle. Ce qui le distingue est dans sa charge
   * utile, vérifiée à chaque requête. */
  imports: [JwtModule.register({ secret: getJwtSecret() })],
  controllers: [PlateformeController],
  providers: [PlateformeService, AmorcagePlateforme],
})
export class PlateformeModule {}
