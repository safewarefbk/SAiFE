#!/usr/bin/env bash
# setup.sh — Deployment helper for SAiFE on GCP (SCP tarball approach)
# Run from the repository root: bash terraform/setup.sh
set -euo pipefail

# ─── Load .env (single source of truth for all secrets) ────────────────────
REPO_ROOT="$(git rev-parse --show-toplevel)"
ENV_FILE="$REPO_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Cannot continue without secrets."
  exit 1
fi
# Export every non-comment line from .env into the current shell
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ─── GCP Authentication ──────────────────────────────────────────────────────
# Terraform uses Application Default Credentials (ADC).
# If not already logged in, this opens a browser window for Google login — once.
# After that the token is cached and never asked again until it expires (~1 hour).
if ! gcloud auth application-default print-access-token &>/dev/null; then
  echo "GCP credentials not found or expired. Launching Google login..."
  gcloud auth application-default login
  echo "Login successful."
else
  echo "GCP credentials OK."
fi

# Also make sure the active gcloud project matches terraform.tfvars
gcloud config set project "${GCP_PROJECT_ID:-$(grep 'project_id' "$(git rev-parse --show-toplevel)/terraform/terraform.tfvars" | cut -d'"' -f2)}" --quiet

# ─── Derive Terraform variables from .env (no duplication) ─────────────────
# Terraform reads TF_VAR_<name> as var.<name> automatically.
export TF_VAR_postgres_user="${POSTGRES_USER:?POSTGRES_USER is not set in .env}"
export TF_VAR_postgres_password="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is not set in .env}"
# Support both GEMINI_API_KEYS (comma-separated pool) and GEMINI_API_KEY (single)
export TF_VAR_gemini_api_keys="${GEMINI_API_KEYS:-${GEMINI_API_KEY:?GEMINI_API_KEY or GEMINI_API_KEYS is not set in .env}}"
export TF_VAR_ssh_username="${SSH_USER:?SSH_USER is not set in .env}"
export TF_VAR_ssh_public_key_path="${SSH_KEY:?SSH_KEY is not set in .env}.pub"
export TF_VAR_basic_auth_user="${BASIC_AUTH_USER:-}"
export TF_VAR_basic_auth_password="${BASIC_AUTH_PASSWORD:-}"

# ─── Configuration ─────────────────────────────────────────────────────────
TARBALL="${TARBALL:-saife-latest.tar.gz}"
APP_DIR="/home/saife-app"

echo "=== SAiFE Deployment Setup ==="
echo ""

# ─── Auto-enable provisioning egress for this deploy ─────────────────────────
# Docker Hub + apt need open egress during provisioning.
# setup.sh will lock it back to false automatically at the end.
TFVARS="$(git rev-parse --show-toplevel)/terraform/terraform.tfvars"
sed -i 's/enable_provisioning_egress\s*=\s*false/enable_provisioning_egress = true/' "$TFVARS"

# ─── Step 1: Build Docker image and save to tarball ────────────────────────
# Done BEFORE terraform apply so the tarball is ready to SCP immediately.
echo "[1/5] Building SAiFE Docker image..."
cd "$(git rev-parse --show-toplevel)"
docker build -t saife:latest .

echo "[1/5] Saving image to tarball: $TARBALL"
docker save saife:latest | gzip > "$TARBALL"
echo "      Saved $(du -sh "$TARBALL" | cut -f1) → $TARBALL"

# ─── Step 2: Initialise Terraform ──────────────────────────────────────────
echo "[2/5] Initialising Terraform..."
cd terraform/
terraform init -upgrade -input=false

# ─── Step 3: Review plan ───────────────────────────────────────────────────
echo "[3/5] Terraform plan..."
terraform plan -input=false

read -rp "Apply the plan? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Apply cancelled."
  exit 0
fi

# ─── Step 4: Apply ─────────────────────────────────────────────────────────
echo "[4/5] Applying Terraform..."
terraform apply -input=false -auto-approve

VM_IP="$(terraform output -raw vm_external_ip)"
echo "      VM IP: $VM_IP"

# ─── Step 5: Upload image and start services ───────────────────────────────
echo "[5/5] Waiting for VM to accept SSH connections..."
TARBALL_PATH="$(cd .. && pwd)/$TARBALL"
for i in $(seq 1 30); do
  if ssh -i "$SSH_KEY" \
         -o StrictHostKeyChecking=no \
         -o ConnectTimeout=5 \
         -o BatchMode=yes \
         "$SSH_USER@$VM_IP" "echo ok" 2>/dev/null; then
    echo "      SSH ready."
    break
  fi
  echo "      Attempt $i/30 — retrying in 10 s..."
  sleep 10
done

echo "[5/5] Waiting for startup script to complete (Docker install + config files)..."
for i in $(seq 1 60); do
  if ssh -i "$SSH_KEY" \
         -o StrictHostKeyChecking=no \
         -o ConnectTimeout=5 \
         -o BatchMode=yes \
         "$SSH_USER@$VM_IP" \
         "test -f /var/lib/saife-startup-complete" 2>/dev/null; then
    echo "      Startup script complete."
    break
  fi
  echo "      Attempt $i/60 — startup still running, retrying in 10 s..."
  sleep 10
done

echo "[5/5] Uploading image tarball (this may take a minute)..."
scp -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no \
    "$TARBALL_PATH" \
    "$SSH_USER@$VM_IP:$APP_DIR/"

echo "[5/5] Loading image and starting services on the VM..."
ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no \
    "$SSH_USER@$VM_IP" \
    "docker load -i $APP_DIR/$TARBALL && \
     rm -f $APP_DIR/$TARBALL && \
     cd $APP_DIR && \
     docker compose up -d && \
     docker compose ps"

# Restart fail2ban so it picks up the live Caddy access.log and
# inserts iptables rules into the now-active DOCKER-USER chain.
echo "[5/5] Restarting fail2ban (Docker containers are up)..."
ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no \
    "$SSH_USER@$VM_IP" \
    "sudo systemctl restart fail2ban && \
     for i in \$(seq 1 12); do \
       sudo fail2ban-client status caddy-auth 2>/dev/null && break; \
       echo '  waiting for fail2ban socket...' && sleep 5; \
     done"

echo ""
echo "=== Deployment complete ==="
terraform output
echo ""
APP_URL="$(terraform output -raw application_url)"
echo "Application URL: $APP_URL"
echo "(Accept the self-signed certificate warning on first visit)"

# ─── Auto-disable provisioning egress ────────────────────────────────────────
# Now that everything is running, lock down outbound traffic to Google APIs only.
# We patch terraform.tfvars in-place and apply — no manual step required.
TFVARS="$(git rev-parse --show-toplevel)/terraform/terraform.tfvars"
if grep -q 'enable_provisioning_egress\s*=\s*true' "$TFVARS"; then
  echo ""
  echo "=== Locking down egress (enable_provisioning_egress → false) ==="
  sed -i 's/enable_provisioning_egress\s*=\s*true/enable_provisioning_egress = false/' "$TFVARS"
  terraform apply -input=false -auto-approve
  echo "Egress locked. VM can now only reach Google APIs (Gemini)."
else
  echo "(Provisioning egress already disabled — nothing to do.)"
fi

