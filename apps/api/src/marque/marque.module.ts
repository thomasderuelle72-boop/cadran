import { Module } from "@nestjs/common";
import { MarqueController } from "./marque.controller";
import { MarqueService } from "./marque.service";
import { PrismaModule } from "../prisma/prisma.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [MarqueController],
  providers: [MarqueService],
  // Exporté : le générateur de rapports en a besoin pour habiller les
  // documents qu'il produit.
  exports: [MarqueService],
})
export class MarqueModule {}
