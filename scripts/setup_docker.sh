#!/bin/bash

# Build custom vibecodium Docker images for sandboxed execution
echo "🚀 Building Vibecodium Sandbox Images..."

docker build -t vibecodium-rust:latest -f server/docker/Dockerfile.rust server/docker/
docker build -t vibecodium-node:latest -f server/docker/Dockerfile.node server/docker/
docker build -t vibecodium-python:latest -f server/docker/Dockerfile.python server/docker/
docker build -t vibecodium-cpp:latest -f server/docker/Dockerfile.cpp server/docker/
docker build -t vibecodium-go:latest -f server/docker/Dockerfile.go server/docker/
docker build -t vibecodium-bun:latest -f server/docker/Dockerfile.bun server/docker/

echo "✅ All images built successfully!"
docker images | grep vibecodium
