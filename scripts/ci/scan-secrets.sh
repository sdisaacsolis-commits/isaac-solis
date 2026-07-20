#!/usr/bin/env bash
# =============================================================================
# Escaneo básico de secretos (CI). Complementa, no sustituye, la revisión
# humana y el secret scanning de GitHub. Falla si detecta patrones de llaves
# reales en archivos versionados.
# =============================================================================
set -euo pipefail

PATRONES=(
  'sk_live_[A-Za-z0-9]{8,}'                 # Stripe secreta (live)
  'sk_test_[A-Za-z0-9]{8,}'                 # Stripe secreta (test)
  're_[A-Za-z0-9]{20,}'                     # Resend API key
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'      # llaves privadas PEM
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}' # JWT firmados (llaves supabase)
  'AKIA[0-9A-Z]{16}'                        # AWS access key
  'EAA[A-Za-z0-9]{40,}'                     # tokens de Meta/WhatsApp
)

FALLO=0
for patron in "${PATRONES[@]}"; do
  if coincidencias=$(git grep -InE "$patron" -- ':!pnpm-lock.yaml' ':!scripts/ci/scan-secrets.sh' 2>/dev/null); then
    echo "::error::Posible secreto detectado (patrón: $patron)"
    echo "$coincidencias"
    FALLO=1
  fi
done

if [[ "$FALLO" -eq 1 ]]; then
  exit 1
fi
echo "Escaneo de secretos: sin hallazgos."
