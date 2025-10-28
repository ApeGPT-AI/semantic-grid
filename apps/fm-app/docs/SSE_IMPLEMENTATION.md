# SSE Real-Time Updates Implementation

**Date:** 2025-10-27
**Branch:** feat/sse-real-time-updates
**Status:** Backend complete, frontend integration pending

## Overview

Implemented Server-Sent Events (SSE) for real-time request status updates, replacing the existing polling mechanism. This provides truly real-time updates with lower latency and reduced server load.

## Architecture

**Approach:** PostgreSQL NOTIFY + SSE (Option 1 from architecture discussion)

### Components

1. **PostgreSQL Trigger** (`notify_request_status_update`)
   - Fires on INSERT or UPDATE of `request` table
   - Sends notifications only when status, response, or error changes
   - Emits pg_notify to `request_update` channel with JSON payload

2. **SSE Endpoint** (`/api/sse/{session_id}`)
   - Listens to PostgreSQL notifications via asyncpg
   - Filters notifications by session_id
   - Streams events to connected clients
   - Handles disconnections and errors gracefully

3. **Database Index** (`idx_request_session_updated`)
   - Optimizes queries by session_id + updated_at
   - Supports efficient SSE queries

## Files Changed

### New Files

- `alembic/versions/b725927e9e64_add_request_status_notify_trigger.py`
  - Migration with both upgrade() and downgrade()
  - Creates trigger, trigger function, and index
  - Full cleanup on downgrade

- `docs/SSE_IMPLEMENTATION.md`
  - Comprehensive documentation for SSE implementation
  - Migration strategy and deployment guidance

### Modified Files

- `fm_app/api/routes.py`
  - Added SSE endpoint at `/api/sse/{session_id}`
  - Imports: asyncio, asyncpg, EventSourceResponse
  - Function rename: `get_query_data` → `get_query_metadata` (route `/query/{query_id}`)

- `Dockerfile`
  - **CRITICAL FIX**: Added `alembic.ini` and `alembic/` directory to Docker image
  - Fixes: "No config file 'alembic.ini' found" error in K8s deployments
  - Allows `run.sh` to execute `alembic upgrade head` on container startup

- `pyproject.toml`
  - Added `sse-starlette==2.2.1`
  - Updated `starlette>=0.41.3` (was ==0.41.2)
  - Updated `anyio>=4.7.0` (was ==4.6.2.post1)

- `bulk_test/pyproject.toml`
  - Updated `starlette>=0.41.3` (was ==0.41.2)
  - Updated `anyio>=4.7.0` (was ==4.6.2.post1)

- `uv.lock`
  - Updated anyio: 4.6.2.post1 → 4.11.0
  - Updated sse-starlette: 2.1.3 → 2.2.1
  - Updated starlette: 0.41.2 → 0.41.3

## Trigger Payload Structure

```json
{
  "request_id": "uuid",
  "session_id": "uuid",
  "status": "pending|in_progress|done|error",
  "updated_at": 1234567890.123,
  "has_response": true,
  "has_error": false,
  "sequence_number": 1
}
```

## SSE Event Types

1. **connected** - Initial connection established
   ```json
   {
     "session_id": "uuid",
     "timestamp": 1234567890.123
   }
   ```

2. **request_update** - Request status changed
   ```json
   {
     "request_id": "uuid",
     "session_id": "uuid",
     "status": "done",
     "updated_at": 1234567890.123,
     "has_response": true,
     "has_error": false,
     "sequence_number": 1
   }
   ```

3. **error** - Server error occurred
   ```json
   {
     "error": "Internal server error",
     "session_id": "uuid"
   }
   ```

4. **keep-alive** - SSE comment sent every 5 seconds when no updates

## Key Features

### Performance
- **Connection pooling**: Uses asyncpg for efficient PostgreSQL connections
- **Session filtering**: Only sends notifications for the requested session
- **Keep-alive**: Prevents connection timeouts with 5-second heartbeats
- **No polling overhead**: Database-driven push notifications

