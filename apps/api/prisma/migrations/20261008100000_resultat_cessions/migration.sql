-- Résultat de cession d'actifs : isolé de l'EBITDA et de la CAF.
-- La réforme du PCG (ANC 2022-06) fait passer les cessions de l'exceptionnel
-- à l'exploitation ; sans poste à elles, elles gonflaient l'EBITDA dès 2025.
ALTER TYPE "LinePoste" ADD VALUE IF NOT EXISTS 'RESULTAT_CESSIONS';
