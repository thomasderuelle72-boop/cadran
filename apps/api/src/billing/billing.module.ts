import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, StripeService],
  // Exporté : les modules qui créent des entités ou des utilisateurs doivent
  // pouvoir vérifier le quota avant d'écrire.
  exports: [BillingService],
})
export class BillingModule {}
