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
  description = "GCE machine type — e2-medium (2 vCPU, 4 GB) for small teams, n2-standard-8 for demos"
  type        = string
  default     = "e2-medium"
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

# ─── Basic Auth (optional) ───────────────────────────────────────────────────
variable "basic_auth_user" {
  description = "Username for Caddy basic auth (leave empty to disable auth)"
  type        = string
  default     = ""
}

variable "basic_auth_password" {
  description = "Password for Caddy basic auth (plain text — hashed at deploy time)"
  type        = string
  sensitive   = true
  default     = ""
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

# ─── Egress Control ──────────────────────────────────────────────────────────
variable "enable_provisioning_egress" {
  description = "Allow unrestricted HTTPS egress for Docker Hub + apt. Set to false after first deploy to lock down."
  type        = bool
  default     = true
}

# ─── Instance Schedule (optional) ────────────────────────────────────────────
variable "enable_instance_schedule" {
  description = "Enable automatic start/stop schedule for the VM"
  type        = bool
  default     = false
}

variable "schedule_start_cron" {
  description = "Cron expression for VM auto-start (e.g. '0 8 * * 1-5' = 8 AM weekdays)"
  type        = string
  default     = "0 8 * * 1-5"
}

variable "schedule_stop_cron" {
  description = "Cron expression for VM auto-stop (e.g. '0 19 * * 1-5' = 8 PM weekdays)"
  type        = string
  default     = "0 19 * * 1-5"
}

variable "schedule_timezone" {
  description = "Timezone for the instance schedule"
  type        = string
  default     = "Europe/Rome"
}