### Reliability
- **Graceful disconnection**: Detects client disconnect and cleans up
- **Error handling**: Catches and logs all errors, sends error events to client
- **Connection cleanup**: Properly closes PostgreSQL connection in finally block
- **Cancellation-safe**: Handles asyncio.CancelledError correctly

### Security
- **Authentication required**: Uses `verify_any_token` dependency
- **Session-based filtering**: Users only receive updates for their own sessions
- **No data leakage**: Each SSE connection filters by session_id

## Testing

### Manual Testing
1. Start local database: `docker compose up -d`
2. Apply migration: `alembic upgrade head`
3. Start server: `uvicorn fm_app.main:app --reload`
4. Connect to SSE endpoint:
   ```bash
   curl -N -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/sse/<session-id>
   ```
5. Trigger request update in another terminal/window
6. Observe real-time events in SSE stream

### Testing Downgrade
```bash
alembic downgrade -1
alembic upgrade head
```

## Migration Notes

### Upgrading
```sql
-- Creates trigger function
CREATE OR REPLACE FUNCTION notify_request_status_update() ...

-- Creates trigger on request table
CREATE TRIGGER request_status_update_trigger ...

-- Creates performance index
CREATE INDEX IF NOT EXISTS idx_request_session_updated ...
```

### Downgrading
```sql
DROP TRIGGER IF EXISTS request_status_update_trigger ON request;
DROP FUNCTION IF EXISTS notify_request_status_update();
DROP INDEX IF EXISTS idx_request_session_updated;
```

## Next Steps (Frontend Integration)

### Strategy: Gradual Migration with Backward Compatibility

**IMPORTANT**: Keep existing polling code functional! Both mechanisms should coexist to allow:
- Testing SSE without breaking existing functionality
- Easy rollback if issues are discovered
- Gradual migration per feature/user
- Development and debugging flexibility

### Implementation Approach

1. **Add SSE support alongside polling** (`apps/web`):
   - Keep existing `pollForResponse()` function intact
   - Add new `connectSSE()` function as an alternative
   - Use feature flag or environment variable to choose mechanism
   - Default to polling initially, opt-in to SSE

