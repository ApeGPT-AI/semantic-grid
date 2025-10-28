# SSE Real-Time Updates Hook

## useSessionStatus

React hook for subscribing to real-time request status updates via Server-Sent Events (SSE).

### Basic Usage

```tsx
import { useSessionStatus } from "@/app/hooks/useSessionStatus";

function MyComponent({ sessionId }) {
  const { connectionStatus, latestUpdate, error } = useSessionStatus(
    sessionId,
    {
      onUpdate: (update) => {
        console.log("Status update:", update);
        // Handle status update
      },
      onError: (error) => {
        console.error("SSE error:", error);
        // Handle error
      },
    }
  );

  return (
    <div>
      <p>Connection: {connectionStatus}</p>
      {latestUpdate && (
        <p>
          Latest status: {latestUpdate.status} (seq: {latestUpdate.sequence_number})
        </p>
      )}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### Advanced Usage with Feature Flag

```tsx
import { useSessionStatus } from "@/app/hooks/useSessionStatus";

function ChatComponent({ sessionId, seqNum }) {
  // Feature flag to enable/disable SSE
  const USE_SSE = process.env.NEXT_PUBLIC_USE_SSE === "true";

  const { connectionStatus, latestUpdate } = useSessionStatus(
    sessionId,
    {
      enabled: USE_SSE,
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 2000,
      onUpdate: (update) => {
        // Update UI with latest status
        updateMessageStatus(update.request_id, update.status);
      },
      onConnectionChange: (status) => {
        console.log("Connection status changed:", status);
      },
    }
  );

  // Fallback to polling if SSE is disabled or fails
  if (!USE_SSE || connectionStatus === "error") {
    // Use existing pollForResponse logic
  }

  return (
    <div>
      {/* Your chat UI */}
    </div>
  );
}
```

### Manual Connection Control

```tsx
import { useSessionStatus } from "@/app/hooks/useSessionStatus";

function ChatComponent({ sessionId }) {
  const { connectionStatus, reconnect, disconnect } = useSessionStatus(
    sessionId,
    {
      autoReconnect: false, // Disable auto-reconnect
    }
  );

  return (
    <div>
      <p>Status: {connectionStatus}</p>
      <button onClick={reconnect}>Reconnect</button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

## Hook API

### Parameters

- `sessionId: string | null` - The session ID to subscribe to. If null, no connection is established.
- `options: UseSessionStatusOptions` - Configuration options

### Options

```typescript
interface UseSessionStatusOptions {
  enabled?: boolean; // Enable SSE connection (default: true)
  autoReconnect?: boolean; // Auto-reconnect on errors (default: true)
  maxReconnectAttempts?: number; // Max reconnect attempts (default: 5)
  reconnectDelay?: number; // Delay between reconnects in ms (default: 2000)
  onUpdate?: (update: SSERequestUpdate) => void; // Update callback
  onConnectionChange?: (status: SSEConnectionStatus) => void; // Connection status callback
  onError?: (error: Error) => void; // Error callback
}
```

### Return Value

```typescript
interface UseSessionStatusReturn {
  connectionStatus: SSEConnectionStatus; // Current connection status
  latestUpdate: SSERequestUpdate | null; // Latest update received
  error: Error | null; // Error if connection failed
  reconnect: () => void; // Manually reconnect
  disconnect: () => void; // Manually disconnect
}
```

### Types

#### SSERequestUpdate

```typescript
type SSERequestUpdate = {
  request_id: string;
  session_id: string;
  status: string; // "pending" | "in_progress" | "done" | "error"
  updated_at: number; // Unix timestamp
  has_response: boolean;
  has_error: boolean;
  sequence_number: number;
};
```

#### SSEConnectionStatus

```typescript
type SSEConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";
```

## Migration from Polling

### Before (Polling)

```tsx
import { pollForResponse } from "@/app/helpers/chat";

const polling = pollForResponse({ sessionId, seqNum });

polling.onStatus((status) => {
  updateStatus(status);
});

polling.waitForDone.then((message) => {
  console.log("Done:", message);
});
```

### After (SSE with Polling Fallback)

```tsx
import { useSessionStatus } from "@/app/hooks/useSessionStatus";
import { pollForResponse } from "@/app/helpers/chat";

const USE_SSE = process.env.NEXT_PUBLIC_USE_SSE === "true";

const { connectionStatus, latestUpdate } = useSessionStatus(sessionId, {
  enabled: USE_SSE,
  onUpdate: (update) => {
    updateStatus(update);
  },
  onError: (error) => {
    console.error("SSE failed, falling back to polling");
    // Fallback to polling
    const polling = pollForResponse({ sessionId, seqNum });
    polling.onStatus((status) => updateStatus(status));
  },
});
```

## Environment Variables

Add to `.env.local`:

```bash
# Enable SSE (default: false for gradual rollout)
NEXT_PUBLIC_USE_SSE=false

# Enable SSE fallback to polling on error (default: true)
NEXT_PUBLIC_SSE_FALLBACK=true
```

## Testing

### Local Testing

1. Start the backend with SSE endpoint: `npm run dev`
2. Enable SSE in frontend: `NEXT_PUBLIC_USE_SSE=true npm run dev`
3. Open browser console to see SSE connection logs
4. Create a request and watch real-time updates

### Testing Connection Failures

```tsx
const { connectionStatus, error, reconnect } = useSessionStatus(sessionId, {
  maxReconnectAttempts: 3,
  reconnectDelay: 1000,
  onError: (error) => {
    console.error("Connection failed:", error);
  },
});

// Simulate connection failure by stopping the backend
// Watch automatic reconnection attempts in console
```

## Troubleshooting

### SSE connection fails immediately

- Check that backend endpoint `/api/apegpt/sse/{sessionId}` is accessible
- Verify authentication token is valid
- Check browser console for CORS errors

### No updates received

- Verify session ID is correct
- Check that database trigger is installed: `alembic upgrade head`
- Check backend logs for notification events
- Verify request status is actually changing in database

### Connection keeps reconnecting

- Check network stability
- Verify backend server is running and healthy
- Check reverse proxy configuration (nginx/ALB) for SSE support
- Ensure proxy timeout is > 60 seconds

## Browser Compatibility

SSE is supported in all modern browsers via the native `EventSource` API:

- ✅ Chrome 6+
- ✅ Firefox 6+
- ✅ Safari 5+
- ✅ Edge 79+
- ❌ IE 11 (use polling fallback)

For IE11 support, always enable `NEXT_PUBLIC_SSE_FALLBACK=true`.
