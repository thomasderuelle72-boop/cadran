import { Module } from "@nestjs/common";
import { PeriodsController } from "./periods.controller";
import { PeriodsService } from "./periods.service";
import { RatiosModule } from "../ratios/ratios.module";
import { EntitiesModule } from "../entities/entities.module";
import { AlertsModule } from "../alerts/alerts.module";

@Module({
  imports: [RatiosModule, EntitiesModule, AlertsModule],
  controllers: [PeriodsController],
  providers: [PeriodsService],
})
export class PeriodsModule {}
