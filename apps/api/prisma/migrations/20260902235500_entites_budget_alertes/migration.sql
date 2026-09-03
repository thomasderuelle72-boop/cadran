-- CreateEnum
CREATE TYPE "AlertOperator" AS ENUM ('LT', 'LTE', 'GT', 'GTE');

-- DropForeignKey
ALTER TABLE "AccountingPeriod" DROP CONSTRAINT "AccountingPeriod_organizationId_fkey";

-- DropIndex
DROP INDEX "AccountingPeriod_organizationId_label_key";

-- DropIndex
DROP INDEX "AccountingPeriod_organizationId_startDate_idx";

-- AlterTable
ALTER TABLE "AccountingPeriod" DROP COLUMN "organizationId",
ADD COLUMN     "entityId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "fxRateToOrgCurrency" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "poste" "LinePoste" NOT NULL,
    "amountBudgeted" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ratioId" TEXT NOT NULL,
    "operator" "AlertOperator" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entity_organizationId_name_key" ON "Entity"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_periodId_poste_key" ON "BudgetLine"("periodId", "poste");

-- CreateIndex
CREATE INDEX "AlertRule_organizationId_active_idx" ON "AlertRule"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_alertRuleId_periodId_key" ON "AlertEvent"("alertRuleId", "periodId");

-- CreateIndex
CREATE INDEX "AccountingPeriod_entityId_startDate_idx" ON "AccountingPeriod"("entityId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_entityId_label_key" ON "AccountingPeriod"("entityId", "label");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

