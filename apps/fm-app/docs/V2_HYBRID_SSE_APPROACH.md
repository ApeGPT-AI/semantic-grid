# V2 Hybrid SSE Architecture

**Date:** 2025-01-09  
**Status:** Design Complete, Implementation Partial  
**Migration:** `be04411eab45_add_v2_message_notify_trigger.py`

## Overview

V2 uses a **hybrid SSE approach** combining the best of v1's PostgreSQL NOTIFY with new in-memory EventBus for fine-grained progress updates.

This provides both:
- ✅ **Reliability**: Persistent events survive worker crashes (PostgreSQL NOTIFY)
- ✅ **Rich UX**: Detailed progress updates for modern AI interfaces (EventBus)

---

## Architecture Comparison

### V1 SSE (Request-Based)

**Mechanism:** PostgreSQL NOTIFY only

```
User Request → Worker Processes → Updates request table → PG NOTIFY → SSE Client
                                   (status changes only)
```

**Events:**
- Request status changes: `pending` → `in_progress` → `done` → `error`
- Coarse-grained: Only WHEN status changes, not WHAT agent is doing

**Payload:**
```json
{
  "request_id": "uuid",
  "session_id": "uuid",
  "status": "done",
  "has_response": true,
  "has_error": false
}
```

**UX:** Simple status indicator, black box between start and completion

---

### V2 SSE (Message-Based, Hybrid)

**Mechanism:** PostgreSQL NOTIFY + In-Memory EventBus

```
User Message → Worker Processes → Two event streams:
                                   
1. Persistent Events (DB writes) → PG NOTIFY → SSE Client
   - Message created/completed/failed
   
2. Transient Events (in-memory) → EventBus → SSE Client
   - Thinking, validating, tool calls, etc.
```

**Event Types:**

**Persistent** (via PostgreSQL NOTIFY on `v2_message_update` channel):
```json
{
  "message_id": "uuid",
  "session_id": "uuid",
  "role": "assistant",
  "kind": "chat",
  "status": "completed",
  "has_error": false,
  "operation": "UPDATE"
}
```

**Transient** (via EventBus):
```json
{
  "event_type": "llm_thinking",
  "level": "info",
  "message": "Analyzing your request...",
  "step": 3,
  "total_steps": 6,
  "progress_percent": 50.0
}
```

**UX:** Modern AI interface with step-by-step progress, like ChatGPT/Claude

---

## Implementation

### 1. Database Trigger (Persistent Events)

**Migration:** `be04411eab45_add_v2_message_notify_trigger.py`

```sql
CREATE FUNCTION notify_v2_message_update() RETURNS trigger AS $$
BEGIN
    IF (TG_OP = 'INSERT') 
       OR (OLD.status IS DISTINCT FROM NEW.status)
       OR (OLD.error IS DISTINCT FROM NEW.error) THEN
        
        PERFORM pg_notify('v2_message_update', json_build_object(
            'message_id', NEW.id,
            'session_id', NEW.session_id::text,
            'role', NEW.role,
            'kind', NEW.kind,
            'status', NEW.status,
            'has_error', (NEW.error IS NOT NULL),
            'created_at', EXTRACT(EPOCH FROM NEW.created_at),
            'operation', TG_OP
        )::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER v2_message_update_trigger
AFTER INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_v2_message_update();
```

**When it fires:**
- Message inserted (new assistant response)
- Message status changes (`pending` → `processing` → `completed`/`failed`)
- Message error field changes

---

### 2. EventBus (Transient Events)

**File:** `fm_app/workers/v2/event_bus.py`

**Architecture:**
```python
class EventBus:
    # Session ID → Set of asyncio.Queue instances
    _listeners: Dict[UUID, Set[asyncio.Queue]]
    
    async def emit(event: AgentEvent):
        # Send to all queues for this session
        
    async def subscribe(session_id: UUID) -> asyncio.Queue:
        # Return queue that receives events
```

**Worker Usage:**
```python
emitter = EventEmitter(session_id=session_id, message_id=message_id)
emitter.set_total_steps(6)

await emitter.task_started()           # Step 1
await emitter.intent_analyzing()       # Step 2
await emitter.llm_thinking("...")      # Step 3
await emitter.tool_calling("db-meta", "...") # Step 4
await emitter.sql_validating()         # Step 5
await emitter.artifact_saving()        # Step 6
await emitter.task_completed()         # Done
```

