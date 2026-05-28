#!/bin/sh
set -e

HASH_FILE=/tmp/package_hash
LOCK_FILE=/tmp/node_modules_ready

if [ ! -f "$LOCK_FILE" ]; then
  echo "Instalando dependencias pela primeira vez..."
  npm install
  md5sum package.json | cut -d' ' -f1 > "$HASH_FILE"
  touch "$LOCK_FILE"
else
  OLD_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")
  NEW_HASH=$(md5sum package.json | cut -d' ' -f1)
  if [ "$OLD_HASH" != "$NEW_HASH" ]; then
    echo "package.json modificado — reinstalando dependencias..."
    npm install
    echo "$NEW_HASH" > "$HASH_FILE"
  fi
fi

echo "Gerando Prisma Client..."
npx prisma generate

echo "Iniciando servidor em modo dev..."
exec npx tsx watch src/index.ts
