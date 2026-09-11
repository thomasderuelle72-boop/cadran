-- CreateEnum
CREATE TYPE "PeriodSource" AS ENUM ('MANUEL', 'FEC');

-- AlterTable
ALTER TABLE "AccountingPeriod" ADD COLUMN     "source" "PeriodSource" NOT NULL DEFAULT 'MANUEL';

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "headcount" INTEGER,
ADD COLUMN     "nafCode" TEXT;

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "journalCode" TEXT NOT NULL,
    "journalLabel" TEXT NOT NULL,
    "entryNum" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "auxAccountCode" TEXT,
    "auxAccountLabel" TEXT,
    "pieceRef" TEXT,
    "pieceDate" TIMESTAMP(3),
    "label" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL,
    "credit" DECIMAL(14,2) NOT NULL,
    "lettering" TEXT,
    "letteringDate" TIMESTAMP(3),
    "validDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_entityId_fiscalYear_idx" ON "LedgerEntry"("entityId", "fiscalYear");

-- CreateIndex
CREATE INDEX "LedgerEntry_entityId_entryDate_idx" ON "LedgerEntry"("entityId", "entryDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_entityId_accountCode_idx" ON "LedgerEntry"("entityId", "accountCode");

-- CreateIndex
CREATE INDEX "LedgerEntry_entityId_auxAccountCode_idx" ON "LedgerEntry"("entityId", "auxAccountCode");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

