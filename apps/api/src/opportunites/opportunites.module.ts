import { Module } from "@nestjs/common";
import { OpportunitesController } from "./opportunites.controller";
import { OpportunitesService } from "./opportunites.service";

@Module({
  controllers: [OpportunitesController],
  providers: [OpportunitesService],
})
export class OpportunitesModule {}
