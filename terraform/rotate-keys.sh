#!/usr/bin/env bash
# rotate-keys.sh — Rotate Gemini API keys on the running VM without downtime.
#
# Usage (from the repository root):
#   bash terraform/rotate-keys.sh
#
# Before running:
#   1. Edit GEMINI_API_KEYS in your local .env with the new key(s).
#   2. Run this script — it pushes the change to the VM and restarts only the app container.
#
# Postgres and Caddy are NOT touched.
set -euo pipefail

# ─── Load .env (source of truth) ─────────────────────────────────────────────
REPO_ROOT="$(git rev-parse --show-toplevel)"
ENV_FILE="$REPO_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

NEW_KEYS="${GEMINI_API_KEYS:-${GEMINI_API_KEY:-}}"
if [ -z "$NEW_KEYS" ]; then
  echo "ERROR: GEMINI_API_KEYS is empty in .env — nothing to push."
  exit 1
fi

SSH_KEY_PATH="${SSH_KEY:?SSH_KEY is not set in .env}"
SSH_USERNAME="${SSH_USER:?SSH_USER is not set in .env}"
APP_DIR="/home/saife-app"

# ─── Get VM IP from Terraform state ──────────────────────────────────────────
cd "$REPO_ROOT/terraform"
VM_IP="$(terraform output -raw vm_external_ip 2>/dev/null)"
if [ -z "$VM_IP" ]; then
  echo "ERROR: Could not read vm_external_ip from Terraform state. Is the VM up?"
  exit 1
fi

echo "=== Gemini key rotation ==="
echo "  VM:       $VM_IP"
echo "  New keys: $NEW_KEYS"
echo ""

# ─── Push the new GEMINI_API_KEYS value to the VM's .env ─────────────────────
echo "[1/2] Updating GEMINI_API_KEYS on the VM..."
ssh -i "$SSH_KEY_PATH" \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=10 \
    "$SSH_USERNAME@$VM_IP" \
    "cd $APP_DIR && \
     cp .env .env.bak && \
     sed -i 's|^GEMINI_API_KEYS=.*|GEMINI_API_KEYS=$NEW_KEYS|' .env && \
     grep GEMINI_API_KEYS .env"

# ─── Restart only the app container ──────────────────────────────────────────
echo "[2/2] Restarting the app container (Postgres and Caddy untouched)..."
ssh -i "$SSH_KEY_PATH" \
    -o StrictHostKeyChecking=no \
    -o ConnectTimeout=10 \
    "$SSH_USERNAME@$VM_IP" \
    "cd $APP_DIR && \
     docker compose up -d --force-recreate --no-deps saife && \
     docker compose ps saife"

echo ""
echo "=== Done — new Gemini keys are live ==="

