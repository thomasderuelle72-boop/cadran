# Cadran — MVP + V1

Plateforme de pilotage financier pour l'entreprise : import de données comptables, calcul automatique de 19 ratios financiers, tableau de bord, budget vs réalisé, alertes, consolidation multi-entités et export PDF/Excel. Voir le [cahier des charges complet](../) pour la vision produit et la roadmap.

## Stack

- **apps/api** — NestJS + Prisma + PostgreSQL, JWT + RBAC (ADMIN/DAF/CONTROLEUR/LECTEUR), import FEC, moteurs de calcul (ratios, soldes intermédiaires, flux de trésorerie, encours, projection), génération de rapports PDF (pdfkit) et Excel (exceljs).
- **apps/web** — React + Vite + TypeScript + Tailwind, TanStack Query, Recharts, import CSV/Excel côté client (papaparse / xlsx) avec classification PCG assistée.

## Démarrer en local

Prérequis : Node 20+, et PostgreSQL 16 — soit déjà installé, soit via Docker.

```bash
cd cadran
./demarrer.sh
```

Le script vérifie la version de Node, démarre PostgreSQL par Docker s'il n'est pas déjà joignable, génère un `JWT_SECRET` fort, installe les dépendances, applique les migrations, charge le jeu de démonstration puis lance l'API et le frontend. Il est réexécutable : le seed est idempotent et les fichiers `.env` existants ne sont pas écrasés. `Ctrl+C` arrête les deux serveurs.

Ouvrez ensuite <http://localhost:5173> et connectez-vous avec `demo@cadran.fr` / `CadranDemo123!` — organisation « Atelier Nova Group » avec deux entités (Atelier Nova SAS en France/EUR, Atelier Nova GmbH en Allemagne/USD), cinq périodes importées, un budget T3 sur la SAS, une projection de trésorerie et deux règles d'alerte préconfigurées.

<details>
<summary>Les mêmes étapes à la main</summary>

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

</details>

Si PostgreSQL tourne déjà en local sur un autre port, adaptez `DATABASE_URL` dans `apps/api/.env` : le script lit l'hôte et le port depuis ce fichier avant de tenter Docker.

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
- **Piste d'audit** — chaque opération modifiant des données est enregistrée (auteur, rôle, route, cible, horodatage) par un interceptor global, donc sans risque d'oubli quand un module est ajouté. Les secrets sont expurgés et les imports volumineux réduits à leur volume. Consultable par les rôles ADMIN et DAF depuis Paramètres, en écriture seule : aucun code applicatif ne modifie ni ne supprime une entrée.
- **Contrôle d'équilibre du bilan** — l'écart actif/passif est signalé pendant la revue de l'import, quand la classification est encore corrigeable en un clic, et rappelé sur le tableau de bord tant qu'une période reste déséquilibrée.

### Analyse détaillée

- **Import FEC** — le Fichier des Écritures Comptables (arrêté du 29 juillet 2013) est le format normé que tout logiciel comptable français exporte. Ses 18 colonnes étant fixées, l'import ne demande aucune correspondance à établir : un fichier suffit pour un exercice entier. Le parseur accepte les trois séparateurs rencontrés en pratique (pipe, tabulation, point-virgule), un ordre de colonnes libre, la variante `Montant` + `Sens`, le BOM et les fins de ligne Windows ; les lignes fautives sont écartées une par une avec leur numéro plutôt que de faire échouer le fichier. Un réimport remplace l'exercice concerné et lui seul.
- **Mensualisation** — les périodes sont dérivées des dates d'écriture. Un poste de résultat y est un flux du mois, un poste de bilan un stock cumulé depuis l'ouverture ; le résultat de l'exercice couru est porté aux capitaux propres, faute de quoi aucun bilan mensuel ne peut s'équilibrer puisque le compte 120 reste vide en cours d'exercice.
- **Soldes intermédiaires de gestion et CAF** — la cascade du plan comptable (valeur ajoutée, EBE, résultat d'exploitation, RCAI, résultat net, capacité d'autofinancement), avec le partage de la valeur ajoutée entre salariés, État, prêteurs et entreprise. Les soldes se raccordent exactement au moteur de ratios, ce que les tests vérifient : un même chiffre ne peut pas différer d'un écran à l'autre.
- **Tableau de flux de trésorerie** — méthode indirecte, en trois flux (exploitation, investissement, financement). Ce n'est pas une estimation mais une identité comptable : sur deux bilans équilibrés, la somme des trois flux égale exactement la variation des disponibilités. L'écart de réconciliation, quand il n'est pas nul, dénonce un bilan qui ne boucle pas.
- **Balance âgée** — encours par tiers, ventilé par ancienneté, calculé sur les seules écritures non lettrées à partir de la date de pièce. L'âge moyen est pondéré par les montants, donc sans le biais de TVA dont souffre un DSO rapporté au chiffre d'affaires. Le délai de paiement est paramétrable (30 jours par défaut, délai supplétif du code de commerce).
- **Concentration** — part de chaque tiers dans la facturation hors taxes et indice de Herfindahl. Le montant hors taxes est rattaché au tiers en rapprochant, au sein d'une même écriture, la ligne de compte auxiliaire et les lignes de produit — retenir le TTC de la ligne de tiers mélangerait la TVA au chiffre d'affaires. Une dépendance au-delà de 25 % est signalée pour ce qu'elle est : un risque de continuité d'exploitation.

