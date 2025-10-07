#!/bin/bash
set -e

echo "Running security scan..."
pnpm audit
