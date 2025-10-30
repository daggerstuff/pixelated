# Oracle Cloud Infrastructure - Terraform Configuration
# ====================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

# Provider configuration
provider "oci" {
  region = var.region
  # Note: OCI provider will use ~/.oci/config file for authentication
}

# Data sources
data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_id
}

# VCN (Virtual Cloud Network)
resource "oci_core_vcn" "pixelated_vcn" {
  compartment_id = var.compartment_id
  display_name   = "pixelated-empathy-vcn"
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = "pixelated"
}

# Internet Gateway
resource "oci_core_internet_gateway" "pixelated_igw" {
  compartment_id = var.compartment_id
  vcn_id        = oci_core_vcn.pixelated_vcn.id
  display_name  = "pixelated-empathy-igw"
}

# Route Table
resource "oci_core_route_table" "pixelated_rt" {
  compartment_id = var.compartment_id
  vcn_id        = oci_core_vcn.pixelated_vcn.id
  display_name  = "pixelated-empathy-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.pixelated_igw.id
  }
}

# Security List
resource "oci_core_security_list" "pixelated_sl" {
  compartment_id = var.compartment_id
  vcn_id        = oci_core_vcn.pixelated_vcn.id
  display_name  = "pixelated-empathy-sl"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      max = "22"
      min = "22"
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      max = "80"
      min = "80"
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      max = "443"
      min = "443"
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      max = "6443"
      min = "6443"
    }
  }
}

# Public Subnet
resource "oci_core_subnet" "pixelated_subnet" {
  compartment_id    = var.compartment_id
  vcn_id           = oci_core_vcn.pixelated_vcn.id
  cidr_block       = "10.0.1.0/24"
  display_name     = "pixelated-empathy-subnet"
  dns_label        = "pixelatedsubnet"
  route_table_id   = oci_core_route_table.pixelated_rt.id
  security_list_ids = [oci_core_security_list.pixelated_sl.id]
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
}

# Compute Instance
resource "oci_core_instance" "pixelated_instance" {
  compartment_id      = var.compartment_id
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "pixelated-empathy-instance"
  shape              = "VM.Standard.E2.1.Micro"  # Always Free tier

  create_vnic_details {
    subnet_id        = oci_core_subnet.pixelated_subnet.id
    display_name     = "pixelated-empathy-vnic"
    assign_public_ip = true
  }

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ubuntu_images.images[0].id
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
  }
}

# Data source for Ubuntu images
data "oci_core_images" "ubuntu_images" {
  compartment_id           = var.compartment_id
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                   = "VM.Standard.E2.1.Micro"
  sort_by                 = "TIMECREATED"
  sort_order              = "DESC"
}

# Outputs
output "instance_public_ip" {
  value = oci_core_instance.pixelated_instance.public_ip
}

output "instance_private_ip" {
  value = oci_core_instance.pixelated_instance.private_ip
}

output "ssh_connection" {
  value = "ssh -i ~/.ssh/planet ubuntu@${oci_core_instance.pixelated_instance.public_ip}"
}