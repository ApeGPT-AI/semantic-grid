#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Semantic Grid Local K8s Deployment ===${NC}\n"

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl not found${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker not found${NC}"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}\n"

# Check if secrets file is configured
if grep -q "REPLACE_WITH_YOUR" infra/k8s/secrets/local.yml; then
    echo -e "${YELLOW}Warning: secrets/local.yml contains placeholder values${NC}"
    echo -e "${YELLOW}Please edit infra/k8s/secrets/local.yml with your actual API keys${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build Docker images (always rebuild to use latest code)
echo -e "\n${GREEN}Step 1: Building Docker images...${NC}"

echo "Building fm-app:local..."
docker build --platform linux/amd64 -f apps/fm-app/Dockerfile -t fm_app:local --build-arg PROJECT_DIR=apps/fm-app .

echo "Building dbmeta:local..."
docker build --platform linux/amd64 -f apps/db-meta/Dockerfile -t dbmeta:local --build-arg PROJECT_DIR=apps/db-meta .

echo -e "${GREEN}✓ Images built${NC}"

# Deploy infrastructure
echo -e "\n${GREEN}Step 2: Deploying infrastructure...${NC}"

echo "Deploying PostgreSQL..."
kubectl apply -f infra/k8s/local/postgres.yml

echo "Deploying RabbitMQ..."
kubectl apply -f infra/k8s/local/rabbitmq.yml

echo "Deploying Milvus..."
kubectl apply -f infra/k8s/local/milvus.yml

echo "Waiting for infrastructure to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n local --timeout=180s || true
kubectl wait --for=condition=ready pod -l app=rabbitmq -n local --timeout=180s || true
kubectl wait --for=condition=ready pod -l app=milvus -n local --timeout=300s || true

echo -e "${GREEN}✓ Infrastructure deployed${NC}"

# Apply secrets
echo -e "\n${GREEN}Step 3: Applying secrets...${NC}"
kubectl apply -f infra/k8s/secrets/local.yml
echo -e "${GREEN}✓ Secrets applied${NC}"

# Deploy applications
echo -e "\n${GREEN}Step 4: Deploying applications...${NC}"

echo "Deploying db-meta..."
kubectl apply -k apps/db-meta/k8s/overlays/local

echo "Waiting for db-meta to be ready..."
kubectl wait --for=condition=ready pod -l app=dbmeta-app -n local --timeout=180s || true

echo "Deploying fm-app..."
kubectl apply -k apps/fm-app/k8s/overlays/local

# Force restart to pick up newly built images
echo -e "\n${GREEN}Restarting deployments to use new images...${NC}"
kubectl rollout restart -n local deployment/dbmeta-app
kubectl rollout restart -n local deployment/fm-app

echo "Waiting for rollout to complete..."
kubectl rollout status -n local deployment/dbmeta-app --timeout=180s
kubectl rollout status -n local deployment/fm-app --timeout=180s

echo -e "${GREEN}✓ Applications deployed and restarted${NC}"

# Show status
echo -e "\n${GREEN}=== Deployment Status ===${NC}\n"
kubectl get pods -n local
echo
kubectl get svc -n local

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"

echo -e "\nTo view logs:"
echo -e "  ${YELLOW}kubectl logs -n local -l app=fm-app -c fm-app --tail=50 -f${NC}"
echo -e "  ${YELLOW}kubectl logs -n local -l app=dbmeta-app --tail=50 -f${NC}"

echo -e "\n${YELLOW}Note: Run './infra/k8s/local/port-forward.sh' to set up port-forwarding${NC}"
