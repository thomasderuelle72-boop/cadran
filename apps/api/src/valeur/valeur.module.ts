import { Module } from "@nestjs/common";
import { RatiosModule } from "../ratios/ratios.module";
import { ValeurController } from "./valeur.controller";
import { ValeurService } from "./valeur.service";

@Module({
  imports: [RatiosModule],
  controllers: [ValeurController],
  providers: [ValeurService],
})
export class ValeurModule {}
