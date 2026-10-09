-- Valeur créée : correction manuelle du gain, et exclusion d'une action du bilan.
ALTER TABLE "ActionPlan" ADD COLUMN "gainRetenu" DECIMAL(14,2);
ALTER TABLE "ActionPlan" ADD COLUMN "exclureDeLaValeur" BOOLEAN NOT NULL DEFAULT false;