---

### 3. SSE Endpoint (Hybrid)

**File:** `fm_app/api/v2/routes.py`

**Endpoint:** `GET /api/v2/sessions/{session_id}/stream`

**TODO: Implementation needs update to hybrid mode**

Current implementation only uses EventBus. Needs to be updated to:

```python
async def event_generator():
    # Subscribe to both sources
    event_queue = await event_bus.subscribe(session_id)
    pg_conn = await asyncpg.connect(db_url)
    await pg_conn.add_listener('v2_message_update', callback)
    
    while True:
        # Wait for events from either source
        done, pending = await asyncio.wait([
            event_queue.get(),      # Transient events
            notify_queue.get()      # Persistent events
        ], return_when=asyncio.FIRST_COMPLETED)
        
        # Yield appropriate event type
        if event_from_eventbus:
            yield {"event": "agent_status", "data": ...}
        elif event_from_postgres:
            yield {"event": "message_update", "data": ...}
```

---

## Event Flow Example

**User asks:** "What wallets held the most USDC on February 1st?"

### Transient Events (EventBus):
```
1. task_started → "Starting to process your request..."
2. intent_analyzing → "Understanding your request..."
3. intent_analyzed → "I understand: Find top USDC holders on Feb 1"
4. llm_thinking → "Building context from conversation history"
5. llm_thinking → "Analyzing your request and formulating response"
6. llm_responded → "Response generated"
7. artifact_saving → "Saving results..."
8. artifact_saved → "Results saved"
9. task_completed → "Request completed successfully"
```

### Persistent Events (PostgreSQL NOTIFY):
```
1. message_update → {message_id: "...", status: "pending", operation: "INSERT"}
2. message_update → {message_id: "...", status: "processing", operation: "UPDATE"}
3. message_update → {message_id: "...", status: "completed", operation: "UPDATE"}
```

**Frontend sees:** Mix of both - detailed progress PLUS reliable state updates

---

## Worker Crash Recovery

### Problem

**Scenario:**
1. User sends message → creates `message` with `status=PENDING`
2. Celery task starts → updates to `status=PROCESSING`
3. **Worker crashes** (OOM, network failure, pod eviction)
4. Message stuck at `status=PROCESSING` forever
5. User's SSE connection sees no updates, waits indefinitely

### Solution: Multi-Layered Recovery

#### Layer 1: Celery Auto-Retry (Immediate)

**File:** `fm_app/workers/worker.py`

```python
@app.task(
    name="wrk_process_message_v2",
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 5},
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True
)
def wrk_process_message_v2(args):
    """V2 worker with automatic retry on failure."""
    return asyncio.get_event_loop().run_until_complete(_wrk_process_message_v2(args))

async def _wrk_process_message_v2(args):
    request = WorkerMessageRequest(**args)
    async for db in get_db():
        try:
            worker = await get_worker()
            response = await worker.process_message(request, db)
            return response
        except Exception as e:
            # Update message status to FAILED after max retries
            await update_message_status(
                message_id=request.message_id,
                status=MessageStatus.FAILED,
                error=f"Worker crash: {str(e)}",
                db=db
            )
            raise  # Re-raise for Celery retry logic
```

**Behavior:**
- Worker crashes → Celery retries task (up to 3 times)
- If all retries fail → marks message as `FAILED`
- PostgreSQL NOTIFY sends `message_update` event with `status=failed`
- User sees error via SSE

#### Layer 2: Timeout Monitor (Background)

**File:** `fm_app/workers/v2/timeout_monitor.py` (NEW)

```python
async def monitor_stuck_messages():
    """
    Background task that monitors for messages stuck in PROCESSING.
    
    Runs every 5 minutes, marks messages as FAILED if processing for >10 minutes.
    """
    while True:
        await asyncio.sleep(300)  # 5 minutes
        
        async for db in get_db():
            # Find messages stuck in PROCESSING
            stuck_messages = await db.execute(
                select(Message).where(
                    Message.status == MessageStatus.PROCESSING,
                    Message.created_at < datetime.utcnow() - timedelta(minutes=10)
                )
            )
            
            for msg in stuck_messages.scalars():
                logger.warning(
                    "Detected stuck message, marking as failed",
                    message_id=str(msg.id),
                    session_id=str(msg.session_id),
                    age_minutes=(datetime.utcnow() - msg.created_at).total_seconds() / 60
                )
                
                # Mark as failed
                await update_message_status(
                    message_id=msg.id,
                    status=MessageStatus.FAILED,
                    error="Processing timeout - worker may have crashed",
                    db=db
                )
                
                # PostgreSQL trigger will send NOTIFY automatically
```

