# Multi-Warehouse Configuration Guide

This guide explains how to configure multiple warehouse database profiles (ClickHouse, Postgres, Trino) in your local Kubernetes setup.

## Overview

The system supports multiple warehouse profiles to enable:
- **Testing against different databases** (ClickHouse, Postgres, Trino)
- **Multi-tenant deployments** (different clients use different warehouses)
- **Database migrations** (transition from old to new schema)

## Profile Naming Convention

Profiles follow the pattern: `wh`, `wh_new`, `wh_v2`, `wh_postgres`, `wh_trino`

Each profile requires these settings:
- `DATABASE_WH_<PROFILE>_USER` - Database username
- `DATABASE_WH_<PROFILE>_PASS` - Database password  
- `DATABASE_WH_<PROFILE>_SERVER` - Database host
- `DATABASE_WH_<PROFILE>_PORT` - Database port
- `DATABASE_WH_<PROFILE>_DB` - Database name
- `DATABASE_WH_<PROFILE>_DRIVER` - SQLAlchemy driver
- `DATABASE_WH_<PROFILE>_PARAMS` - Connection parameters (query string)

## Current Setup (ClickHouse Profiles)

Your existing configuration has 3 ClickHouse profiles:

### Profile: `wh` (Legacy ClickHouse)
```yaml
DATABASE_WH_USER: 'wh_user'
DATABASE_WH_PASS: '<from-secret>'
DATABASE_WH_SERVER: '192.168.28.176'  # Cloud: actual IP, Local: clickhouse-svc
DATABASE_WH_PORT: '9000'
DATABASE_WH_DB: 'wh'
DATABASE_WH_DRIVER: 'clickhouse+native'
DATABASE_WH_PARAMS: '?max_execution_time=120'
```

### Profile: `wh_new` (New ClickHouse)
```yaml
DATABASE_WH_USER_NEW: 'wh_user'        # Note: suffix changes to _NEW
DATABASE_WH_PASS_NEW: '<from-secret>'
DATABASE_WH_SERVER_NEW: '192.168.28.176'
DATABASE_WH_PORT_NEW: '9000'
DATABASE_WH_DB_NEW: 'new_wh'
DATABASE_WH_DRIVER_NEW: 'clickhouse+native'  # Usually same as base
DATABASE_WH_PARAMS_NEW: '?max_execution_time=120'
```

### Profile: `wh_v2` (Current Production ClickHouse)
```yaml
DATABASE_WH_USER_V2: 'wh_user'
DATABASE_WH_PASS_V2: '<from-secret>'
DATABASE_WH_SERVER_V2: 'rafiki.apegpt.ai'
DATABASE_WH_PORT_V2: '9440'
DATABASE_WH_DB_V2: 'ct'
DATABASE_WH_DRIVER_V2: 'clickhouse+native'
DATABASE_WH_PARAMS_V2: '?max_execution_time=120&secure=true&verify=false'
```

## Adding New Warehouse Profiles

### Adding Postgres Warehouse Profile

To add the local Postgres warehouse as `wh_postgres`:

#### For fm-app ConfigMap

Edit `apps/fm-app/k8s/base/deployment.yml` or local overlay:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fm-cfg
  namespace: local
data:
  # ... existing config ...
  
  # Postgres warehouse profile
  DATABASE_WH_POSTGRES_USER: 'wh_user'
  DATABASE_WH_POSTGRES_PASS: 'wh_password_123'
  DATABASE_WH_POSTGRES_SERVER: 'postgres-wh'  # Service name in local namespace
  DATABASE_WH_POSTGRES_PORT: '5432'
  DATABASE_WH_POSTGRES_DB: 'warehouse'
  DATABASE_WH_POSTGRES_DRIVER: 'postgresql+psycopg2'
  DATABASE_WH_POSTGRES_PARAMS: ''
```

#### For db-meta ConfigMap

Edit `apps/db-meta/k8s/base/deployment.yml` or local overlay:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dbmeta-cfg
  namespace: local
data:
  # ... existing config ...
  
  # Postgres warehouse profile (same values)
  DATABASE_WH_POSTGRES_USER: 'wh_user'
  DATABASE_WH_POSTGRES_PASS: 'wh_password_123'
  DATABASE_WH_POSTGRES_SERVER: 'postgres-wh'
  DATABASE_WH_POSTGRES_PORT: '5432'
  DATABASE_WH_POSTGRES_DB: 'warehouse'
  DATABASE_WH_POSTGRES_DRIVER: 'postgresql+psycopg2'
  DATABASE_WH_POSTGRES_PARAMS: ''
```

