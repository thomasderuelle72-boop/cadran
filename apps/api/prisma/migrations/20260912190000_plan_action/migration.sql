-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('A_FAIRE', 'EN_COURS', 'FAITE', 'ABANDONNEE');

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityId" TEXT,
    "constat" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ratioId" TEXT,
    "valeurInitiale" DOUBLE PRECISION,
    "valeurCible" DOUBLE PRECISION,
    "impactEstime" DECIMAL(14,2),
    "responsable" TEXT,
    "echeance" TIMESTAMP(3),
    "statut" "ActionStatus" NOT NULL DEFAULT 'A_FAIRE',
    "auteurEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionPlan_organizationId_statut_idx" ON "ActionPlan"("organizationId", "statut");

-- CreateIndex
CREATE INDEX "ActionPlan_entityId_idx" ON "ActionPlan"("entityId");

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