**Deployment:**
```python
# In main.py or worker.py startup
@app.on_event("startup")
async def startup_monitor():
    asyncio.create_task(monitor_stuck_messages())
```

**Behavior:**
- Runs continuously in background
- Every 5 minutes, checks for messages in `PROCESSING` for >10 minutes
- Marks them as `FAILED` with timeout error
- PostgreSQL NOTIFY sends update to connected SSE clients

#### Layer 3: Client-Side Timeout (Frontend)

**File:** `apps/web/app/helpers/chat.ts`

```typescript
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let processingStartTime: number | null = null;
let timeoutCheckInterval: NodeJS.Timeout | null = null;

eventSource.addEventListener('agent_status', (e) => {
  const event = JSON.parse(e.data);
  
  // Start timeout timer on first processing event
  if (event.event_type === 'task_started' && !processingStartTime) {
    processingStartTime = Date.now();
    
    // Check for timeout every 30 seconds
    timeoutCheckInterval = setInterval(() => {
      if (processingStartTime && Date.now() - processingStartTime > PROCESSING_TIMEOUT_MS) {
        clearInterval(timeoutCheckInterval!);
        showError('Request timed out. The system may be experiencing issues.');
        eventSource.close();
      }
    }, 30000);
  }
  
  // Clear timeout on completion
  if (event.event_type === 'task_completed' || event.event_type === 'task_failed') {
    processingStartTime = null;
    if (timeoutCheckInterval) {
      clearInterval(timeoutCheckInterval);
      timeoutCheckInterval = null;
    }
  }
});
```

**Behavior:**
- Frontend independently tracks processing time
- Shows error to user if no completion after 10 minutes
- Closes SSE connection (saves resources)
- User can retry their request

---

## Failure Modes and Recovery

| Failure | Detection | Recovery | User Experience |
|---------|-----------|----------|-----------------|
| **Worker OOM crash** | Celery detects task failure | Retry up to 3x, then mark FAILED | See retries as transient events, then error message |
| **Network partition** | Celery health check | Retry on different worker | Brief pause, then continues |
| **Database connection lost** | Worker exception | Retry with backoff | May see multiple retry attempts |
| **Worker hangs (deadlock)** | Timeout monitor (10 min) | Mark as FAILED | Sees progress stop, then timeout error after 10min |
| **SSE connection dropped** | Client detects disconnect | Reconnect to SSE, fetch latest messages | Brief pause, resumes from latest state |
| **Entire cluster down** | Multiple layers fail | Manual intervention needed | Error after client timeout (10min) |

---

## Benefits of Hybrid Approach

### Compared to PostgreSQL NOTIFY Only:
- ✅ **Richer UX**: Users see detailed progress, not just status changes
- ✅ **Modern AI Interface**: Matches ChatGPT/Claude/LangSmith UX
- ✅ **Lower DB load**: Transient events don't hit database

### Compared to EventBus Only:
- ✅ **Crash resilient**: Important state persisted in database
- ✅ **Multi-worker support**: PostgreSQL NOTIFY works across processes
- ✅ **Audit trail**: Can query message history after the fact
- ✅ **Client reconnection**: Can catch up on missed persistent events

### Best of Both Worlds:
- **Transient events**: Fast, in-memory, rich detail (thinking, validating, etc.)
- **Persistent events**: Reliable, durable, critical state (message created/completed/failed)

---

## Migration Path

### Phase 1: Apply Migration ✅
```bash
alembic upgrade head
```

Creates `notify_v2_message_update()` function and trigger on `messages` table.

### Phase 2: Update SSE Endpoint ⏳
Update `stream_agent_events()` to listen to both:
- EventBus (transient events)
- PostgreSQL NOTIFY `v2_message_update` channel (persistent events)

