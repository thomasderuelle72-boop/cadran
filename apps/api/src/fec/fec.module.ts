import { Module } from "@nestjs/common";
import { FecController } from "./fec.controller";
import { FecService } from "./fec.service";
import { EntitiesModule } from "../entities/entities.module";
import { RatiosModule } from "../ratios/ratios.module";
import { AlertsModule } from "../alerts/alerts.module";

@Module({
  imports: [EntitiesModule, RatiosModule, AlertsModule],
  controllers: [FecController],
  providers: [FecService],
  exports: [FecService],
})
export class FecModule {}
