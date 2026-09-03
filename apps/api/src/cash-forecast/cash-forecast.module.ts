import { Module } from "@nestjs/common";
import { CashForecastController } from "./cash-forecast.controller";
import { CashForecastService } from "./cash-forecast.service";
import { EntitiesModule } from "../entities/entities.module";
import { RatiosModule } from "../ratios/ratios.module";

@Module({
  imports: [EntitiesModule, RatiosModule],
  controllers: [CashForecastController],
  providers: [CashForecastService],
})
export class CashForecastModule {}
