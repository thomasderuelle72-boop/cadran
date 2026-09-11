#!/usr/bin/env bash
#
# demarrer.sh — Lance Cadran en local, de zéro, en une commande.
#
# Le README détaille chaque étape ; ce script les enchaîne et vérifie les
# prérequis au passage, pour qu'une première installation ne demande pas de
# connaître Prisma ni la structure du monorepo.
#
#   ./demarrer.sh
#
set -euo pipefail
cd "$(dirname "$0")"

API_URL="http://localhost:3001/api"
WEB_URL="http://localhost:5173"

info()    { printf '\033[0;36m›\033[0m %s\n' "$1"; }
succes()  { printf '\033[0;32m✓\033[0m %s\n' "$1"; }
erreur()  { printf '\033[0;31m✗\033[0m %s\n' "$1" >&2; }

# --- Prérequis -------------------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
  erreur "Node.js est introuvable. Installez Node 20 ou plus : https://nodejs.org"
  exit 1
fi

version_node="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$version_node" -lt 20 ]; then
  erreur "Node 20 minimum est requis (version détectée : $(node -v))."
  exit 1
fi
succes "Node $(node -v)"

# --- Base de données -------------------------------------------------------

# Le port est lu depuis DATABASE_URL quand le fichier existe déjà, pour
# respecter une base PostgreSQL installée autrement que par Docker.
hote_db="localhost"
port_db="5432"
if [ -f apps/api/.env ]; then
  url="$(grep -E '^DATABASE_URL=' apps/api/.env | head -1 | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')"
  if [[ "$url" =~ @([^:/]+):([0-9]+)/ ]]; then
    hote_db="${BASH_REMATCH[1]}"
    port_db="${BASH_REMATCH[2]}"
  fi
fi

db_joignable() {
  (echo > "/dev/tcp/${hote_db}/${port_db}") >/dev/null 2>&1
}

if db_joignable; then
  succes "PostgreSQL déjà joignable sur ${hote_db}:${port_db}"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  info "Démarrage de PostgreSQL via Docker…"
  docker compose up -d
  for _ in $(seq 1 30); do
    db_joignable && break
    sleep 1
  done
  if db_joignable; then
    succes "PostgreSQL démarré"
  else
    erreur "PostgreSQL n'a pas répondu après 30 secondes. Regardez : docker compose logs"
    exit 1
  fi
else
  erreur "Aucune base PostgreSQL joignable sur ${hote_db}:${port_db}, et Docker n'est pas disponible."
  erreur "Démarrez Docker Desktop, ou installez PostgreSQL 16 et renseignez DATABASE_URL dans apps/api/.env"
  exit 1
fi

# --- Configuration ---------------------------------------------------------

if [ ! -f apps/api/.env ]; then
  info "Création de apps/api/.env avec un secret JWT généré"
  # L'API refuse de démarrer avec un secret faible ou par défaut : on en
  # génère un vrai plutôt que de recopier l'exemple tel quel.
  if command -v openssl >/dev/null 2>&1; then
    secret="$(openssl rand -base64 48 | tr -d '\n')"
  else
    secret="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")"
  fi
  cat > apps/api/.env <<EOF
DATABASE_URL="postgresql://cadran:cadran@localhost:5432/cadran?schema=public"
JWT_SECRET="${secret}"
JWT_EXPIRES_IN="12h"
PORT=3001
EOF
  succes "apps/api/.env créé"
fi

if [ ! -f apps/web/.env ]; then
  cp apps/web/.env.example apps/web/.env
  succes "apps/web/.env créé"
fi

# --- Dépendances et schéma -------------------------------------------------

info "Installation des dépendances…"
npm install --silent
succes "Dépendances installées"

info "Application du schéma de base de données…"
npm run prisma:generate --silent >/dev/null
(cd apps/api && npx prisma migrate deploy >/dev/null)
succes "Schéma à jour"

# Le seed est idempotent : il ne fait rien si le compte de démonstration
# existe déjà, donc relancer ce script ne duplique aucune donnée.
info "Jeu de données de démonstration…"
npm run prisma:seed --silent

# --- Lancement -------------------------------------------------------------

nettoyer() {
  printf '\n'
  info "Arrêt des serveurs…"
  kill ${pid_api:-} ${pid_web:-} 2>/dev/null || true
  wait ${pid_api:-} ${pid_web:-} 2>/dev/null || true
  exit 0
}
trap nettoyer INT TERM

info "Démarrage de l'API…"
npm run dev:api > /tmp/cadran-api.log 2>&1 &
pid_api=$!

for _ in $(seq 1 45); do
  curl -s -o /dev/null "${API_URL}/entities" && break
  sleep 1
done

if ! kill -0 "$pid_api" 2>/dev/null; then
  erreur "L'API n'a pas démarré. Dernières lignes du journal :"
  tail -20 /tmp/cadran-api.log >&2
  exit 1
fi
succes "API sur ${API_URL}"

info "Démarrage du frontend…"
npm run dev:web > /tmp/cadran-web.log 2>&1 &
pid_web=$!
sleep 4
succes "Interface sur ${WEB_URL}"

cat <<EOF

  Cadran est lancé.

  Ouvrez ${WEB_URL}
  Identifiants de démonstration : demo@cadran.fr / CadranDemo123!

  Journaux : /tmp/cadran-api.log et /tmp/cadran-web.log
  Ctrl+C pour tout arrêter.

EOF

wait
