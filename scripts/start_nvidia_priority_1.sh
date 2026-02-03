#!/bin/bash
# Start Priority 1 NVIDIA Microservices

echo "🚀 Starting NeMo Infrastructure..."
docker compose -f docker/docker-compose.nemo-infra.yml up -d

echo "⏳ Waiting for Infrastructure to be ready..."
sleep 10

echo "📈 Starting Customizer & Evaluator..."
docker compose -f docker/docker-compose.nemo-customizer.yml up -d
docker compose -f docker/docker-compose.nemo-evaluator.yml up -d

echo "🔍 Starting Retriever NIMs..."
docker compose -f docker/docker-compose.nemo-retriever.yml up -d

echo "🧹 Starting Curator (shell ready for jobs)..."
docker compose -f docker/docker-compose.nemo-curator.yml up -d

echo "✅ Priority 1 Microservices are launching!"
echo "Use 'docker ps' to monitor status."
