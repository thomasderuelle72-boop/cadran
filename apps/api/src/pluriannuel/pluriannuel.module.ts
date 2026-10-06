import { Module } from "@nestjs/common";
import { PluriannuelController } from "./pluriannuel.controller";
import { PluriannuelService } from "./pluriannuel.service";
import { EntitiesModule } from "../entities/entities.module";

@Module({
  imports: [EntitiesModule],
  controllers: [PluriannuelController],
  providers: [PluriannuelService],
})
export class PluriannuelModule {}
