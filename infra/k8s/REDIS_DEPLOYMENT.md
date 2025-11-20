# Redis Cache Deployment Guide

This guide explains how to deploy Redis for db-meta caching in the semantic-grid cluster.

## Overview

Redis is used as a caching layer for db-meta to speed up expensive operations:
- **Full schema introspection** (1 hour TTL)
- **Query EXPLAIN results** (10 minutes TTL)
- **Query examples** (30 minutes TTL)

## Architecture

- **Local dev**: Simple Deployment (no persistence, 128MB max memory)
- **Production**: StatefulSet with persistent storage (5GB PVC, 512MB max memory)
- **Eviction policy**: `allkeys-lru` (Least Recently Used eviction when max memory reached)
- **Persistence**: RDB snapshots every 60 seconds if ≥1 key changed (production only)

## Deployment Steps

### 1. Create Redis Password Secret

**For Production:**

```bash
# Generate a secure password
REDIS_PASSWORD=$(openssl rand -base64 32)

# Create the secret
kubectl create secret generic redis-secret \
  --from-literal=redis-password="$REDIS_PASSWORD" \
  -n semantic-grid-production

# Save password to your password manager!
echo "Redis password: $REDIS_PASSWORD"
```

**For Local Development:**

```bash
# Use a simple password for local dev
kubectl create secret generic redis-secret \
  --from-literal=redis-password="localdev123" \
  -n default
```

**Or use the template file:**

```bash
# Edit the secret template first!
# infra/environments/prod/k8s/secrets/redis-secret.yml

# Apply it
kubectl apply -f infra/environments/prod/k8s/secrets/redis-secret.yml
```

### 2. Deploy Redis

**For Production:**

```bash
kubectl apply -f infra/environments/prod/k8s/base/redis.yml
```

**For Local Development:**

```bash
kubectl apply -f infra/k8s/local/redis.yml
```

### 3. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=redis -n semantic-grid-production

# Check service
kubectl get svc redis -n semantic-grid-production

# Test connection (production)
kubectl exec -it redis-0 -n semantic-grid-production -- redis-cli -a $(kubectl get secret redis-secret -n semantic-grid-production -o jsonpath='{.data.redis-password}' | base64 -d) ping
# Should return: PONG
```

### 4. Update db-meta Configuration

Add Redis connection settings to db-meta ConfigMap or environment variables:

```yaml
env:
  - name: REDIS_HOST
    value: "redis"
  - name: REDIS_PORT
    value: "6379"
  - name: REDIS_PASSWORD
    valueFrom:
      secretKeyRef:
        name: redis-secret
        key: redis-password
  - name: REDIS_CACHE_ENABLED
    value: "true"
```

**For production (wifiqm):**

Update `apps/db-meta/k8s/wifiqm/config/db-meta.yml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: db-meta-config
  namespace: semantic-grid-production
data:
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  REDIS_CACHE_ENABLED: "true"
```

And update the deployment to reference the secret:

```yaml
# In apps/db-meta/k8s/wifiqm/db-meta.yml
env:
  - name: REDIS_PASSWORD
    valueFrom:
      secretKeyRef:
        name: redis-secret
        key: redis-password
```

## Monitoring

### Check Redis Stats

```bash
# Production
kubectl exec -it redis-0 -n semantic-grid-production -- redis-cli -a $REDIS_PASSWORD info stats

# Check memory usage
kubectl exec -it redis-0 -n semantic-grid-production -- redis-cli -a $REDIS_PASSWORD info memory

# Check connected clients
kubectl exec -it redis-0 -n semantic-grid-production -- redis-cli -a $REDIS_PASSWORD client list
```

### Check Cache Hit Rate

```bash
# Get keyspace stats
kubectl exec -it redis-0 -n semantic-grid-production -- redis-cli -a $REDIS_PASSWORD info stats | grep keyspace
```

### View Cached Keys

```bash
# List all keys (be careful in production!)
kubectl exec -it redis-0 -n semantic-grid-production -- redis-cli -a $REDIS_PASSWORD --scan

# Count keys
kubectl exec -it redis-0 -n semantic-grid-production -- redis-cli -a $REDIS_PASSWORD dbsize
```

## Resource Configuration

### Production Settings

- **CPU**: 200m request, 1000m limit
- **Memory**: 256Mi request, 1Gi limit
- **Max Redis Memory**: 512MB (with LRU eviction)
- **Storage**: 5Gi persistent volume (gp3)
- **Replicas**: 1 (can scale horizontally if needed)

### Local Development Settings

- **CPU**: 50m request, 250m limit
- **Memory**: 64Mi request, 256Mi limit
- **Max Redis Memory**: 128MB (with LRU eviction)
- **Storage**: None (ephemeral)

## Troubleshooting

### Pod Won't Start

```bash
# Check pod logs
kubectl logs redis-0 -n semantic-grid-production

# Check events
kubectl describe pod redis-0 -n semantic-grid-production
```

### Connection Issues

```bash
# Test from another pod in the cluster
kubectl run -it --rm redis-test --image=redis:7-alpine --restart=Never -n semantic-grid-production -- redis-cli -h redis -p 6379 -a $REDIS_PASSWORD ping
```

### Clear Cache

```bash
# Flush all cached data (use with caution!)
kubectl exec -it redis-0 -n semantic-grid-production -- redis-cli -a $REDIS_PASSWORD flushall
```

### Check Persistence

```bash
# Check RDB file
kubectl exec -it redis-0 -n semantic-grid-production -- ls -lh /data/

# Force save
kubectl exec -it redis-0 -n semantic-grid-production -- redis-cli -a $REDIS_PASSWORD bgsave
```

## Security Notes

1. **Never commit passwords** - Use Kubernetes Secrets
2. **Rotate passwords regularly** - Update secret and restart Redis
3. **Network policy** - Consider adding NetworkPolicy to restrict access to db-meta only
4. **TLS** - For extra security, consider enabling Redis TLS (requires additional configuration)

## Scaling Considerations

### Vertical Scaling

If you need more memory:

```bash
# Edit the StatefulSet
kubectl edit statefulset redis -n semantic-grid-production

# Update maxmemory and resource limits
```

### Horizontal Scaling (Future)

For high availability, consider:
- Redis Sentinel (automatic failover)
- Redis Cluster (sharding)
- Managed Redis service (AWS ElastiCache, etc.)

## Connection String Format

From db-meta application:

```python
# Without password
redis://redis:6379

# With password
redis://:password@redis:6379

# Using settings
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<from-secret>
```

## Next Steps

After deploying Redis:

1. ✅ Deploy Redis StatefulSet
2. ✅ Create password secret
3. ✅ Verify Redis is running
4. ⬜ Update db-meta configuration
5. ⬜ Deploy updated db-meta
6. ⬜ Monitor cache hit rates
7. ⬜ Adjust TTLs based on usage patterns
