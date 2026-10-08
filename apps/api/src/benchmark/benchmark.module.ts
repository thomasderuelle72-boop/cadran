import { Module } from "@nestjs/common";
import { BenchmarkController } from "./benchmark.controller";
import { BenchmarkService } from "./benchmark.service";
import { EntitiesModule } from "../entities/entities.module";

@Module({
  imports: [EntitiesModule],
  controllers: [BenchmarkController],
  providers: [BenchmarkService],
  // Exporté pour la console d'administration, qui charge le référentiel.
  exports: [BenchmarkService],
})
export class BenchmarkModule {}
