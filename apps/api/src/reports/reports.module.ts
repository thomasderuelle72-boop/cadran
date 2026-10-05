import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { RatiosModule } from "../ratios/ratios.module";
import { MarqueModule } from "../marque/marque.module";

@Module({
  imports: [RatiosModule, MarqueModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
