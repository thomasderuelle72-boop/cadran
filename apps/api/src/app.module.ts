import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { PeriodsModule } from "./periods/periods.module";
import { ImportModule } from "./import/import.module";
import { RatiosModule } from "./ratios/ratios.module";
import { ReportsModule } from "./reports/reports.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RatiosModule,
    PeriodsModule,
    ImportModule,
    ReportsModule,
  ],
})
export class AppModule {}
