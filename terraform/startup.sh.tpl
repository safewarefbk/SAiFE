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

# ─── System Update ────────────────────────────────────────────────────────
# Fully patch the OS before installing anything else.
# If a kernel update requires a reboot, we reboot once and re-enter this script
# (GCP re-runs the startup script on every boot).
REBOOT_MARKER="/var/lib/saife-reboot-done"
echo "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
apt-get dist-upgrade -y -qq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
apt-get autoremove -y -qq

if [ -f /var/run/reboot-required ] && [ ! -f "$REBOOT_MARKER" ]; then
  echo "Kernel update requires reboot — rebooting now (will resume on next boot)..."
  touch "$REBOOT_MARKER"
  reboot
  exit 0
fi
echo "System is up to date."

# ─── Install Docker (official script — works on Debian 12/13) ───────────────
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

# ─── Install fail2ban (brute-force protection for Caddy basic auth) ────────
echo "Installing fail2ban..."
apt-get install -y -qq fail2ban

# Caddy logs are inside the container at /data/access.log
# We mount that volume on the host so fail2ban can read it.
# Caddy log format: JSON with "status" field.

# Filter: match HTTP 401 responses in Caddy JSON logs
cat > /etc/fail2ban/filter.d/caddy-auth.conf << 'F2BFILTER'
[Definition]
# Caddy JSON log: {"request":{"remote_ip":"1.2.3.4",...},"status":401,...}
failregex = "remote_ip"\s*:\s*"<HOST>".*"status"\s*:\s*401
ignoreregex =
F2BFILTER

# Custom action: insert rules into DOCKER-USER chain (not INPUT).
# Docker routes container traffic through FORWARD → DOCKER-USER → DOCKER,
# completely bypassing INPUT. Standard iptables actions don't work with Docker.
cat > /etc/fail2ban/action.d/docker-iptables.conf << 'F2BACTION'
[Definition]
actionstart = iptables -N f2b-<name> 2>/dev/null || true
              iptables -A f2b-<name> -j RETURN
              iptables -I DOCKER-USER -p <protocol> -m multiport --dports <port> -j f2b-<name>
actionstop  = iptables -D DOCKER-USER -p <protocol> -m multiport --dports <port> -j f2b-<name> 2>/dev/null || true
              iptables -F f2b-<name> 2>/dev/null || true
              iptables -X f2b-<name> 2>/dev/null || true
actionban   = iptables -I f2b-<name> 1 -s <ip> -j DROP
actionunban = iptables -D f2b-<name> -s <ip> -j DROP 2>/dev/null || true

[Init]
protocol = tcp
port     = 443
F2BACTION

# Jail: ban IP for 1 hour after 5 failed attempts in 10 minutes
cat > /etc/fail2ban/jail.d/caddy-auth.conf << 'F2BJAIL'
[caddy-auth]
enabled  = true
port     = 443
filter   = caddy-auth
logpath  = /var/lib/docker/volumes/saife-app_caddy-data/_data/access.log
maxretry = 5
findtime = 600
bantime  = 3600
action   = docker-iptables[name=caddy-auth, port="443", protocol=tcp]
F2BJAIL

systemctl enable fail2ban

# Pre-create the Docker volume directory and log file so fail2ban can start.
# Docker will reuse this path when the caddy-data volume is created.
mkdir -p /var/lib/docker/volumes/saife-app_caddy-data/_data
touch /var/lib/docker/volumes/saife-app_caddy-data/_data/access.log

# ─── Systemd service: restart fail2ban after Docker containers are up ───────
# fail2ban must (re)start AFTER Docker containers are running so that:
#  1. The DOCKER-USER iptables chain exists and is fully set up
#  2. Caddy is writing to the access.log file
#  3. fail2ban gets a fresh inotify watch on the active log
# This covers: first boot, daily auto-start (schedule), manual reboot.
cat > /etc/systemd/system/fail2ban-docker-sync.service << 'F2BSYNC'
[Unit]
Description=Restart fail2ban after Docker containers are ready
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
# Wait for containers to actually start (docker.service ready ≠ containers running)
ExecStartPre=/bin/bash -c 'for i in $(seq 1 60); do docker ps --format "{{.Names}}" 2>/dev/null | grep -q saife-caddy && exit 0; sleep 5; done; echo "Caddy container not found after 5 min"; exit 1'
ExecStart=/bin/systemctl restart fail2ban
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
F2BSYNC

systemctl daemon-reload
systemctl enable fail2ban-docker-sync

# Start fail2ban now (best-effort — the systemd service will restart it later
# when Docker containers are up and the log file is actively written to).
systemctl start fail2ban || true
echo "fail2ban installed and configured for Caddy basic auth protection."

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
BASIC_AUTH_USER="${basic_auth_user}"
BASIC_AUTH_PASS="${basic_auth_password}"

# ─── Generate bcrypt hash for basic auth (if enabled) ──────────────────────
BASIC_AUTH_BLOCK=""
if [ -n "$BASIC_AUTH_USER" ] && [ -n "$BASIC_AUTH_PASS" ]; then
  # Use caddy's built-in hash-password command
  HASHED_PASS=$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$BASIC_AUTH_PASS")
  BASIC_AUTH_BLOCK="    basicauth * {
        $BASIC_AUTH_USER $HASHED_PASS
    }"
  echo "Basic auth enabled for user: $BASIC_AUTH_USER"
else
  echo "Basic auth disabled (no credentials provided)"
fi

if [ -n "$DOMAIN" ]; then
  # Production: automatic Let's Encrypt TLS via domain
  cat > Caddyfile << CADDYEOF
{
    servers {
        timeouts {
            read_body   10s
            read_header 5s
            write       120s
            idle        30s
        }
    }
}

$DOMAIN {
$BASIC_AUTH_BLOCK
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
  cat > Caddyfile << CADDYEOF
{
    servers {
        timeouts {
            read_body   10s
            read_header 5s
            write       120s
            idle        30s
        }
    }
}

:443 {
    tls /etc/caddy/tls.crt /etc/caddy/tls.key

$BASIC_AUTH_BLOCK
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