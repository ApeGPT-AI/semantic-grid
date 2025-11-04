# Local Kubernetes Deployment

This directory contains manifests for deploying the Semantic Grid backend to a local Kubernetes cluster (OrbStack).

## Prerequisites

- OrbStack with Kubernetes enabled
- Docker for building images
- kubectl configured for local cluster
- Access to ClickHouse warehouse database (cloud-based)

## Components

### Infrastructure
- **PostgreSQL**: Operational database for fm-app
- **RabbitMQ**: Message queue for Celery workers
- **Milvus**: Vector database (with etcd and MinIO)

### Applications
- **db-meta**: Database metadata and schema service
- **fm-app**: Flow manager with Celery workers

## Quick Start

### 1. Edit Secrets

Edit `secrets.yml` and fill in your actual API keys:
```bash
# DO NOT commit this file with real secrets!
vi infra/k8s/local/secrets.yml
```

Required secrets:
- ClickHouse passwords (for connecting to cloud warehouse)
- OpenAI API key
- Anthropic API key
- Google API key

### 2. Build Docker Images

```bash
# From repository root
cd apps/fm-app
docker build -t fm_app:local .

cd ../db-meta
docker build -t dbmeta:local .
```

### 3. Deploy Infrastructure

```bash
# Deploy in order
kubectl apply -f infra/k8s/local/postgres.yml
kubectl apply -f infra/k8s/local/rabbitmq.yml
kubectl apply -f infra/k8s/local/milvus.yml

# Wait for infrastructure to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n local --timeout=120s
kubectl wait --for=condition=ready pod -l app=rabbitmq -n local --timeout=120s
kubectl wait --for=condition=ready pod -l app=milvus -n local --timeout=120s
```

### 4. Apply Secrets

```bash
kubectl apply -f infra/k8s/local/secrets.yml
```

### 5. Deploy Applications

```bash
# Deploy db-meta first (fm-app depends on it)
kubectl apply -k apps/db-meta/k8s/overlays/local

# Wait for db-meta to be ready
kubectl wait --for=condition=ready pod -l app=dbmeta-app -n local --timeout=120s

# Deploy fm-app
kubectl apply -k apps/fm-app/k8s/overlays/local
```

### 6. Verify Deployment

```bash
# Check all pods
kubectl get pods -n local

# Check services
kubectl get svc -n local

# View logs
kubectl logs -n local -l app=fm-app -c fm-app --tail=50
kubectl logs -n local -l app=dbmeta-app --tail=50
```

## Access Services

### Port Forwarding

```bash
# FM-App API
kubectl port-forward -n local svc/fm-app-svc 8080:8080

# DB-Meta API
kubectl port-forward -n local svc/dbmeta-svc 8081:8080

# RabbitMQ Management UI
kubectl port-forward -n local svc/rabbitmq 15672:15672
# Access at http://localhost:15672 (admin/local_rabbitmq_password_123)

# PostgreSQL
kubectl port-forward -n local svc/postgres 5432:5432
```

### Testing

```bash
# Test FM-App health
curl http://localhost:8080/health

# Test DB-Meta health
curl http://localhost:8081/health

# Test DB-Meta schema endpoint
curl http://localhost:8081/api/v1/schemas
```

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl describe pod -n local <pod-name>

# Check logs
kubectl logs -n local <pod-name>
```

### Database connection issues

```bash
# Test ClickHouse connection from a pod
kubectl exec -it -n local <pod-name> -- curl -v http://host.docker.internal:9000

# Check if PostgreSQL is ready
kubectl exec -it -n local deployment/postgres -- pg_isready -U fm_app
```

### Storage issues

```bash
# Check PVCs
kubectl get pvc -n local

# Check PV bindings
kubectl get pv
```

## Cleanup

```bash
# Delete applications
kubectl delete -k apps/fm-app/k8s/overlays/local
kubectl delete -k apps/db-meta/k8s/overlays/local

# Delete infrastructure
kubectl delete -f infra/k8s/local/milvus.yml
kubectl delete -f infra/k8s/local/rabbitmq.yml
kubectl delete -f infra/k8s/local/postgres.yml

# Delete secrets
kubectl delete -f infra/k8s/local/secrets.yml

# Delete namespace (optional - will delete everything)
kubectl delete namespace local
```

## Configuration

### ClickHouse Connection

The apps connect to cloud-based ClickHouse using `host.docker.internal`:
- `DATABASE_WH_SERVER: 'host.docker.internal'`
- Configure actual host/IP in your SSH tunnel or local network setup

### Resource Limits

Adjust resource limits in the manifests if needed:
- PostgreSQL: 1Gi memory
- RabbitMQ: 512Mi memory
- Milvus: 4Gi memory
- FM-App: (defined in base deployment)
- DB-Meta: (defined in base deployment)

## Notes

- This setup mirrors production functionality but uses local infrastructure
- ClickHouse warehouse remains in cloud (accessed via host.docker.internal)
- Secrets are stored locally and should NOT be committed to git
- Storage uses OrbStack's `local-path` provisioner
- Images use `imagePullPolicy: Never` to use locally built images
