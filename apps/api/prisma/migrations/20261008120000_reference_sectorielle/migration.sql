-- Quartiles sectoriels d'une source publique, importés par la console
-- d'administration. Table vide à la création : aucune donnée n'est livrée.
CREATE TABLE "ReferenceSectorielle" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "millesime" INTEGER NOT NULL,
    "miseAJour" TIMESTAMP(3) NOT NULL,
    "codeSecteur" TEXT NOT NULL,
    "libelleSecteur" TEXT NOT NULL,
    "ratioId" TEXT NOT NULL,
    "q1" DOUBLE PRECISION NOT NULL,
    "q2" DOUBLE PRECISION NOT NULL,
    "q3" DOUBLE PRECISION NOT NULL,
    "nombreEntreprises" INTEGER,
    "importeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceSectorielle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferenceSectorielle_source_millesime_codeSecteur_ratioId_key"
    ON "ReferenceSectorielle"("source", "millesime", "codeSecteur", "ratioId");

CREATE INDEX "ReferenceSectorielle_source_codeSecteur_idx"
    ON "ReferenceSectorielle"("source", "codeSecteur");
