#!/bin/bash

# Set Docker image tags
echo "image-tag=ghcr.io/pixelatedempathy/pixelated:master
ghcr.io/pixelatedempathy/pixelated:latest
ghcr.io/pixelatedempathy/pixelated:main-fa05ee9" >> $GITHUB_OUTPUT

# Set image digest
echo "image-digest=sha256:c02e41aae4d0ee4930a6c6c43c833d00ce80a2bb302fee8426e5f06b2b4c77ec" >> $GITHUB_OUTPUT