## Essayer l'import FEC

```bash
npm run demo:fec   # (re)génère exemples/fec-demonstration.txt
```

Le fichier produit est un exercice complet et équilibré de 1 055 écritures, dont les douze bilans mensuels bouclent tous — le script échoue s'il en manque un. Créez une entité vierge depuis Paramètres, importez-le depuis la page Import, et les périodes mensuelles, les ratios, les soldes intermédiaires, le tableau de flux et la balance âgée se remplissent.

Le jeu de démonstration contient déjà une entité alimentée de cette façon, « Atelier Nova Industrie », à côté des deux entités dont les périodes sont des balances trimestrielles saisies.

## Vérifications automatiques

La CI (`.github/workflows/cadran-ci.yml`) lance sur chaque PR touchant `cadran/` : ESLint sur les deux applications, les tests unitaires des moteurs de calcul, puis les builds API et web (ce dernier incluant le typage TypeScript).

### Limites connues
- Le pré-remplissage de trésorerie répartit le rythme de la dernière période en flux mensuels : il ne modélise ni les délais d'encaissement (DSO) ni la TVA. C'est un point de départ à ajuster, pas une prévision.
- Le solde d'ouverture de la projection est celui des disponibilités de la dernière période importée ; entre deux clôtures, il faut l'ajuster par une ligne ponctuelle si la trésorerie réelle a bougé (pas encore de rapprochement bancaire).
- La valeur ajoutée est calculée sans isoler la production stockée et immobilisée (71, 72) ni les subventions d'exploitation (74), regroupées dans « autres produits et charges » et prises au niveau de l'excédent brut. L'écart est nul pour une entreprise de services ; le lever demande de scinder ce poste, ce que le détail d'un FEC permet.
- La CAF ne retire pas les plus et moins-values de cession (675 / 775), comprises dans le résultat exceptionnel et non séparables au niveau d'agrégat actuel : elle est juste à une cession près.
- Le positionnement sectoriel des ratios n'est pas encore branché ; le code NAF et l'effectif se saisissent sur l'entité, mais les seuils bon/attention/critique restent des constantes communes à tous les métiers.

## Ce qui reste hors périmètre (V2 et au-delà)

Connecteurs ERP/bancaires automatiques (Open Banking, Sage, Cegid…), SSO entreprise, IA prédictive, benchmark sectoriel, export PowerPoint — ces modules sont décrits dans le cahier des charges mais nécessitent des comptes/API tiers non disponibles dans cet environnement de développement.

## Tests

```bash
npm run test:api
```

104 tests couvrant le moteur de ratios (agrégats, EBITDA/EBIT/résultat net, FR/BFR/trésorerie nette, statuts de seuil, croissance, équilibre du bilan), le parseur FEC (séparateurs, ordre des colonnes, variante Montant + Sens, dates et montants, signalement ligne à ligne), la mensualisation (flux contre stock, sens naturel des comptes, résultat couru, exercice à cheval sur deux années), les soldes intermédiaires et la CAF (dont la concordance des méthodes additive et soustractive), le tableau de flux (réconciliation exacte avec la variation des disponibilités), la balance âgée et la concentration, le moteur de projection de trésorerie, et l'expurgation des secrets dans la piste d'audit.

Le lint s'exécute depuis la racine du projet :

```bash
npm run lint
```
