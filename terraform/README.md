# SAiFE — Terraform / GCP Deployment

This folder contains the infrastructure-as-code to deploy SAiFE on a **Google Cloud Platform (GCP) VM** using Terraform.

The setup runs the full application stack (Next.js app + PostgreSQL + Caddy reverse-proxy) inside Docker Compose on a single VM.

---

## Prerequisites

Install the following on your local machine:

Tool:
1. [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.6
2. [gcloud CLI](https://cloud.google.com/sdk/docs/install)
3. Docker (to build the image)
---

## Files

| File | Description |
|---|---|
| `main.tf` | Terraform provider config, required GCP APIs |
| `variables.tf` | All input variable declarations with descriptions |
| `compute.tf` | VM instance, static IP, startup script |
| `network.tf` | VPC, subnet, firewall rules (HTTPS + SSH allowlists) |
| `outputs.tf` | Outputs: VM IP, SSH command, app URL |
| `terraform.tfvars.example` | Example variable values — copy to `terraform.tfvars` and edit |
| `startup.sh.tpl` | Startup script template injected into the VM on first boot (installs Docker, writes config files) |
| `setup.sh` | **Full deploy** — builds image, runs Terraform, SCPs tarball, starts services |
| `update.sh` | **Infra-only update** — re-applies Terraform changes without rebuilding Docker image |
| `destroy.sh` | **Teardown** — destroys all GCP resources created by Terraform |

---

## Configuration

### 1. Configure `.env` (repository root)

All secrets come from the project's `.env` file. The scripts read it automatically — no duplication needed.

Add these variables to `.env` (in addition to the app ones):

```dotenv
# SSH access
SSH_USER=saife-admin              # Username for the VM
SSH_KEY=~/.ssh/your_private_key   # Path to SSH private key (public key is derived as .pub)

# GCP project
GCP_PROJECT_ID=my-gcp-project-id
```

### 2. Configure `terraform.tfvars`

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

Edit `terraform.tfvars` — the key fields:

| Variable | Description |
|---|---|
| `project_id` | Your GCP project ID |
| `region` / `zone` | Where to create the VM (default: `europe-west1-b`) |
| `allowed_cidr_blocks` | IPs allowed to access the app on port 443 (participants) |
| `admin_cidr_blocks` | IPs allowed to SSH into the VM (your IP only) |
| `machine_type` | VM size (default: `e2-standard-4` — 4 vCPU, 16 GB) |
| `domain_name` | Optional — set your domain for Let's Encrypt TLS; leave empty for self-signed |

> **Secrets** (`postgres_user`, `postgres_password`, `gemini_api_keys`, `ssh_username`, `ssh_public_key_path`) are **not** in `terraform.tfvars`. They are injected automatically from `.env` as `TF_VAR_*` environment variables by the scripts.

---

## Usage

All scripts must be run from the **repository root**.

### Deploy (first time)

```bash
bash terraform/setup.sh
```

This script does the following in order:
1. Loads secrets from `.env`
2. Authenticates with GCP (opens browser on first run)
3. Builds the `saife:latest` Docker image locally
4. Saves it to `saife-latest.tar.gz`
5. Runs `terraform init` + `terraform plan` (asks for confirmation)
6. Runs `terraform apply` — creates VM, network, firewall rules
7. Waits for the VM to be reachable via SSH
8. Waits for the startup script on the VM to finish (Docker install, config files)
9. SCPs the image tarball to the VM
10. Loads the image and starts `docker compose up -d`

At the end it prints the application URL and SSH command.

---

### Update infrastructure only (no rebuild)

Use this when you changed `.tf` or `.tfvars` files (e.g., updated firewall rules) but the Docker image did not change.

```bash
bash terraform/update.sh
```

---

### Destroy everything

⚠️ This permanently deletes the VM and all data on it (PostgreSQL included). Export the database first if needed.

```bash
bash terraform/destroy.sh
```

---

## Outputs

After `setup.sh` or `update.sh`, Terraform prints:

| Output | Example |
|---|---|
| `vm_external_ip` | `34.79.101.126` |
| `vm_name` | `saife-vm` |
| `application_url` | `https://34.79.101.126` |
| `ssh_command` | `ssh -i ~/.ssh/key saife-admin@34.79.101.126` |

---

## Security

- **Port 443 (HTTPS)** — open only to IPs in `allowed_cidr_blocks`. All other IPs are blocked.
- **Port 80 (HTTP)** — completely closed.
- **Port 22 (SSH)** — open only to IPs in `admin_cidr_blocks` (should be your IP only).
- The Next.js app is bound to `127.0.0.1:3000` — not exposed directly; only reachable through Caddy.
- API keys are never baked into the Docker image; they are injected at runtime via environment variables.

---

