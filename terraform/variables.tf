# Oracle Cloud Infrastructure Variables
# ====================================

variable "compartment_id" {
  type        = string
  description = "The compartment to create the resources in"
  default     = "ocid1.tenancy.oc1..aaaaaaaaf7kzx4gvgyjxft6hacpx6d2xigbylolx2gwizor3dpxyaj24j2wa"
}

variable "region" {
  type        = string
  description = "The region to provision the resources in"
  default     = "us-ashburn-1"
}

variable "ssh_public_key" {
  type        = string
  description = "The SSH public key to use for connecting to the worker nodes"
  default     = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPDhYx8CTkZV+OiR/mq8Bylr2S9505TprhOwKtCc2UGO"
}

variable "bastion_allowed_ips" {
  type        = list(string)
  description = "List of IP prefixes allowed to connect via bastion"
  default     = ["174.207.224.155/32", "2600:1009:b14a:a216:fd95:7eff:e504:3f54/128"]
}

variable "ad_list" {
  type        = list(any)
  description = "List of length 2 with the names of availability regions to use"
  default     = ["BJqI:US-ASHBURN-1-AD-1", "BJqI:US-ASHBURN-1-AD-2"]
}

variable "git_token" {
  description = "Git PAT"
  sensitive   = true
  default     = null # Must be provided via TF_VAR_git_token environment variable
}

variable "git_url" {
  description = "Git repository URL"
  default     = "https://github.com/pixelatedempathy/pixelated"
  type        = string
  nullable    = false
}

variable "instance_shape" {
  description = "The shape of the compute instance"
  type        = string
  default     = "VM.Standard.E2.1.Micro"
}

variable "vcn_cidr" {
  description = "CIDR block for the VCN"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}
variable "flux_registry" {
  description = "Container registry for Flux images"
  type        = string
  default     = "ghcr.io/fluxcd"
}

variable "flux_version" {
  description = "Version of Flux to install"
  type        = string
  default     = "v2.1.0"
}

variable "git_path" {
  description = "Path within the Git repository for Flux manifests"
  type        = string
  default     = "./clusters/production" # Adjust to your repo structure
}

variable "git_ref" {
  description = "Git branch or tag reference for Flux to track"
  type        = string
  default     = "master"
}
