import { Module } from "@nestjs/common";
import { PortefeuilleController } from "./portefeuille.controller";
import { PortefeuilleService } from "./portefeuille.service";

@Module({
  controllers: [PortefeuilleController],
  providers: [PortefeuilleService],
})
export class PortefeuilleModule {}
