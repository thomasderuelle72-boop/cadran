import { Module } from "@nestjs/common";
import { BudgetController } from "./budget.controller";
import { BudgetService } from "./budget.service";
import { RatiosModule } from "../ratios/ratios.module";

@Module({
  imports: [RatiosModule],
  controllers: [BudgetController],
  providers: [BudgetService],
})
export class BudgetModule {}