### Phase 3: Add Timeout Monitor ⏳
Implement background task to mark stuck messages as FAILED.

### Phase 4: Add Celery Retry Config ⏳
Update Celery task with `autoretry_for` and backoff settings.

### Phase 5: Frontend Integration ⏳
Update SSE client to handle both event types:
- `agent_status` → Show in progress indicator
- `message_update` → Update message list, handle failures

### Phase 6: Monitoring ⏳
Add metrics for:
- Worker retry rate
- Timeout monitor triggers
- Average message processing time
- SSE connection duration

---

## Testing Crash Recovery

### Simulate Worker Crash:

```bash
# Terminal 1: Start SSE connection
curl -N -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v2/sessions/<session-id>/stream

# Terminal 2: Send message
curl -X POST http://localhost:8000/api/v2/sessions/<session-id>/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test crash recovery", "kind": "chat"}'

# Terminal 3: Kill worker process during processing
ps aux | grep celery
kill -9 <worker-pid>

# Observe:
# - Terminal 1 should see retry events via EventBus (if worker restarts quickly)
# - OR see message_update with status=failed (after retries exhausted)
# - OR see timeout after 10 minutes (if monitor detects stuck message)
```

### Expected Behavior:

**Scenario A: Quick restart (Celery retry succeeds)**
```
agent_status: task_started
agent_status: intent_analyzing
[CRASH]
[Celery retries on new worker]
agent_status: task_started (retry attempt 1)
agent_status: intent_analyzing
... continues normally ...
agent_status: task_completed
message_update: status=completed
```

**Scenario B: Retry fails after 3 attempts**
```
agent_status: task_started
[CRASH]
[Retry 1 - fails]
[Retry 2 - fails]
[Retry 3 - fails]
message_update: status=failed, error="Worker crash: ..."
```

**Scenario C: Worker completely dead, timeout monitor kicks in**
```
agent_status: task_started
[CRASH - no retries work]
[10 minutes pass]
message_update: status=failed, error="Processing timeout - worker may have crashed"
```

---

## Production Considerations

### Database Connections

**EventBus:** No database connections (in-memory only)

**PostgreSQL NOTIFY:** Each SSE connection uses 1 asyncpg connection
- Monitor total connection count: `SELECT count(*) FROM pg_stat_activity`
- Increase `max_connections` if needed
- Consider connection pooling for very high SSE connection counts

### Scaling

**Single worker deployment:**
- EventBus works fine (in-memory)
- PostgreSQL NOTIFY works fine
- No additional infrastructure needed

**Multi-worker deployment:**
- EventBus needs Redis pub/sub for cross-worker communication
- PostgreSQL NOTIFY already works across workers
- Deploy Redis for EventBus if running >1 worker pod

### Redis EventBus (Optional, for Multi-Worker)

```python
class RedisEventBus(EventBus):
    def __init__(self, redis_url: str):
        self.redis = aioredis.from_url(redis_url)
    
    async def emit(self, event: AgentEvent):
        # Publish to Redis
        await self.redis.publish(
            f"agent_events:{event.session_id}",
            event.json()
        )
    
    async def subscribe(self, session_id: UUID):
        # Subscribe to Redis channel
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(f"agent_events:{session_id}")
        # Forward to local queue
        queue = asyncio.Queue()
        asyncio.create_task(self._redis_to_queue(pubsub, queue))
        return queue
```

---

## Summary

The hybrid SSE approach provides:

1. **Reliable persistent events** via PostgreSQL NOTIFY (critical state changes)
2. **Rich transient events** via EventBus (progress, thinking, validation)
3. **Multi-layer crash recovery** (Celery retry + timeout monitor + client timeout)
4. **Consistent with v1** (same PostgreSQL NOTIFY pattern)
5. **Modern UX** (detailed progress like ChatGPT/Claude)

**Status:**
- ✅ Database trigger created
- ✅ EventBus implemented
- ⏳ SSE endpoint needs hybrid update
- ⏳ Timeout monitor needs implementation
- ⏳ Celery retry config needs update
- ⏳ Frontend integration pending

**Next Steps:**
1. Update SSE endpoint to hybrid mode
2. Implement timeout monitor
3. Add Celery retry configuration
4. Test crash recovery scenarios
5. Frontend integration
