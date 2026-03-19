# ─── Project & Region ────────────────────────────────────────────────────────
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "europe-west1" # Belgium — oldest and largest GCP region in Europe
}

variable "zone" {
  description = "GCP zone for the VM"
  type        = string
  default     = "europe-west1-b"
}

# ─── Network Access Control ──────────────────────────────────────────────────
variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access the VM over HTTPS (port 443) — participant IPs"
  type        = list(string)
  # Example: ["203.0.113.0/24", "198.51.100.50/32"]
  # No default — forces explicit declaration
}

variable "admin_cidr_blocks" {
  description = "List of CIDR blocks allowed to SSH into the VM (port 22) — admin IPs only, NOT participants"
  type        = list(string)
  # Should be your own IP(s) only: ["your.ip.address/32"]
  # No default — forces explicit declaration
}

# ─── VM Sizing ───────────────────────────────────────────────────────────────
variable "machine_type" {
  description = "GCE machine type — e2-standard-4 (4 vCPU, 16 GB) handles ~60 concurrent users"
  type        = string
  default     = "e2-standard-4"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 30
}

variable "disk_type" {
  description = "Boot disk type"
  type        = string
  default     = "pd-ssd"
}

variable "os_image" {
  description = "GCE boot disk image. Common options:"
  # Container-Optimized OS (default — minimal, Docker pre-installed, read-only rootfs)
  #   projects/cos-cloud/global/images/family/cos-stable
  # Ubuntu 22.04 LTS (full OS, apt available, easier to debug)
  #   projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts
  # Debian 12
  #   projects/debian-cloud/global/images/family/debian-12
  type    = string
  default = "projects/debian-cloud/global/images/family/debian-12"
}

# ─── SSH Access ──────────────────────────────────────────────────────────────
variable "ssh_username" {
  description = "Username for SSH access"
  type        = string
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key file"
  type        = string
}

# ─── Application Secrets ────────────────────────────────────────────────────
variable "postgres_user" {
  description = "PostgreSQL username"
  type        = string
  sensitive   = true
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "gemini_api_keys" {
  description = "Comma-separated Gemini API keys for round-robin rotation"
  type        = string
  sensitive   = true
}

# ─── DNS (optional) ─────────────────────────────────────────────────────────
variable "domain_name" {
  description = "Domain name for TLS certificate (leave empty to skip Caddy HTTPS)"
  type        = string
  default     = ""
}

# ─── Labels ──────────────────────────────────────────────────────────────────
variable "environment" {
  description = "Environment label"
  type        = string
  default     = "production"
}