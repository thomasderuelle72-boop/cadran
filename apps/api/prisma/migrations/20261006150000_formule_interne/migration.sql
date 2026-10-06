-- Formule interne : l'accès de l'exploitant ne dépend d'aucune formule vendue.
ALTER TYPE "PlanId" ADD VALUE IF NOT EXISTS 'interne';
