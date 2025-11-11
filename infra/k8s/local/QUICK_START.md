# Quick Start: Multi-Warehouse Local Setup

Fast track to get Postgres and Trino warehouses running locally.

## Prerequisites

- Local Kubernetes cluster running (Docker Desktop, Minikube, or OrbStack)
- `kubectl` configured for `local` namespace
- fm-app and db-meta deployments ready

## Step 1: Deploy Warehouses (5 minutes)

```bash
# Deploy Postgres warehouse
kubectl apply -f infra/k8s/local/postgres-warehouse.yml

# Deploy Trino (queries Postgres)
kubectl apply -f infra/k8s/local/trino.yml

# Wait for everything to be ready
kubectl wait --for=condition=ready pod -l app=postgres-wh -n local --timeout=120s
kubectl wait --for=condition=ready pod -l app=trino -n local --timeout=120s

# Verify
kubectl get pods -n local | grep -E "(postgres-wh|trino)"
```

## Step 2: Load Schema (2 minutes)

```bash
# Port-forward Postgres
kubectl port-forward -n local svc/postgres-wh 5433:5432 &

# Load schema
PGPASSWORD=wh_password_123 psql -h localhost -p 5433 -U wh_user -d warehouse \
  < infra/k8s/local/warehouse-schema.sql

# Verify data loaded
PGPASSWORD=wh_password_123 psql -h localhost -p 5433 -U wh_user -d warehouse -c \
  "SELECT COUNT(*) FROM trades; SELECT COUNT(*) FROM enriched_trades;"
```

## Step 3: Configure Profiles (3 minutes)

### Option A: Edit ConfigMap Files

**For fm-app:**  
Edit `apps/fm-app/k8s/overlays/local/patch-config.yml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fm-cfg
  namespace: local
data:
  # Postgres warehouse
  DATABASE_WH_POSTGRES_USER: 'wh_user'
  DATABASE_WH_POSTGRES_PASS: 'wh_password_123'
  DATABASE_WH_POSTGRES_SERVER: 'postgres-wh'
  DATABASE_WH_POSTGRES_PORT: '5432'
  DATABASE_WH_POSTGRES_DB: 'warehouse'
  DATABASE_WH_POSTGRES_DRIVER: 'postgresql+psycopg2'
  DATABASE_WH_POSTGRES_PARAMS: ''
  
  # Trino warehouse
  DATABASE_WH_TRINO_USER: 'trino'
  DATABASE_WH_TRINO_PASS: ''
  DATABASE_WH_TRINO_SERVER: 'trino'
  DATABASE_WH_TRINO_PORT: '8080'
  DATABASE_WH_TRINO_DB: 'postgresql.public'
  DATABASE_WH_TRINO_DRIVER: 'trino'
  DATABASE_WH_TRINO_PARAMS: ''
```

**For db-meta:**  
Edit `apps/db-meta/k8s/overlays/local/patch-config.yml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dbmeta-cfg
  namespace: local
data:
  # Same as fm-app (copy both profiles)
  DATABASE_WH_POSTGRES_USER: 'wh_user'
  # ... etc
```

### Option B: Use kubectl patch

```bash
# Add Postgres profile to fm-app
kubectl patch configmap fm-cfg -n local --type=merge -p '
data:
  DATABASE_WH_POSTGRES_USER: "wh_user"
  DATABASE_WH_POSTGRES_PASS: "wh_password_123"
  DATABASE_WH_POSTGRES_SERVER: "postgres-wh"
  DATABASE_WH_POSTGRES_PORT: "5432"
  DATABASE_WH_POSTGRES_DB: "warehouse"
  DATABASE_WH_POSTGRES_DRIVER: "postgresql+psycopg2"
  DATABASE_WH_POSTGRES_PARAMS: ""
'

# Add Trino profile to fm-app
kubectl patch configmap fm-cfg -n local --type=merge -p '
data:
  DATABASE_WH_TRINO_USER: "trino"
  DATABASE_WH_TRINO_PASS: ""
  DATABASE_WH_TRINO_SERVER: "trino"
  DATABASE_WH_TRINO_PORT: "8080"
  DATABASE_WH_TRINO_DB: "postgresql.public"
  DATABASE_WH_TRINO_DRIVER: "trino"
  DATABASE_WH_TRINO_PARAMS: ""
'

# Repeat for db-meta
kubectl patch configmap dbmeta-cfg -n local --type=merge -p '...'
```