2. **Example SSE Client Code** (add, don't replace):
   ```typescript
   // New function - add to app/helpers/chat.ts
   export const connectSSE = (
     sessionId: string,
     onUpdate: (update: RequestUpdate) => void,
     onError?: (error: Error) => void
   ): EventSource => {
     const eventSource = new EventSource(
       `/api/sse/${sessionId}`,
       { withCredentials: true }
     );

     eventSource.addEventListener('connected', (e) => {
       console.log('SSE connected', JSON.parse(e.data));
     });

     eventSource.addEventListener('request_update', (e) => {
       const update = JSON.parse(e.data);
       onUpdate(update);
     });

     eventSource.addEventListener('error', (e) => {
       console.error('SSE error', e);
       eventSource.close();
       onError?.(new Error('SSE connection failed'));
       // Could fallback to polling here
     });

     return eventSource;
   };

   // Keep existing pollForResponse() unchanged
   export const pollForResponse = (...) => {
     // Existing polling code stays as-is
   };
   ```

3. **Feature Flag Pattern**:
   ```typescript
   const USE_SSE = process.env.NEXT_PUBLIC_USE_SSE === 'true';

   if (USE_SSE) {
     const eventSource = connectSSE(sessionId, handleUpdate);
     // Store eventSource for cleanup
   } else {
     const polling = pollForResponse({ sessionId, seqNum });
     // Use existing polling mechanism
   }
   ```

4. **Hybrid Approach** (recommended for production):
   ```typescript
   // Try SSE first, fallback to polling on error
   try {
     const eventSource = connectSSE(
       sessionId,
       handleUpdate,
       (error) => {
         console.warn('SSE failed, falling back to polling', error);
         const polling = pollForResponse({ sessionId, seqNum });
       }
     );
   } catch (error) {
     console.warn('SSE not available, using polling', error);
     const polling = pollForResponse({ sessionId, seqNum });
   }
   ```

### Migration Timeline

**Phase 1 - Testing** (current):
- SSE endpoint available but not used
- All traffic uses existing polling
- Manual testing of SSE endpoint via curl/browser

**Phase 2 - Opt-in**:
- Add SSE client code alongside polling
- Use feature flag to enable SSE for testing
- Monitor performance, errors, connection stability

**Phase 3 - Gradual Rollout**:
- Enable SSE for subset of users/sessions
- Collect metrics: latency, connection count, error rates
- Keep polling as fallback mechanism

**Phase 4 - Default to SSE** (future):
- Make SSE the default mechanism
- Keep polling as fallback for compatibility
- Consider deprecation timeline for polling (6+ months)

**Phase 5 - Cleanup** (distant future, optional):
- After 6+ months of stable SSE operation
- Remove polling code if metrics show 100% SSE adoption
- Only if business requirements allow breaking change

## Deployment Considerations

### Zero-Downtime Deployment

- **Migration**: Must be applied before deploying new code
- **Backward compatibility**: Old clients using polling will continue to work indefinitely
- **No breaking changes**: SSE is purely additive, existing functionality unchanged
- **Safe rollback**: Can roll back deployment without database migration rollback

### Database Connections

- **Each SSE connection**: Uses one PostgreSQL connection from asyncpg
- **Polling connections**: Continue to use SQLAlchemy connection pool
- **Monitor**: Track total connection count across both mechanisms
- **Scale**: Increase `max_connections` in PostgreSQL if needed
- **Connection limit**: Consider setting max concurrent SSE connections per instance

### Proxy Configuration

Ensure reverse proxy (nginx/ALB/CloudFlare) supports SSE:
- Set appropriate timeout values (>60 seconds recommended)
- Disable response buffering for `/api/sse/*` endpoints
- Enable keep-alive for SSE connections

### Example nginx Configuration

```nginx
location /api/sse/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;  # 1 hour
    proxy_send_timeout 3600s;
}
```

### Monitoring and Metrics

Track these metrics during rollout:

**SSE Metrics**:
- Active SSE connections count
- SSE connection duration (histogram)
- SSE error rate
- Notifications sent per session
- Client disconnection reasons

**Polling Metrics** (continue tracking):
- Poll request count
- Poll request latency
- Poll cache hit rate

**Comparison Metrics**:
- Average latency: polling vs SSE
- Server CPU/memory: before and after
- Database connection pool usage
- User-perceived update latency

### Feature Flag Configuration

Recommended environment variables for gradual rollout:

```bash
# Backend (optional - SSE always available)
ENABLE_SSE_ENDPOINT=true  # Already enabled by default

# Frontend
NEXT_PUBLIC_USE_SSE=false  # Default to polling
NEXT_PUBLIC_SSE_FALLBACK=true  # Fallback to polling on SSE error
NEXT_PUBLIC_SSE_ROLLOUT_PERCENT=0  # Gradual rollout: 0-100

# Monitoring
NEXT_PUBLIC_TRACK_SSE_METRICS=true
```

## References

- [PostgreSQL NOTIFY/LISTEN Documentation](https://www.postgresql.org/docs/current/sql-notify.html)
- [SSE Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [sse-starlette Documentation](https://github.com/sysid/sse-starlette)
- [EventSource API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

## Industry Comparison

This implementation follows the same pattern as:
- **LangSmith**: Uses SSE for streaming LLM responses and agent execution updates
- **OpenAI Agents SDK**: Uses SSE for streaming agent events (threads, messages, runs)
- **Anthropic MCP**: Uses SSE for streaming model responses and tool calls

All major AI platforms use SSE + event-driven architecture for real-time updates, confirming this is the industry-standard approach.
