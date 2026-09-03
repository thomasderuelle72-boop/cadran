-- CreateEnum
CREATE TYPE "CashCategory" AS ENUM ('ENCAISSEMENTS_CLIENTS', 'DECAISSEMENTS_FOURNISSEURS', 'SALAIRES_ET_CHARGES_SOCIALES', 'IMPOTS_ET_TAXES', 'LOYERS_ET_CHARGES_EXTERNES', 'REMBOURSEMENT_EMPRUNT', 'INVESTISSEMENT', 'FINANCEMENT', 'AUTRE');

-- CreateEnum
CREATE TYPE "CashRecurrence" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "CashForecastLine" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "CashCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "recurrence" "CashRecurrence" NOT NULL DEFAULT 'NONE',
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashForecastLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashForecastLine_entityId_startDate_idx" ON "CashForecastLine"("entityId", "startDate");

-- AddForeignKey
ALTER TABLE "CashForecastLine" ADD CONSTRAINT "CashForecastLine_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

