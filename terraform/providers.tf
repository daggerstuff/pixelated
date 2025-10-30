provider "kubernetes" {
  config_path = "~/.kube/config-oci"
}

provider "helm" {
  kubernetes = {
    config_path = "~/.kube/config-oci"
  }
}
