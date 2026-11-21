#!/usr/bin/env bash
# Recrea la base de dades local "clautic" amb el stub d'auth + totes les migracions.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL="psql -v ON_ERROR_STOP=1 -q -U postgres -h localhost"
$PSQL -d postgres -c "drop database if exists clautic" -c "create database clautic"
$PSQL -d clautic -f dev/auth_stub.sql
for f in supabase/migrations/*.sql; do echo "→ $f"; $PSQL -d clautic -f "$f"; done
if [ "${NO_DEMO:-}" != "1" ]; then echo "→ dev/demo_data.sql"; $PSQL -d clautic -f dev/demo_data.sql; fi
echo "Base de dades local a punt."
