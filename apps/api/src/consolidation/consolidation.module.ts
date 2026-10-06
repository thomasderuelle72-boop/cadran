import { Module } from "@nestjs/common";
import { ConsolidationController } from "./consolidation.controller";
import { ConsolidationService } from "./consolidation.service";
import { RatiosModule } from "../ratios/ratios.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [RatiosModule, BillingModule],
  controllers: [ConsolidationController],
  providers: [ConsolidationService],
})
export class ConsolidationModule {}
