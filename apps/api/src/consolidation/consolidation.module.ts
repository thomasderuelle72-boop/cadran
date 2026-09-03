import { Module } from "@nestjs/common";
import { ConsolidationController } from "./consolidation.controller";
import { ConsolidationService } from "./consolidation.service";
import { RatiosModule } from "../ratios/ratios.module";

@Module({
  imports: [RatiosModule],
  controllers: [ConsolidationController],
  providers: [ConsolidationService],
})
export class ConsolidationModule {}
