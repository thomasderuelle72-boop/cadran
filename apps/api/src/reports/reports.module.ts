import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { RatiosModule } from "../ratios/ratios.module";

@Module({
  imports: [RatiosModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
