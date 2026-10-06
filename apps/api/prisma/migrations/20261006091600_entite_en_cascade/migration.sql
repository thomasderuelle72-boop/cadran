-- La dernière relation restée en Restrict : sans elle, supprimer une
-- organisation échouait dès qu'elle portait une entité.
-- DropForeignKey
ALTER TABLE "Entity" DROP CONSTRAINT "Entity_organizationId_fkey";

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
