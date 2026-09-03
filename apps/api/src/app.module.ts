import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { EntitiesModule } from "./entities/entities.module";
import { PeriodsModule } from "./periods/periods.module";
import { ImportModule } from "./import/import.module";
import { RatiosModule } from "./ratios/ratios.module";
import { ReportsModule } from "./reports/reports.module";
import { ConsolidationModule } from "./consolidation/consolidation.module";
import { BudgetModule } from "./budget/budget.module";
import { AlertsModule } from "./alerts/alerts.module";
import { CashForecastModule } from "./cash-forecast/cash-forecast.module";
import { AuditModule } from "./audit/audit.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EntitiesModule,
    RatiosModule,
    PeriodsModule,
    ImportModule,
    ReportsModule,
    ConsolidationModule,
    BudgetModule,
    AlertsModule,
    CashForecastModule,
    AuditModule,
  ],
})
export class AppModule {}
