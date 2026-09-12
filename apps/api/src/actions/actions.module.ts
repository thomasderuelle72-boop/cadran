import { Module } from "@nestjs/common";
import { ActionsController } from "./actions.controller";
import { ActionsService } from "./actions.service";
import { EntitiesModule } from "../entities/entities.module";
import { RatiosModule } from "../ratios/ratios.module";

@Module({
  imports: [EntitiesModule, RatiosModule],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
