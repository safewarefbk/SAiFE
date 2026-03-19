output "vm_external_ip" {
  description = "Static external IP of the SAiFE VM"
  value       = google_compute_address.saife_ip.address
}

output "vm_name" {
  description = "Name of the compute instance"
  value       = google_compute_instance.saife_vm.name
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "ssh -i ${replace(var.ssh_public_key_path, ".pub", "")} ${var.ssh_username}@${google_compute_address.saife_ip.address}"
}

output "application_url" {
  description = "URL to access SAiFE"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${google_compute_address.saife_ip.address}"
}

output "firewall_allowed_ips" {
  description = "CIDRs allowed to access the VM"
  value       = var.allowed_cidr_blocks
}