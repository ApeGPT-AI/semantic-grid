# Local Kubernetes Deployment Guide

## What We've Built

A complete local Kubernetes deployment configuration for Semantic Grid backend, mirroring production functionality.

### Components Created

#### Infrastructure (in `infra/k8s/local/`)
- ✅ **PostgreSQL** - Operational database for fm-app
- ✅ **RabbitMQ** - Message queue for Celery workers  
- ✅ **Milvus** - Vector database (with etcd + MinIO)
- ✅ **Secrets** - Template for API keys and credentials
- ✅ **Deploy script** - Automated deployment

#### Application Configs Updated
- ✅ **fm-app** local kustomize overlays (namespace: local, storage: local-path)
- ✅ **db-meta** local kustomize overlays (namespace: local, storage: local-path)
- ✅ **Dockerfiles** - Updated to include templates directory

#### Docker Images Built
- ✅ `fm_app:local` (750MB)
- ✅ `dbmeta:local` (541MB)

## 🚀 Quick Deployment

### Step 1: Configure Secrets

**IMPORTANT**: Edit the secrets file with your actual API keys:

```bash
vi infra/k8s/local/secrets.yml
```

Replace these placeholders:
- `YOUR_CLICKHOUSE_PASSWORD_HERE` - Your ClickHouse warehouse password
- `YOUR_OPENAI_API_KEY_HERE` - OpenAI API key
- `YOUR_ANTHROPIC_API_KEY_HERE` - Anthropic (Claude) API key
- `YOUR_GOOGLE_API_KEY_HERE` - Google (Gemini) API key
- `YOUR_DEEPSEEK_API_KEY_HERE` - DeepSeek API key (optional)

### Step 2: Run Deployment Script

```bash
./infra/k8s/local/deploy.sh
```

Or deploy manually:

```bash
# Deploy infrastructure
kubectl apply -f infra/k8s/local/postgres.yml
kubectl apply -f infra/k8s/local/rabbitmq.yml
kubectl apply -f infra/k8s/local/milvus.yml

# Apply secrets
kubectl apply -f infra/k8s/local/secrets.yml

# Deploy applications
kubectl apply -k apps/db-meta/k8s/overlays/local
kubectl apply -k apps/fm-app/k8s/overlays/local
```

### Step 3: Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n local

# Expected output:
# NAME                          READY   STATUS    RESTARTS   AGE
# postgres-xxx                  1/1     Running   0          2m
# rabbitmq-xxx                  1/1     Running   0          2m
# milvus-xxx                    3/3     Running   0          2m
# dbmeta-app-xxx                1/1     Running   0          1m
# fm-app-xxx                    2/2     Running   0          1m

# Check services
kubectl get svc -n local
```

### Step 4: Access Services

Port-forward to access services locally:

```bash
# FM-App API (main application)
kubectl port-forward -n local svc/fm-app-svc 8080:8080

# DB-Meta API (schema service)
kubectl port-forward -n local svc/dbmeta-svc 8081:8080

# RabbitMQ Management UI
kubectl port-forward -n local svc/rabbitmq 15672:15672
```

Test endpoints:
```bash
# FM-App health check
curl http://localhost:8080/health

# DB-Meta health check  
curl http://localhost:8081/health
```

## 📋 Configuration Details

### ClickHouse Connection

The apps connect to your **cloud-based ClickHouse** using `host.docker.internal`. This allows pods to access services on your host machine.

If your ClickHouse is accessible via SSH tunnel or VPN:
```bash
# Example: SSH tunnel to ClickHouse
ssh -L 9000:clickhouse-server:9000 user@bastion-host
```

Then `host.docker.internal:9000` will reach your ClickHouse instance.

### Storage

Uses OrbStack's `local-path` storage class:
- PostgreSQL: 5Gi
- RabbitMQ: No persistence (ephemeral)
- Milvus (etcd): 5Gi
- Milvus (minio): 20Gi
- Milvus (data): 10Gi
- FM-App charts: 1Gi

### Resource Allocation

- **PostgreSQL**: 512Mi-1Gi memory, 250m CPU
- **RabbitMQ**: 256Mi-512Mi memory, 200m CPU
- **Milvus**: 1Gi-4Gi memory, 500m-2 CPU
- **FM-App**: (defined in base deployment)
- **DB-Meta**: (defined in base deployment)

## 🔧 Troubleshooting

### Pods Not Starting

```bash
# Check pod details
kubectl describe pod -n local <pod-name>

# Check logs
kubectl logs -n local <pod-name>

# For fm-app (has 2 containers)
kubectl logs -n local <pod-name> -c fm-app
kubectl logs -n local <pod-name> -c fm-app-celery
```

### Database Connection Issues

```bash
# Test ClickHouse connection
kubectl exec -it -n local deployment/fm-app -c fm-app -- curl -v http://host.docker.internal:9000

# Check PostgreSQL
kubectl exec -it -n local deployment/postgres -- pg_isready -U fm_app
```

### Image Pull Errors

Images use `imagePullPolicy: Never` to use locally built images. If you see pull errors:

```bash
# Rebuild images
docker build -f apps/fm-app/Dockerfile -t fm_app:local .
docker build -f apps/db-meta/Dockerfile -t dbmeta:local .

# Restart deployments
kubectl rollout restart -n local deployment/fm-app
kubectl rollout restart -n local deployment/dbmeta-app
```

### Secrets Not Working

```bash
# Verify secrets are created
kubectl get secrets -n local

# Check secret contents (base64 encoded)
kubectl get secret -n local fm-app-sec -o yaml

# Re-apply secrets
kubectl apply -f infra/k8s/local/secrets.yml

# Restart pods to pick up new secrets
kubectl delete pod -n local -l app=fm-app
kubectl delete pod -n local -l app=dbmeta-app
```

## 🗑️ Cleanup

### Remove Everything

```bash
# Delete namespace (removes everything)
kubectl delete namespace local
```

### Selective Cleanup

```bash
# Remove applications only
kubectl delete -k apps/fm-app/k8s/overlays/local
kubectl delete -k apps/db-meta/k8s/overlays/local

# Remove infrastructure
kubectl delete -f infra/k8s/local/milvus.yml
kubectl delete -f infra/k8s/local/rabbitmq.yml
kubectl delete -f infra/k8s/local/postgres.yml
```

## 📝 Notes

- **Secrets file** (`infra/k8s/local/secrets.yml`) is NOT checked into git - keep your API keys safe!
- **Templates directory** is now included in Docker images for the new template system
- **Namespace** is `local` (not `prod`) to avoid conflicts
- **ClickHouse** connection points to cloud instance via `host.docker.internal`
- **Celery workers** run in the same pod as fm-app (sidecar container)
- **ETL job** for db-meta loads query examples into Milvus

## 🎯 Next Steps

1. **Configure secrets** with your actual API keys
2. **Deploy** using the script or manual commands
3. **Verify** all pods are running
4. **Port-forward** to access services
5. **Test** API endpoints
6. **Monitor** logs for any issues

For more details, see: `infra/k8s/local/README.md`
