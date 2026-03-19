terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment for remote state (recommended for team use)
  # backend "gcs" {
  #   bucket = "your-terraform-state-bucket"
  #   prefix = "saife/production"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ─── Enable Required APIs ───────────────────────────────────────────────────
resource "google_project_service" "compute" {
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "os_login" {
  service            = "oslogin.googleapis.com"
  disable_on_destroy = false
}
