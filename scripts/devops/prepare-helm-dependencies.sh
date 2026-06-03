#!/usr/bin/env bash

set -euo pipefail

chart_dir="${1:?chart directory is required}"

helm repo add traefik https://traefik.github.io/charts >/dev/null 2>&1 || true
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null 2>&1 || true
helm repo update
helm dependency update "${chart_dir}"
