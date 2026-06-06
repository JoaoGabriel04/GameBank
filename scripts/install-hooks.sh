#!/bin/bash
# Instala os git hooks do GameBank. Rode após clonar o projeto.
set -e

HOOK_SRC="scripts/pre-push-hook"
HOOK_DEST=".git/hooks/pre-push"

if [ ! -f "$HOOK_SRC" ]; then
  echo "✗ $HOOK_SRC não encontrado. Rode a partir da raiz do projeto."
  exit 1
fi

cp "$HOOK_SRC" "$HOOK_DEST"
chmod +x "$HOOK_DEST"
echo "✓ Hook pre-push instalado em $HOOK_DEST"
