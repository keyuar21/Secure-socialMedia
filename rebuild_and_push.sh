#!/bin/bash

# Configuration
ECR_BACKEND="910168469763.dkr.ecr.ap-south-1.amazonaws.com/keyuar-backend"
ECR_FRONTEND="910168469763.dkr.ecr.ap-south-1.amazonaws.com/keyuar-frontend"
REGION="ap-south-1"

# Ensure buildx is set up
docker buildx create --use --name multi-platform-builder 2>/dev/null || docker buildx use multi-platform-builder

echo "Building and pushing Backend image for linux/amd64..."
cd backend
docker buildx build --platform linux/amd64 -t $ECR_BACKEND:latest --push .
cd ..

echo "Building and pushing Frontend image for linux/amd64..."
cd frontend
docker buildx build --platform linux/amd64 \
  -t $ECR_FRONTEND:latest --push .
cd ..


echo "Deployment complete! Please restart your pods manually on your Ubuntu server using:"
echo "kubectl rollout restart deployment/keyuar-backend"
echo "kubectl rollout restart deployment/keyuar-frontend"
