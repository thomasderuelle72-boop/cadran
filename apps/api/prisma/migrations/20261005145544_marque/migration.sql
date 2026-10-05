-- CreateTable
CREATE TABLE "Marque" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nomAffiche" TEXT,
    "mentionsPied" TEXT,
    "couleurAccent" TEXT,
    "logo" BYTEA,
    "logoFormat" TEXT,
    "logoLargeur" INTEGER,
    "logoHauteur" INTEGER,
    "signataireNom" TEXT,
    "signataireFonction" TEXT,
    "signature" BYTEA,
    "signatureFormat" TEXT,
    "signatureLargeur" INTEGER,
    "signatureHauteur" INTEGER,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Marque_organizationId_key" ON "Marque"("organizationId");

-- AddForeignKey
ALTER TABLE "Marque" ADD CONSTRAINT "Marque_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
