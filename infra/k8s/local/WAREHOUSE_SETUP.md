# Local Warehouse Databases Setup

This guide explains how to set up Postgres and Trino warehouse databases in your local Kubernetes cluster for testing Trino support and multi-dialect compatibility.

## Overview

The local setup includes:
- **Postgres Warehouse** (`postgres-wh`) - Same schema as ClickHouse with minimal test data
- **Trino** (optional) - Distributed SQL query engine that can query Postgres

## Quick Start

### 1. Deploy Postgres Warehouse

```bash
# Apply the deployment
kubectl apply -f infra/k8s/local/postgres-warehouse.yml

# Wait for postgres to be ready
kubectl wait --for=condition=ready pod -l app=postgres-wh -n local --timeout=60s

# Load the schema and data
kubectl apply -f infra/k8s/local/postgres-warehouse.yml  # This creates the init job

# Check job status
kubectl get jobs -n local
kubectl logs -n local job/postgres-wh-init
```

### 2. Verify the Setup

```bash
# Port-forward to access Postgres
kubectl port-forward -n local svc/postgres-wh 5433:5432

# Connect with psql (in another terminal)
PGPASSWORD=wh_password_123 psql -h localhost -p 5433 -U wh_user -d warehouse

# Test queries
SELECT COUNT(*) FROM daily_token_balances;
SELECT COUNT(*) FROM enriched_trades;
SELECT COUNT(*) FROM token_balance;
SELECT COUNT(*) FROM trades;
```

## Schema Details

The Postgres warehouse contains 4 tables converted from your ClickHouse schema:

### 1. `daily_token_balances`
- Daily aggregated token balance snapshots
- 10 sample rows with data from 2024-01-15 to 2024-01-17
- Tokens: SOL, USDC, MOBILE, JUP, RAY, BONK

### 2. `enriched_trades`
- DEX trades with enrichment (tickers, USD values, P&L)
- 10 sample trades
- DEXes: Raydium, Orca

### 3. `token_balance`
- Token balance changes with pre/post balances
- 10 sample balance change events
- Linked to trades via signatures

### 4. `trades`
- Raw DEX trades
- Same 10 trades as enriched_trades (without P&L fields)

## Configuration Updates

To use the Postgres warehouse with fm-app and db-meta, you'll need to add a new profile.

### fm-app Configuration

Add to `apps/fm-app/.env` (or k8s ConfigMap):

```bash
# Postgres warehouse profile
DATABASE_WH_POSTGRES_USER=wh_user
DATABASE_WH_POSTGRES_PASS=wh_password_123
DATABASE_WH_POSTGRES_SERVER=postgres-wh.local.svc.cluster.local  # or postgres-wh for in-cluster
DATABASE_WH_POSTGRES_PORT=5432
DATABASE_WH_POSTGRES_DB=warehouse
DATABASE_WH_POSTGRES_DRIVER=postgresql+psycopg2
DATABASE_WH_POSTGRES_PARAMS=
```

### db-meta Configuration

Add to `apps/db-meta/.env`:

```bash
# Postgres warehouse profile
DATABASE_WH_POSTGRES_USER=wh_user
DATABASE_WH_POSTGRES_PASS=wh_password_123
DATABASE_WH_POSTGRES_SERVER=postgres-wh.local.svc.cluster.local
DATABASE_WH_POSTGRES_PORT=5432
DATABASE_WH_POSTGRES_DB=warehouse
DATABASE_WH_POSTGRES_DRIVER=postgresql+psycopg2
```

## Testing Trino Support

Once Postgres warehouse is running, you can test the Trino-specific pagination features:

```bash
# Run the Trino pagination tests
cd apps/fm-app
uv run python examples/test_trino_pagination.py
```

The tests will verify:
- ✅ Case-sensitive column quoting for Trino
- ✅ Default ORDER BY for deterministic pagination
- ✅ Optimized COUNT queries (scalar subquery vs window function)
- ✅ Comparison with ClickHouse/Postgres behavior

## Sample Queries

Test sorting and pagination with these queries:

```sql
-- Test case-sensitive columns (important for Trino)
SELECT ts, token_account, owner, token_ticker, balance_in_usdc 
FROM daily_token_balances 
ORDER BY ts DESC 
LIMIT 5;

-- Test trades with enrichment
SELECT ts, side, source_ticker, destination_ticker, 
       source_calculated_amount, destination_calculated_amount,
       profit_usd, profit_pct
FROM enriched_trades
WHERE profit_usd != 0
ORDER BY profit_usd DESC;

-- Test array columns (TEXT[] in Postgres)
SELECT ts, signature, signers, dex_name, source_ticker, destination_ticker
FROM trades
WHERE 'Signer1' = ANY(signers);
```

## Trino Setup

Trino is a distributed SQL query engine that can query the Postgres warehouse.

### 1. Deploy Trino

```bash
# Apply Trino deployment
kubectl apply -f infra/k8s/local/trino.yml

# Wait for Trino to be ready
kubectl wait --for=condition=ready pod -l app=trino -n local --timeout=120s

# Check Trino status
kubectl logs -n local -l app=trino --tail=50
```

### 2. Test Trino

```bash
# Port-forward Trino web UI
kubectl port-forward -n local svc/trino 8081:8080

# Access web UI
open http://localhost:8081

# Or use Trino CLI
kubectl exec -it -n local deployment/trino -- trino --catalog postgresql --schema public

# Run test query
SELECT COUNT(*) FROM trades;
```

### 3. Configure fm-app for Trino

Add Trino profile to your fm-app ConfigMap (see `MULTI_WAREHOUSE_CONFIG.md` for details):

```yaml
DATABASE_WH_TRINO_USER: 'trino'
DATABASE_WH_TRINO_PASS: ''
DATABASE_WH_TRINO_SERVER: 'trino'
DATABASE_WH_TRINO_PORT: '8080'
DATABASE_WH_TRINO_DB: 'postgresql.public'
DATABASE_WH_TRINO_DRIVER: 'trino'
DATABASE_WH_TRINO_PARAMS: ''
```

## Troubleshooting

### Postgres won't start
```bash
# Check logs
kubectl logs -n local -l app=postgres-wh

# Delete and recreate PVC if needed
kubectl delete pvc postgres-wh-pvc -n local
kubectl apply -f infra/k8s/local/postgres-warehouse.yml
```

### Schema not loaded
```bash
# Manually run the init job
kubectl delete job postgres-wh-init -n local
kubectl apply -f infra/k8s/local/postgres-warehouse.yml

# Or load schema manually
kubectl port-forward -n local svc/postgres-wh 5433:5432
PGPASSWORD=wh_password_123 psql -h localhost -p 5433 -U wh_user -d warehouse < infra/k8s/local/warehouse-schema.sql
```

### Check table counts
```bash
kubectl exec -n local -it deployment/postgres-wh -- psql -U wh_user -d warehouse -c "
SELECT 
  schemaname, 
  tablename, 
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  (SELECT COUNT(*) FROM pg_catalog.pg_class c WHERE c.relname = tablename) as row_count
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

## Cleanup

```bash
# Remove Postgres warehouse
kubectl delete -f infra/k8s/local/postgres-warehouse.yml

# Remove PVC (deletes data)
kubectl delete pvc postgres-wh-pvc -n local
```

## Next Steps

1. ✅ Postgres warehouse deployed with real schema
2. ⏳ Add Trino deployment (queries Postgres)  
3. ⏳ Update fm-app to support `wh_postgres` profile
4. ⏳ Update db-meta schema descriptions for Postgres profile
5. ⏳ Test pagination with both ClickHouse and Postgres
