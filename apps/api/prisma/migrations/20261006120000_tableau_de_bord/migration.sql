-- CreateTable
CREATE TABLE "TableauDeBord" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "blocs" JSONB NOT NULL,
    "hypotheses" JSONB,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableauDeBord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TableauDeBord_entityId_key" ON "TableauDeBord"("entityId");

-- AddForeignKey
ALTER TABLE "TableauDeBord" ADD CONSTRAINT "TableauDeBord_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

