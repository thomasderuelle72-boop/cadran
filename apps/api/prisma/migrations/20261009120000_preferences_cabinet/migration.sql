-- CreateTable
CREATE TABLE "PreferenceCabinet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" JSONB NOT NULL,
    "modifieLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceCabinet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceCabinet_organizationId_cle_key" ON "PreferenceCabinet"("organizationId", "cle");

-- AddForeignKey
ALTER TABLE "PreferenceCabinet" ADD CONSTRAINT "PreferenceCabinet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
