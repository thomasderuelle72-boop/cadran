-- AlterTable
ALTER TABLE "User" ADD COLUMN     "administrateurPlateforme" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "derniereConnexion" TIMESTAMP(3),
ADD COLUMN     "sessionsValablesApres" TIMESTAMP(3);

