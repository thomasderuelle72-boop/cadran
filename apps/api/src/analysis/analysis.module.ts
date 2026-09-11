import { Module } from "@nestjs/common";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { EntitiesModule } from "../entities/entities.module";
import { RatiosModule } from "../ratios/ratios.module";

@Module({
  imports: [EntitiesModule, RatiosModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
