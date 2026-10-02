import { Module } from "@nestjs/common";
import { ConseilController } from "./conseil.controller";
import { ConseilService } from "./conseil.service";
import { ExecuteurOutils } from "./executeur";
import { UsageConseilService } from "./usage.service";
import { AnalysisModule } from "../analysis/analysis.module";
import { RatiosModule } from "../ratios/ratios.module";
import { BillingModule } from "../billing/billing.module";

/*
 * Le conseiller n'a aucun moteur à lui : il emprunte ceux des modules
 * d'analyse et de ratios. C'est le but — une réponse ne peut pas diverger
 * d'un écran, puisqu'elle lit la même fonction.
 */
@Module({
  imports: [AnalysisModule, RatiosModule, BillingModule],
  controllers: [ConseilController],
  providers: [ConseilService, ExecuteurOutils, UsageConseilService],
})
export class ConseilModule {}
