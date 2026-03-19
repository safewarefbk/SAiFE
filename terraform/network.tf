# ─── Dedicated VPC ──────────────────────────────────────────────────────────
resource "google_compute_network" "saife_vpc" {
  name                    = "saife-vpc"
  auto_create_subnetworks = false
  description             = "Isolated VPC for SAiFE deployment"
}

resource "google_compute_subnetwork" "saife_subnet" {
  name                     = "saife-subnet"
  ip_cidr_range            = "10.10.0.0/24"
  region                   = var.region
  network                  = google_compute_network.saife_vpc.id
  private_ip_google_access = true # Allows access to Google APIs without external IP

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# ─── Firewall Rules ─────────────────────────────────────────────────────────

# DENY ALL ingress by default (GCP implicit deny exists, but explicit is clearer)
resource "google_compute_firewall" "deny_all_ingress" {
  name        = "saife-deny-all-ingress"
  network     = google_compute_network.saife_vpc.id
  direction   = "INGRESS"
  priority    = 65534
  description = "Default deny all ingress traffic"

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}

# Allow SSH (port 22) from ADMIN IPs only — optional, leave admin_cidr_blocks empty to disable
# Use IAP tunnel instead: gcloud compute ssh --tunnel-through-iap
resource "google_compute_firewall" "allow_ssh" {
  count       = length(var.admin_cidr_blocks) > 0 ? 1 : 0
  name        = "saife-allow-ssh"
  network     = google_compute_network.saife_vpc.id
  direction   = "INGRESS"
  priority    = 1000
  description = "Allow SSH from admin IPs only"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.admin_cidr_blocks
  target_tags   = ["saife-vm"]
}

# Allow SSH via Google IAP tunnel (required for `gcloud compute ssh` / IAP forwarding)
# 35.235.240.0/20 is Google's IAP IP range — allows SSH without exposing port 22 publicly
resource "google_compute_firewall" "allow_iap_ssh" {
  name        = "saife-allow-iap-ssh"
  network     = google_compute_network.saife_vpc.id
  direction   = "INGRESS"
  priority    = 1000
  description = "Allow SSH from Google IAP (35.235.240.0/20)"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["saife-vm"]
}

# Allow HTTPS (port 443) from allowed IPs only
resource "google_compute_firewall" "allow_https" {
  name        = "saife-allow-https"
  network     = google_compute_network.saife_vpc.id
  direction   = "INGRESS"
  priority    = 1000
  description = "Allow HTTPS from whitelisted IPs"

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = var.allowed_cidr_blocks
  target_tags   = ["saife-vm"]
}

# Port 80 (HTTP) is intentionally NOT opened.
# Caddy uses `tls internal` (self-signed TLS) and only listens on port 443.
# There is no HTTP handler, no redirect, and no ACME challenge — port 80 is dead weight.
# If you ever switch to a real domain, use Caddy DNS-01 challenge so port 80
# remains closed permanently (no Let's Encrypt HTTP-01 needed).

# Allow internal communication (VM ↔ itself for Docker networking)
resource "google_compute_firewall" "allow_internal" {
  name        = "saife-allow-internal"
  network     = google_compute_network.saife_vpc.id
  direction   = "INGRESS"
  priority    = 1000
  description = "Allow internal subnet communication"

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.10.0.0/24"]
  target_tags   = ["saife-vm"]
}

# Allow egress to Google APIs and internet (for Docker pulls, Gemini API)
resource "google_compute_firewall" "allow_egress" {
  name        = "saife-allow-egress"
  network     = google_compute_network.saife_vpc.id
  direction   = "EGRESS"
  priority    = 1000
  description = "Allow all egress (Docker Hub, Gemini API, OS updates)"

  allow {
    protocol = "all"
  }

  destination_ranges = ["0.0.0.0/0"]
  target_tags        = ["saife-vm"]
}

# ─── Static External IP ─────────────────────────────────────────────────────
resource "google_compute_address" "saife_ip" {
  name         = "saife-external-ip"
  address_type = "EXTERNAL"
  region       = var.region
  description  = "Static IP for SAiFE VM"
}