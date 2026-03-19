#!/bin/bash
set -euo pipefail

# ─── Logging ─────────────────────────────────────────────────────────────────
exec > >(tee /var/log/saife-startup.log) 2>&1
echo "=== SAiFE startup script BEGIN $(date -u) ==="

# ─── System Hardening ────────────────────────────────────────────────────────
sysctl -w net.ipv4.ip_forward=0 || true
sysctl -w net.ipv4.conf.all.accept_redirects=0 || true
sysctl -w net.ipv4.conf.default.accept_redirects=0 || true
sysctl -w net.ipv4.tcp_syncookies=1 || true

# ─── Install Docker (official script — works on Debian 12) ──────────────────
echo "Installing Docker..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
# Add saife-admin to docker group — no sudo needed for docker commands
usermod -aG docker saife-admin
echo "Docker $(docker --version) installed."
echo "Docker Compose $(docker compose version) installed."

# ─── Create application directory ───────────────────────────────────────────
APP_DIR="/home/saife-app"
mkdir -p "$APP_DIR"
chown saife-admin:saife-admin "$APP_DIR"
cd "$APP_DIR"

# ─── Write .env file (secrets from Terraform variables) ─────────────────────
cat > .env << 'ENVEOF'
POSTGRES_USER=${postgres_user}
POSTGRES_PASSWORD=${postgres_password}
GEMINI_API_KEYS=${gemini_api_keys}
GEMINI_API_KEY=
ENVEOF

chmod 600 .env
chown saife-admin:saife-admin .env

# ─── Write docker-compose.yml ───────────────────────────────────────────────
cat > docker-compose.yml << 'COMPOSEEOF'
services:

  postgres:
    image: postgres:16-alpine
    container_name: saife-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: saife
      POSTGRES_USER: $${POSTGRES_USER}
      POSTGRES_PASSWORD: $${POSTGRES_PASSWORD}
    volumes:
      - saife-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d saife"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    # PostgreSQL listens only on Docker internal network — NOT exposed to host
    networks:
      - saife-internal

  saife:
    image: saife:latest
    container_name: saife
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"   # Bind to localhost only — Caddy will reverse-proxy
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      NEXT_TELEMETRY_DISABLED: "1"
      DATABASE_URL: "postgresql://$${POSTGRES_USER}:$${POSTGRES_PASSWORD}@postgres:5432/saife?schema=public"
      GEMINI_API_KEYS: $${GEMINI_API_KEYS:-}
      GEMINI_API_KEY: $${GEMINI_API_KEY:-}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/session/list || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - saife-internal

  # ── Caddy Reverse Proxy (TLS termination) ────────────────────────────────
  caddy:
    image: caddy:2-alpine
    container_name: saife-caddy
    restart: unless-stopped
    ports:
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./tls.crt:/etc/caddy/tls.crt:ro
      - ./tls.key:/etc/caddy/tls.key:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - saife
    networks:
      - saife-internal

networks:
  saife-internal:
    driver: bridge

volumes:
  saife-pgdata:
    driver: local
  caddy-data:
    driver: local
  caddy-config:
    driver: local
COMPOSEEOF

# ─── Write Caddyfile ────────────────────────────────────────────────────────
# Get VM external IP from GCP metadata service
VM_IP=$(curl -sf -H "Metadata-Flavor: Google" \
  "http://169.254.169.254/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" \
  || echo "localhost")
echo "VM external IP: $VM_IP"

# Generate self-signed TLS cert with IP as SAN (more reliable than tls internal for raw IP access)
apt-get install -y -qq openssl
openssl req -x509 -newkey rsa:4096 \
  -keyout "$APP_DIR/tls.key" \
  -out "$APP_DIR/tls.crt" \
  -days 365 -nodes \
  -subj "/CN=saife-demo" \
  -addext "subjectAltName=IP:$VM_IP,IP:127.0.0.1"
chown saife-admin:saife-admin "$APP_DIR/tls.key" "$APP_DIR/tls.crt"
chmod 600 "$APP_DIR/tls.key"
echo "Self-signed TLS certificate generated for IP: $VM_IP"

DOMAIN="${domain_name}"

if [ -n "$DOMAIN" ]; then
  # Production: automatic Let's Encrypt TLS via domain
  cat > Caddyfile << CADDYEOF
$DOMAIN {
    reverse_proxy saife:3000

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server
    }

    log {
        output file /data/access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
CADDYEOF
else
  # No domain: use pre-generated self-signed cert for raw IP access
  cat > Caddyfile << 'CADDYEOF'
:443 {
    tls /etc/caddy/tls.crt /etc/caddy/tls.key

    reverse_proxy saife:3000

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server
    }

    log {
        output file /data/access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
CADDYEOF
fi

# ─── Done — setup.sh will SCP the image tarball and start containers ────────
echo "NOTE: Config files written. Waiting for setup.sh to load saife:latest and start containers."

# Sentinel file — setup.sh polls this to know startup is complete
touch /var/lib/saife-startup-complete

echo "=== SAiFE startup script END $(date -u) ==="