## Step 4: Restart Services

```bash
# Restart to pick up new config
kubectl rollout restart -n local deployment/fm-app
kubectl rollout restart -n local deployment/dbmeta-app

# Wait for rollout
kubectl rollout status -n local deployment/fm-app
kubectl rollout status -n local deployment/dbmeta-app
```

## Step 5: Test Everything

### Test Postgres Warehouse

```bash
# Direct connection
PGPASSWORD=wh_password_123 psql -h localhost -p 5433 -U wh_user -d warehouse -c "
  SELECT ts, source_ticker, destination_ticker, source_calculated_amount 
  FROM trades 
  ORDER BY ts DESC 
  LIMIT 5;
"
```

### Test Trino

```bash
# Port-forward Trino
kubectl port-forward -n local svc/trino 8081:8080 &

# Trino CLI
kubectl exec -it -n local deployment/trino -- trino --catalog postgresql --schema public

# Query in Trino CLI
trino> SELECT COUNT(*) FROM trades;
trino> SHOW TABLES;
trino> DESCRIBE trades;
```

### Test Trino Pagination

```bash
# Run the test suite
cd apps/fm-app
uv run python examples/test_trino_pagination.py
```

Expected output:
```
============================================================
Testing Trino-Specific SQL Pagination
============================================================

=== Trino Case-Sensitive Column Test ===
✓ Pass: Column names are properly quoted

=== Trino Default ORDER BY Test ===
✓ Pass: Default ORDER BY added for stability

=== Trino Optimized COUNT Test ===
✓ Pass: COUNT query is optimized with scalar subquery

... (all tests passing)
```

### Test via API

```bash
# Query using Postgres profile
curl -X POST http://localhost:8000/api/v1/interactive \
  -H "Content-Type: application/json" \
  -d '{
    "user_message": "Show me the latest 5 trades",
    "profile": "wh_postgres"
  }'

# Query using Trino profile
curl -X POST http://localhost:8000/api/v1/interactive \
  -H "Content-Type: application/json" \
  -d '{
    "user_message": "Count all trades by DEX",
    "profile": "wh_trino"
  }'
```

## Verification Checklist

- [ ] Postgres-wh pod is running
- [ ] Trino pod is running  
- [ ] Schema loaded (40 rows total: 10 per table)
- [ ] ConfigMaps updated with new profiles
- [ ] fm-app restarted
- [ ] db-meta restarted
- [ ] Can query Postgres directly
- [ ] Can query via Trino CLI
- [ ] Trino pagination tests pass
- [ ] API accepts `profile` parameter

## Common Issues

### "relation does not exist"
Schema not loaded. Run Step 2 again.

### "connection refused"
Check pod is running: `kubectl get pods -n local`

### "profile not found"  
ConfigMap not updated or services not restarted. Run Steps 3-4 again.

### Trino can't connect to Postgres
Check catalog config: `kubectl describe configmap trino-catalog-postgresql -n local`

## Next Steps

Once everything works:

1. ✅ Test sorting and pagination with different dialects
2. ✅ Compare query performance (ClickHouse vs Postgres vs Trino)
3. ✅ Add your own test data
4. ✅ Configure production profiles in cloud overlays

## Complete Deployment Command

One-liner to deploy everything:

```bash
kubectl apply -f infra/k8s/local/postgres-warehouse.yml && \
kubectl apply -f infra/k8s/local/trino.yml && \
kubectl wait --for=condition=ready pod -l app=postgres-wh -n local --timeout=120s && \
kubectl wait --for=condition=ready pod -l app=trino -n local --timeout=120s && \
echo "✅ Warehouses deployed! Now load schema and configure profiles."
```

## Documentation

- **Detailed Setup:** `WAREHOUSE_SETUP.md`
- **Multi-Profile Config:** `MULTI_WAREHOUSE_CONFIG.md`  
- **Trino Pagination:** `apps/fm-app/docs/TRINO_SUPPORT.md`

## Support

If you run into issues:

```bash
# Check all pods
kubectl get pods -n local

# Check logs
kubectl logs -n local -l app=postgres-wh --tail=100
kubectl logs -n local -l app=trino --tail=100
kubectl logs -n local -l app=fm-app -c fm-app --tail=100

# Describe resources
kubectl describe pod -n local <pod-name>
```