### Adding Trino Warehouse Profile

To add Trino as `wh_trino`:

#### For fm-app ConfigMap

```yaml
  # Trino warehouse profile
  DATABASE_WH_TRINO_USER: 'trino'
  DATABASE_WH_TRINO_PASS: ''  # Trino doesn't require password by default
  DATABASE_WH_TRINO_SERVER: 'trino'  # Service name
  DATABASE_WH_TRINO_PORT: '8080'
  DATABASE_WH_TRINO_DB: 'postgresql.public'  # catalog.schema format
  DATABASE_WH_TRINO_DRIVER: 'trino'  # Use trino driver
  DATABASE_WH_TRINO_PARAMS: ''
```

#### For db-meta ConfigMap

```yaml
  # Trino warehouse profile (same values)
  DATABASE_WH_TRINO_USER: 'trino'
  DATABASE_WH_TRINO_PASS: ''
  DATABASE_WH_TRINO_SERVER: 'trino'
  DATABASE_WH_TRINO_PORT: '8080'
  DATABASE_WH_TRINO_DB: 'postgresql.public'
  DATABASE_WH_TRINO_DRIVER: 'trino'
  DATABASE_WH_TRINO_PARAMS: ''
```

## Complete Local ConfigMap Example

Here's a complete example for `apps/fm-app/k8s/overlays/local/patch-config.yml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fm-cfg
  namespace: local
data:
  LOG_LEVEL: 'INFO'
  
  # Default profile (ClickHouse - if you have it locally)
  DATABASE_WH_USER: 'default'
  DATABASE_WH_PASS: ''
  DATABASE_WH_SERVER: 'clickhouse'
  DATABASE_WH_PORT: '9000'
  DATABASE_WH_DB: 'default'
  DATABASE_WH_DRIVER: 'clickhouse+native'
  DATABASE_WH_PARAMS: '?max_execution_time=120'
  
  # Postgres warehouse profile
  DATABASE_WH_POSTGRES_USER: 'wh_user'
  DATABASE_WH_POSTGRES_PASS: 'wh_password_123'
  DATABASE_WH_POSTGRES_SERVER: 'postgres-wh'
  DATABASE_WH_POSTGRES_PORT: '5432'
  DATABASE_WH_POSTGRES_DB: 'warehouse'
  DATABASE_WH_POSTGRES_DRIVER: 'postgresql+psycopg2'
  DATABASE_WH_POSTGRES_PARAMS: ''
  
  # Trino warehouse profile
  DATABASE_WH_TRINO_USER: 'trino'
  DATABASE_WH_TRINO_PASS: ''
  DATABASE_WH_TRINO_SERVER: 'trino'
  DATABASE_WH_TRINO_PORT: '8080'
  DATABASE_WH_TRINO_DB: 'postgresql.public'
  DATABASE_WH_TRINO_DRIVER: 'trino'
  DATABASE_WH_TRINO_PARAMS: ''
  
  # Set default profile
  DEFAULT_PROFILE: 'wh_postgres'
```

## Using Profiles in Code

### How Profiles Are Used

The settings are loaded in `apps/fm-app/fm_app/config.py` and `apps/db-meta/dbmeta_app/config.py`:

```python
from fm_app.config import get_settings

settings = get_settings()

# Access default profile
user = settings.database_wh_user
port = settings.database_wh_port

# Access specific profile (uppercase suffix becomes lowercase attribute)
user_v2 = settings.database_wh_user_v2
port_postgres = settings.database_wh_port_postgres
port_trino = settings.database_wh_port_trino
```

### Dynamic Profile Selection

To use a specific profile at runtime:

```python
# In fm_app/api/db_session.py
def get_warehouse_engine(profile: str = "wh"):
    """Get SQLAlchemy engine for specified warehouse profile."""
    settings = get_settings()
    
    # Build connection URL based on profile
    if profile == "wh_postgres":
        url = f"postgresql+psycopg2://{settings.database_wh_postgres_user}:{settings.database_wh_postgres_pass}@{settings.database_wh_postgres_server}:{settings.database_wh_postgres_port}/{settings.database_wh_postgres_db}"
    elif profile == "wh_trino":
        url = f"trino://{settings.database_wh_trino_user}@{settings.database_wh_trino_server}:{settings.database_wh_trino_port}/{settings.database_wh_trino_db}"
    # ... etc
    
    return create_engine(url)
```

## Deployment Steps

### 1. Update ConfigMaps

```bash
# Edit the patch file for your environment
vim apps/fm-app/k8s/overlays/local/patch-config.yml

