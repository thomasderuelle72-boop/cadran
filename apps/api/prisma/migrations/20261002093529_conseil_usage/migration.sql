-- CreateTable
CREATE TABLE "ConseilUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mois" TEXT NOT NULL,
    "questions" INTEGER NOT NULL DEFAULT 0,
    "jetonsEntree" INTEGER NOT NULL DEFAULT 0,
    "jetonsSortie" INTEGER NOT NULL DEFAULT 0,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConseilUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConseilUsage_organizationId_mois_key" ON "ConseilUsage"("organizationId", "mois");

-- AddForeignKey
ALTER TABLE "ConseilUsage" ADD CONSTRAINT "ConseilUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
