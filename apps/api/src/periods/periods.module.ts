import { Module } from "@nestjs/common";
import { PeriodsController } from "./periods.controller";
import { PeriodsService } from "./periods.service";
import { RatiosModule } from "../ratios/ratios.module";

@Module({
  imports: [RatiosModule],
  controllers: [PeriodsController],
  providers: [PeriodsService],
})
export class PeriodsModule {}