# Add the new profile configurations
```

### 2. Apply Changes

```bash
# Apply fm-app config
kubectl apply -k apps/fm-app/k8s/overlays/local

# Apply db-meta config  
kubectl apply -k apps/db-meta/k8s/overlays/local

# Restart deployments to pick up new config
kubectl rollout restart -n local deployment/fm-app
kubectl rollout restart -n local deployment/dbmeta-app
```

### 3. Verify Configuration

```bash
# Check fm-app sees the new profiles
kubectl exec -n local deployment/fm-app -c fm-app -- env | grep DATABASE_WH_POSTGRES

# Check db-meta sees the new profiles
kubectl exec -n local deployment/dbmeta-app -- env | grep DATABASE_WH_POSTGRES
```

## Testing Profile Selection

### API Request with Profile

When making requests to fm-app API, specify the profile:

```bash
# Query using Postgres warehouse
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "profile": "wh_postgres",
    "query": "SELECT COUNT(*) FROM trades"
  }'

# Query using Trino
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{
    "profile": "wh_trino",
    "query": "SELECT COUNT(*) FROM trades"
  }'
```

### MCP Server Profile

When calling db-meta MCP server:

```python
# Get schema for Postgres profile
result = await client.call_tool(
    "prompt_items",
    {
        "req": {
            "user_request": "Show me the trades table",
            "db": "wh_postgres"
        }
    }
)
```

## Environment-Specific Configurations

### Local Development

- Use service names: `postgres-wh`, `trino`, `clickhouse`
- Simple passwords in ConfigMap (not production-grade)

### Cloud Production

- Use actual IPs or DNS names
- Store passwords in Secrets, reference in ConfigMap:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: warehouse-secrets
  namespace: prod
type: Opaque
stringData:
  wh-postgres-pass: '<actual-secure-password>'
  wh-trino-pass: '<actual-secure-password>'
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: fm-cfg
data:
  DATABASE_WH_POSTGRES_USER: 'wh_user'
  DATABASE_WH_POSTGRES_SERVER: 'warehouse-db.example.com'
  # Password comes from secret via envFrom
```

## Complete Setup Commands

### Deploy All Warehouses

```bash
# 1. Deploy Postgres warehouse
kubectl apply -f infra/k8s/local/postgres-warehouse.yml
kubectl wait --for=condition=ready pod -l app=postgres-wh -n local

# 2. Deploy Trino
kubectl apply -f infra/k8s/local/trino.yml
kubectl wait --for=condition=ready pod -l app=trino -n local

# 3. Update ConfigMaps (edit files first)
kubectl apply -k apps/fm-app/k8s/overlays/local
kubectl apply -k apps/db-meta/k8s/overlays/local

# 4. Restart services
kubectl rollout restart -n local deployment/fm-app
kubectl rollout restart -n local deployment/dbmeta-app

# 5. Verify
kubectl get pods -n local
kubectl get svc -n local
```

### Test Each Warehouse

```bash
# Test Postgres
kubectl port-forward -n local svc/postgres-wh 5433:5432
PGPASSWORD=wh_password_123 psql -h localhost -p 5433 -U wh_user -d warehouse -c "SELECT COUNT(*) FROM trades;"

# Test Trino
kubectl port-forward -n local svc/trino 8081:8080
curl http://localhost:8081/v1/info

# Query via Trino CLI
kubectl exec -it -n local deployment/trino -- trino --catalog postgresql --schema public
```

## Troubleshooting

### Profile Not Found

**Error:** `AttributeError: 'Settings' object has no attribute 'database_wh_postgres_user'`

**Solution:** Make sure the ConfigMap has the exact variable names and restart the deployment.

### Connection Refused

**Error:** `Connection refused` when connecting to warehouse

**Solution:** 
1. Check service is running: `kubectl get svc -n local`
2. Verify DNS: `kubectl exec -it deployment/fm-app -- nslookup postgres-wh`
3. Check port: `kubectl exec -it deployment/fm-app -- nc -zv postgres-wh 5432`

### Wrong Dialect Detected

**Error:** Queries fail because wrong SQL dialect is used

**Solution:** Check driver string matches database type:
- ClickHouse: `clickhouse+native`
- Postgres: `postgresql+psycopg2`
- Trino: `trino`

## Summary

To add a new warehouse profile:
1. ✅ Choose profile name (e.g., `wh_postgres`, `wh_trino`)
2. ✅ Add 7 config variables with the profile suffix
3. ✅ Deploy the warehouse database
4. ✅ Update ConfigMaps for fm-app and db-meta
5. ✅ Restart deployments
6. ✅ Test with API requests specifying the profile
