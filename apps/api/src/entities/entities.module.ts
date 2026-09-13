import { Module } from "@nestjs/common";
import { EntitiesController } from "./entities.controller";
import { EntitiesService } from "./entities.service";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [BillingModule],
  controllers: [EntitiesController],
  providers: [EntitiesService],
  exports: [EntitiesService],
})
export class EntitiesModule {}
