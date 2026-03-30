#!/usr/bin/env bash
# update.sh — Apply Terraform-only changes to a running SAiFE deployment.
# Use this when you changed .tf / .tfvars but do NOT need to rebuild the Docker image.
#
# Usage (from the repository root):
#   bash terraform/update.sh
#
set -euo pipefail

# ─── Load secrets from .env ─────────────────────────────────────────────────
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

# ─── Export Terraform variables from .env ───────────────────────────────────
export TF_VAR_postgres_user="${POSTGRES_USER:?POSTGRES_USER is not set in .env}"
export TF_VAR_postgres_password="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is not set in .env}"
export TF_VAR_gemini_api_keys="${GEMINI_API_KEYS:-${GEMINI_API_KEY:?GEMINI_API_KEY or GEMINI_API_KEYS is not set in .env}}"
export TF_VAR_ssh_username="${SSH_USER:?SSH_USER is not set in .env}"
export TF_VAR_ssh_public_key_path="${SSH_KEY:?SSH_KEY is not set in .env}.pub"

# ─── GCP credentials check ──────────────────────────────────────────────────
if ! gcloud auth application-default print-access-token &>/dev/null; then
  echo "GCP credentials not found or expired. Launching Google login..."
  gcloud auth application-default login
fi

# ─── Terraform plan + apply ─────────────────────────────────────────────────
cd "$REPO_ROOT/terraform"

echo "=== Terraform plan ==="
terraform plan -input=false

echo ""
read -rp "Apply these changes? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Apply cancelled."
  exit 0
fi

echo "=== Terraform apply ==="
terraform apply -input=false -auto-approve

echo ""
echo "=== Done ==="
terraform output

