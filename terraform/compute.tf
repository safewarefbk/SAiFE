# ─── Service Account (least privilege) ──────────────────────────────────────
resource "google_service_account" "saife_sa" {
  account_id   = "saife-vm-sa"
  display_name = "SAiFE VM Service Account"
  description  = "Least-privilege SA for the SAiFE compute instance"
}

# Only grant logging and monitoring — no storage, no compute admin
resource "google_project_iam_member" "saife_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.saife_sa.email}"
}

resource "google_project_iam_member" "saife_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.saife_sa.email}"
}

# ─── Instance Schedule (auto start/stop) ─────────────────────────────────────
resource "google_compute_resource_policy" "saife_schedule" {
  count  = var.enable_instance_schedule ? 1 : 0
  name   = "saife-instance-schedule"
  region = var.region

  instance_schedule_policy {
    vm_start_schedule {
      schedule = var.schedule_start_cron
    }
    vm_stop_schedule {
      schedule = var.schedule_stop_cron
    }
    time_zone = var.schedule_timezone
  }
}

# The instance schedule uses a Google-managed service agent that needs
# compute.instances.start and compute.instances.stop permissions.
# Granting roles/compute.instanceAdmin.v1 to the Compute Engine service agent.
resource "google_project_iam_member" "schedule_agent" {
  count   = var.enable_instance_schedule ? 1 : 0
  project = var.project_id
  role    = "roles/compute.instanceAdmin.v1"
  member  = "serviceAccount:service-${data.google_project.project.number}@compute-system.iam.gserviceaccount.com"
}

data "google_project" "project" {
  project_id = var.project_id
}

# ─── Compute Instance ───────────────────────────────────────────────────────
resource "google_compute_instance" "saife_vm" {
  name         = "saife-vm"
  machine_type = var.machine_type
  zone         = var.zone
  description  = "SAiFE application server — Next.js + PostgreSQL via Docker Compose"

  tags = ["saife-vm"]

  # Attach instance schedule (auto start/stop) if enabled
  resource_policies = var.enable_instance_schedule ? [google_compute_resource_policy.saife_schedule[0].id] : []

  labels = {
    app         = "saife"
    environment = var.environment
    managed_by  = "terraform"
  }

  boot_disk {
    initialize_params {
      image = var.os_image
      size  = var.disk_size_gb
      type  = var.disk_type
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.saife_subnet.id

    access_config {
      nat_ip = google_compute_address.saife_ip.address
    }
  }

  service_account {
    email  = google_service_account.saife_sa.email
    scopes = ["logging-write", "monitoring-write"]
  }

  # ── Security hardening ──────────────────────────────────────────────────
  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  # Disable legacy metadata endpoint (security best practice)
  metadata = {
    enable-oslogin         = "FALSE"
    block-project-ssh-keys = "TRUE"
    ssh-keys               = "${var.ssh_username}:${file(var.ssh_public_key_path)}"
  }

  # ── Startup Script ─────────────────────────────────────────────────────
  metadata_startup_script = templatefile("${path.module}/startup.sh.tpl", {
    postgres_user       = var.postgres_user
    postgres_password   = var.postgres_password
    gemini_api_keys     = var.gemini_api_keys
    domain_name         = var.domain_name
    basic_auth_user     = var.basic_auth_user
    basic_auth_password = var.basic_auth_password
  })

  # Prevent Terraform from recreating VM on startup script changes
  lifecycle {
    ignore_changes = [metadata_startup_script]
  }

  depends_on = [
    google_project_service.compute,
    google_project_service.os_login,
  ]
}