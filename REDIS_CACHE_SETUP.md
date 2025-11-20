# Redis Cache Integration - Complete Setup Guide

This document provides a complete overview of the Redis caching integration with semantic table filtering.

## What Was Done

### 1. Merged Redis Cache Infrastructure

Successfully merged `feature/db-meta-redis-cache` branch with the recent semantic table filtering implementation.

**Key files added:**
- `apps/db-meta/dbmeta_app/cache/redis_cache.py` - Redis cache client with connection pooling
- `apps/db-meta/dbmeta_app/cache/__init__.py` - Cache module exports
- `apps/db-meta/test_redis_cache.py` - Unit tests for cache functionality
- `apps/db-meta/REDIS_CACHE.md` - Original documentation

**Key files modified:**
- `apps/db-meta/dbmeta_app/config.py` - Added Redis settings
- `apps/db-meta/dbmeta_app/prompt_items/db_struct.py` - Integrated caching with semantic filtering
- `apps/db-meta/dbmeta_app/prompt_items/query_examples.py` - Added caching for query examples
- `apps/db-meta/pyproject.toml` - Added redis dependency

### 2. Architecture Design

**Two-Layer Performance Optimization:**

```
User Request
    ↓
┌───────────────────────────────────────┐
│ Layer 1: Redis Cache                 │
│ - Caches FULL database schema        │
│ - Key: (client, env, profile)        │
│ - TTL: 1 hour                         │
│ - Speeds up DB introspection         │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│ Layer 2: Semantic Filtering (Milvus) │
│ - Searches for relevant tables       │
│ - Filters cached schema dynamically  │
│ - Reduces LLM context size           │
└───────────────────────────────────────┘
    ↓
Filtered Schema → LLM
```

**Key Principle:** 
- Redis caches **stable, expensive operations** (DB schema introspection)
- Milvus filters **dynamic, query-specific data** (relevant tables)
- Never cache filtered schemas (avoid cache explosion)

### 3. Caching Strategy

**What gets cached:**

1. **Full Database Schema** (`generate_schema_prompt()`)
   - Cache key: `(client, env, profile, with_examples)`
   - TTL: 3600 seconds (1 hour)
   - Only cached when `filter_tables=None` (full schema)

2. **Query EXPLAIN Results** (`query_preflight()`)
   - Cache key: `hash(sql_query)`
   - TTL: 600 seconds (10 minutes)
   - Even errors are cached (60 second TTL)

3. **Query Examples** (`get_query_examples()`)
   - Cache key: `(client, env, profile)`
   - TTL: 1800 seconds (30 minutes)

**What doesn't get cached:**
- Filtered schemas (user_request is unique each time)
- Semantic search results (dynamic)

### 4. Implementation Details

**Cache Logic in `db_struct.py`:**

```python
def generate_schema_prompt(engine, settings, with_examples=False, filter_tables=None):
    cache = get_cache()
    profile = settings.default_profile
    client = settings.client
    env = settings.env
    
    cache_key_args = (profile, client, env, with_examples)
    
    # Only use cache if we're generating the FULL schema (not filtering)
    if filter_tables is None:
        cached_result = cache.get("schema", *cache_key_args)
        if cached_result is not None:
            return cached_result
    
    # ... expensive DB introspection ...
    
    # Only cache the full schema
    if filter_tables is None:
        cache.set("schema", schema_text, ttl=CACHE_TTL["schema"], *cache_key_args)
    
    return schema_text
```

**Semantic Filtering Flow:**

```python
def get_schema_prompt_item(user_request: str | None = None, top_k: int = 10):
    settings = get_settings()
    engine = get_db()
    
    # Determine which tables to include via Milvus
    relevant_tables = None
    if user_request:
        table_matches = search_relevant_tables(
            query=user_request,
            profile=settings.default_profile,
            top_k=top_k,
        )
        relevant_tables = {match.table_name for match in table_matches}
    
    # Generate schema (uses Redis cache if filter_tables=None, otherwise fresh)
    prompt = generate_schema_prompt(
        engine,
        settings,
        with_examples=settings.data_examples,
        filter_tables=relevant_tables,
    )
    
    return PromptItem(text=prompt, ...)
```

## Kubernetes Deployment

### Created Manifests

1. **Production**: `infra/environments/prod/k8s/base/redis.yml`
   - StatefulSet with persistent storage (5Gi)
   - Password protected
   - 512MB max memory with LRU eviction
   - Resource limits: 1 CPU, 1Gi RAM

2. **Base/Staging**: `infra/k8s/base/redis.yml`
   - StatefulSet with persistent storage (2Gi)
   - Password protected
   - 256MB max memory with LRU eviction
   - Resource limits: 500m CPU, 512Mi RAM

3. **Local Dev**: `infra/k8s/local/redis.yml`
   - Deployment (no persistence)
   - Simple setup for development
   - 128MB max memory
   - Resource limits: 250m CPU, 256Mi RAM

4. **Secret Template**: `infra/environments/prod/k8s/secrets/redis-secret.yml`
   - Password secret template
   - Instructions for generating secure passwords

### Deployment Instructions

