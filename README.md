# Cadran — MVP + V1

Plateforme de pilotage financier pour l'entreprise : import de données comptables, calcul automatique de 19 ratios financiers, tableau de bord, budget vs réalisé, alertes, consolidation multi-entités et export PDF/Excel. Voir le [cahier des charges complet](../) pour la vision produit et la roadmap.

## Stack

- **apps/api** — NestJS + Prisma + PostgreSQL, JWT + RBAC (ADMIN/DAF/CONTROLEUR/LECTEUR), moteur de calcul des ratios, génération de rapports PDF (pdfkit) et Excel (exceljs).
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

# JWT_SECRET est obligatoire (l'API refuse de démarrer sans un secret fort) :
openssl rand -base64 48   # copiez le résultat dans JWT_SECRET= (apps/api/.env)

# 4. Schéma + données de démonstration
npm run prisma:migrate --workspace=apps/api
npm run prisma:seed --workspace=apps/api

# 5. Lancer l'API (http://localhost:3001/api) et le frontend (http://localhost:5173)
npm run dev:api
npm run dev:web
```

Compte de démonstration créé par le seed : `demo@cadran.fr` / `CadranDemo123!` — organisation « Atelier Nova Group » avec deux entités (Atelier Nova SAS en France/EUR, Atelier Nova GmbH en Allemagne/USD), un budget T3 sur la SAS, et deux règles d'alerte préconfigurées.

Si PostgreSQL tourne déjà en local (hors Docker), adaptez simplement `DATABASE_URL` dans `apps/api/.env`.

## Ce qui est implémenté

### MVP
- **Authentification & rôles** — inscription (crée une organisation + un compte ADMIN), connexion JWT, 4 rôles (ADMIN, DAF, CONTROLEUR, LECTEUR).
- **Import de données** — upload CSV/Excel, mapping des colonnes, classification automatique par préfixe du plan comptable général (éditable avant validation), import en masse déclenchant le recalcul des ratios.
- **Moteur de ratios** — 19 ratios (rentabilité, liquidité, solvabilité, activité) calculés à partir des postes normalisés, avec seuils d'alerte (bon / attention / critique) ; voir `apps/api/src/ratios/engine.ts` et ses tests unitaires.
- **Tableau de bord** — KPI de synthèse, tendance CA/EBITDA multi-périodes, ratios par catégorie.
- **Rapports** — génération et téléchargement d'un PDF de synthèse par période.
- **Utilisateurs** — liste et création d'utilisateurs par un administrateur.

### V1
- **Multi-entités** — une organisation regroupe plusieurs entités juridiques (filiales), chacune avec sa devise et ses propres périodes ; gestion depuis Paramètres.
- **Consolidation groupe** — les périodes de même plage de dates sont regroupées entre entités, avec conversion de change (taux saisi manuellement par entité) et recalcul des mêmes ratios sur les montants consolidés.
- **Budget vs réalisé** — saisie d'un budget par poste et par période, écarts calculés automatiquement (montant et %), avec code couleur adapté au sens du poste (charge vs produit).
- **Alertes sur seuils** — règles configurables sur n'importe quel ratio (`<`, `≤`, `>`, `≥`), réévaluées à chaque import, historique des événements déclenchés/acquittés.
- **Export Excel** — en plus du PDF, un classeur `.xlsx` (synthèse + détail des ratios) est généré par période.
- **Trésorerie prévisionnelle** — flux d'encaissement/décaissement (ponctuels ou récurrents), projection glissante du solde semaine par semaine sur 13/26/52 semaines à partir des disponibilités de la dernière période, point bas et semaines en tension ; pré-remplissage possible à partir du rythme de la dernière période importée. Voir `apps/api/src/cash-forecast/engine.ts` et ses tests.
- **Croissance à périmètre constant** — en vue consolidée, la croissance du CA ne compare que les entités présentes sur les deux périodes, et le périmètre retenu est affiché sous le tableau de bord.

### Limites connues
- Le pré-remplissage de trésorerie répartit le rythme de la dernière période en flux mensuels : il ne modélise ni les délais d'encaissement (DSO) ni la TVA. C'est un point de départ à ajuster, pas une prévision.
- Le solde d'ouverture de la projection est celui des disponibilités de la dernière période importée ; entre deux clôtures, il faut l'ajuster par une ligne ponctuelle si la trésorerie réelle a bougé (pas encore de rapprochement bancaire).

## Ce qui reste hors périmètre (V2 et au-delà)

Connecteurs ERP/bancaires automatiques (Open Banking, Sage, Cegid…), SSO entreprise, IA prédictive, benchmark sectoriel, export PowerPoint — ces modules sont décrits dans le cahier des charges mais nécessitent des comptes/API tiers non disponibles dans cet environnement de développement.

## Tests

```bash
npm run test:api
```

Couvre le moteur de calcul des ratios (agrégats, EBITDA/EBIT/résultat net, FR/BFR/trésorerie nette, statuts de seuil, croissance vs période précédente) et le moteur de projection de trésorerie (découpage hebdomadaire, récurrences mensuelles avec fins de mois, point bas, statuts).
