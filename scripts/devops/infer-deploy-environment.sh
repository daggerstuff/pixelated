#!/usr/bin/env bash

set -euo pipefail

app_env_raw="${1:-}"
source_branch_name="${2:-}"

if [ -z "${app_env_raw}" ]; then
  case "${source_branch_name}" in
    master|main)
      app_env_raw="production"
      ;;
    staging|stg|stage)
      app_env_raw="staging"
      ;;
    *)
      app_env_raw="production"
      ;;
  esac
fi

app_env="$(printf '%s' "${app_env_raw}" | tr '[:upper:]' '[:lower:]')"
case "${app_env}" in
  production|prod)
    app_env="production"
    ;;
  staging|stage|stg)
    app_env="staging"
    ;;
esac

printf '%s\n' "${app_env}"