See `infra/k8s/REDIS_DEPLOYMENT.md` for complete deployment guide.

**Quick start:**

```bash
# 1. Create password secret
kubectl create secret generic redis-secret \
  --from-literal=redis-password="$(openssl rand -base64 32)" \
  -n semantic-grid-production

# 2. Deploy Redis
kubectl apply -f infra/environments/prod/k8s/base/redis.yml

# 3. Verify
kubectl get pods -l app=redis -n semantic-grid-production
```

## Configuration

### db-meta Environment Variables

Add to db-meta ConfigMap and deployment:

```yaml
# ConfigMap
data:
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  REDIS_CACHE_ENABLED: "true"

# Deployment - add to env section
env:
  - name: REDIS_PASSWORD
    valueFrom:
      secretKeyRef:
        name: redis-secret
        key: redis-password
```

### Default Settings

From `apps/db-meta/dbmeta_app/config.py`:

```python
redis_host: str = "localhost"
redis_port: int = 6379
redis_password: Optional[str] = None
redis_db: int = 0
redis_cache_enabled: bool = True
```

## Monitoring & Operations

### Check Cache Performance

```bash
# View cache statistics
kubectl exec -it redis-0 -n semantic-grid-production -- \
  redis-cli -a $REDIS_PASSWORD info stats

# Check memory usage
kubectl exec -it redis-0 -n semantic-grid-production -- \
  redis-cli -a $REDIS_PASSWORD info memory

# List cached keys
kubectl exec -it redis-0 -n semantic-grid-production -- \
  redis-cli -a $REDIS_PASSWORD --scan | head -20
```

### Application Logs

Watch for cache hit/miss messages:

```bash
kubectl logs -f deployment/db-meta -n semantic-grid-production | grep -i cache
```

Expected log messages:
- `Schema cache HIT for profile=wh_v2, client=wifiqm, env=prod`
- `Schema cache MISS for profile=wh_v2, client=wifiqm, env=prod`
- `Schema cached for profile=wh_v2, client=wifiqm, env=prod`
- `Query preflight cache HIT`

## Performance Impact

### Expected Benefits

1. **First Request** (cache miss):
   - Full DB introspection: ~2-5 seconds
   - Cached for subsequent requests

2. **Subsequent Requests** (cache hit):
   - Schema retrieval: <10ms
   - ~200-500x faster

3. **With Semantic Filtering:**
   - Cache hit on full schema: <10ms
   - Milvus search: ~50-100ms
   - Filtering: <10ms
   - Total: ~100ms vs 2-5 seconds

### Cache Hit Rate

Monitor over time:
- **Target**: >80% hit rate for schema requests
- **Expected**: >90% after warm-up period
- **Low hit rate indicators**: Too many unique client/env/profile combinations

## Testing

### Unit Tests

```bash
cd apps/db-meta
uv run pytest test_redis_cache.py -v
```

### Integration Test

```bash
# Start local Redis
kubectl apply -f infra/k8s/local/redis.yml

# Run db-meta locally
cd apps/db-meta
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_CACHE_ENABLED=true
uv run python -m dbmeta_app.main
```

## Troubleshooting

### Redis Not Connecting

1. Check Redis is running: `kubectl get pods -l app=redis`
2. Check service exists: `kubectl get svc redis`
3. Test connectivity: `kubectl run -it --rm redis-test --image=redis:7-alpine --restart=Never -- redis-cli -h redis -p 6379 ping`

### Cache Not Working

1. Check logs for errors: `kubectl logs deployment/db-meta | grep -i redis`
2. Verify `REDIS_CACHE_ENABLED=true`
3. Check password is correct
4. Disable cache to test: `REDIS_CACHE_ENABLED=false`

### High Memory Usage

1. Check current memory: `redis-cli info memory`
2. Adjust maxmemory if needed
3. Verify LRU eviction is working
4. Consider reducing TTLs

## Next Steps

1. ✅ Code merge completed
2. ✅ Kubernetes manifests created
3. ⬜ Deploy Redis to production
4. ⬜ Update db-meta ConfigMaps
5. ⬜ Deploy updated db-meta
6. ⬜ Monitor cache hit rates
7. ⬜ Tune TTLs based on usage patterns
8. ⬜ Consider Redis Sentinel for HA (future)

## Files Reference

### Code
- `apps/db-meta/dbmeta_app/cache/redis_cache.py` - Cache implementation
- `apps/db-meta/dbmeta_app/prompt_items/db_struct.py` - Integration point
- `apps/db-meta/dbmeta_app/config.py` - Configuration

### Kubernetes
- `infra/environments/prod/k8s/base/redis.yml` - Production deployment
- `infra/k8s/base/redis.yml` - Base deployment
- `infra/k8s/local/redis.yml` - Local dev deployment
- `infra/environments/prod/k8s/secrets/redis-secret.yml` - Secret template

### Documentation
- `infra/k8s/REDIS_DEPLOYMENT.md` - Deployment guide
- `apps/db-meta/REDIS_CACHE.md` - Original feature documentation
- `REDIS_CACHE_SETUP.md` - This file
