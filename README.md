# Cadran — MVP

Plateforme de pilotage financier pour l'entreprise : import de données comptables, calcul automatique de 19 ratios financiers, tableau de bord, et export PDF. Voir le [cahier des charges complet](../) pour la vision produit et la roadmap.

Ce dossier contient le début d'implémentation du **MVP** défini dans la roadmap :
import Excel/CSV, catalogue de ratios essentiels, tableau de bord mono-entité, reporting PDF, gestion basique des utilisateurs et des droits.

## Stack

- **apps/api** — NestJS + Prisma + PostgreSQL, JWT + RBAC (ADMIN/DAF/CONTROLEUR/LECTEUR), moteur de calcul des ratios, génération de rapports PDF (pdfkit).
- **apps/web** — React + Vite + TypeScript + Tailwind, TanStack Query, Recharts, import CSV/Excel côté client (papaparse / xlsx) avec classification PCG assistée.

## Démarrer en local

Prérequis : Node 20+, PostgreSQL 16 (ou Docker).

```bash
# 1. Base de données (via Docker)
docker compose up -d

# 2. Dépendances
npm install

# 3. Configuration
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Schéma + données de démonstration
npm run prisma:migrate --workspace=apps/api
npm run prisma:seed --workspace=apps/api

# 5. Lancer l'API (http://localhost:3001/api) et le frontend (http://localhost:5173)
npm run dev:api
npm run dev:web
```

Compte de démonstration créé par le seed : `demo@cadran.fr` / `CadranDemo123!` (organisation « Atelier Nova SAS », 3 trimestres de données).

Si PostgreSQL tourne déjà en local (hors Docker), adaptez simplement `DATABASE_URL` dans `apps/api/.env`.

## Ce qui est implémenté (MVP)

- **Authentification & rôles** — inscription (crée une organisation + un compte ADMIN), connexion JWT, 4 rôles (ADMIN, DAF, CONTROLEUR, LECTEUR).
- **Import de données** — upload CSV/Excel, mapping des colonnes, classification automatique par préfixe du plan comptable général (éditable avant validation), import en masse déclenchant le recalcul des ratios.
- **Moteur de ratios** — 19 ratios (rentabilité, liquidité, solvabilité, activité) calculés à partir des postes normalisés, avec seuils d'alerte (bon / attention / critique) ; voir `apps/api/src/ratios/engine.ts` et ses tests unitaires.
- **Tableau de bord** — KPI de synthèse, tendance CA/EBITDA multi-périodes, ratios par catégorie.
- **Rapports** — génération et téléchargement d'un PDF de synthèse par période.
- **Utilisateurs** — liste et création d'utilisateurs par un administrateur.

## Ce qui reste hors MVP (voir roadmap V1/V2)

Connecteurs ERP/bancaires automatiques, consolidation multi-entités, budget prévisionnel, alertes temps réel, IA prédictive, benchmark sectoriel — ces modules sont décrits dans le cahier des charges mais nécessitent des comptes/API tiers non disponibles dans cet environnement de développement.

## Tests

```bash
npm run test:api
```

Couvre le moteur de calcul des ratios (agrégats, EBITDA/EBIT/résultat net, FR/BFR/trésorerie nette, statuts de seuil, croissance vs période précédente).
