-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DAF', 'CONTROLEUR', 'LECTEUR');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OUVERTE', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "LinePoste" AS ENUM ('CHIFFRE_AFFAIRES', 'ACHATS_CONSOMMES', 'CHARGES_EXTERNES', 'CHARGES_PERSONNEL', 'IMPOTS_TAXES', 'DOTATIONS_AMORTISSEMENTS', 'AUTRES_PRODUITS_CHARGES_EXPLOITATION', 'CHARGES_FINANCIERES', 'PRODUITS_FINANCIERS', 'RESULTAT_EXCEPTIONNEL', 'IMPOT_SOCIETES', 'STOCKS', 'CREANCES_CLIENTS', 'AUTRES_CREANCES', 'DISPONIBILITES', 'CAPITAUX_PROPRES', 'DETTES_FINANCIERES', 'DETTES_FOURNISSEURS', 'AUTRES_DETTES', 'IMMOBILISATIONS');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'LECTEUR',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OUVERTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLineItem" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "poste" "LinePoste" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatioResult" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "aggregates" JSONB NOT NULL,
    "derived" JSONB NOT NULL,
    "ratios" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatioResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AccountingPeriod_organizationId_startDate_idx" ON "AccountingPeriod"("organizationId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_organizationId_label_key" ON "AccountingPeriod"("organizationId", "label");

-- CreateIndex
CREATE INDEX "FinancialLineItem_periodId_poste_idx" ON "FinancialLineItem"("periodId", "poste");

-- CreateIndex
CREATE UNIQUE INDEX "RatioResult_periodId_key" ON "RatioResult"("periodId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLineItem" ADD CONSTRAINT "FinancialLineItem_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatioResult" ADD CONSTRAINT "RatioResult_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
