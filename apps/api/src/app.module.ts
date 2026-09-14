import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { EntitiesModule } from "./entities/entities.module";
import { PeriodsModule } from "./periods/periods.module";
import { ImportModule } from "./import/import.module";
import { FecModule } from "./fec/fec.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { ActionsModule } from "./actions/actions.module";
import { RatiosModule } from "./ratios/ratios.module";
import { ReportsModule } from "./reports/reports.module";
import { ConsolidationModule } from "./consolidation/consolidation.module";
import { BudgetModule } from "./budget/budget.module";
import { AlertsModule } from "./alerts/alerts.module";
import { CashForecastModule } from "./cash-forecast/cash-forecast.module";
import { AuditModule } from "./audit/audit.module";
import { BillingModule } from "./billing/billing.module";
import { EmailModule } from "./email/email.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    /*
     * Limitation de débit, appliquée globalement.
     *
     * Deux fenêtres plutôt qu'une : la courte arrête une rafale, la longue
     * arrête le grignotage patient qui passerait sous la courte en espaçant
     * ses essais. Les points d'entrée sensibles (connexion, réinitialisation)
     * resserrent ces valeurs par un décorateur @Throttle.
     *
     * Le webhook Stripe est exclu : c'est Stripe qui appelle, depuis un
     * nombre réduit d'adresses, et le faire limiter perdrait des événements
     * de paiement.
     */
    ThrottlerModule.forRoot([
      { name: "court", ttl: 60_000, limit: 120 },
      { name: "long", ttl: 3_600_000, limit: 2_000 },
    ]),
    EmailModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    EntitiesModule,
    RatiosModule,
    PeriodsModule,
    ImportModule,
    FecModule,
    AnalysisModule,
    ActionsModule,
    ReportsModule,
    ConsolidationModule,
    BudgetModule,
    AlertsModule,
    CashForecastModule,
    AuditModule,
    BillingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
