# SessionContext

Provides a single, shared SSE connection for real-time session updates across the entire application.

## Usage

### 1. Wrap your app with SessionProvider

```tsx
// app/layout.tsx or app/providers.tsx
import { SessionProvider } from "@/app/contexts";

export default function RootLayout({ children }) {
  return (
    <SessionProvider initialSessionId={null}>
      {children}
    </SessionProvider>
  );
}
```

### 2. Set session ID when available

```tsx
// In your session component
import { useSessionContext } from "@/app/contexts";

function MyComponent() {
  const { setSessionId } = useSessionContext();

  useEffect(() => {
    // When you get a session ID from your API
    setSessionId(newSessionId);
  }, [newSessionId]);

  return <div>...</div>;
}
```

### 3. Access connection status and updates anywhere

```tsx
import { useSessionContext } from "@/app/contexts";

function StatusIndicator() {
  const { connectionStatus, latestUpdate, error } = useSessionContext();

  return (
    <div>
      <div>Status: {connectionStatus}</div>
      {latestUpdate && <div>Latest: {latestUpdate.status}</div>}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

## Key Differences from useSessionStatus Hook

| Feature | Hook (useSessionStatus) | Context (SessionProvider) |
|---------|------------------------|---------------------------|
| SSE Connections | One per hook instance | **One per app** |
| Session Management | Pass sessionId to hook | Call setSessionId() anywhere |
| Sharing State | Need to prop drill | Available everywhere via context |
| Use Case | Single component | **App-wide state** |

## Migration Guide

### Before (Hook):
```tsx
function MyComponent({ sessionId }) {
  const { connectionStatus, latestUpdate } = useSessionStatus(sessionId, {
    onUpdate: handleUpdate,
  });

  return <div>{connectionStatus}</div>;
}
```

### After (Context):
```tsx
// 1. Wrap app with provider (once)
<SessionProvider onUpdate={handleUpdate}>
  <App />
</SessionProvider>

// 2. Use context in components
function MyComponent({ sessionId }) {
  const { connectionStatus, latestUpdate, setSessionId } = useSessionContext();

  useEffect(() => {
    setSessionId(sessionId);
  }, [sessionId]);

  return <div>{connectionStatus}</div>;
}
```

## API Reference

### SessionProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialSessionId` | `string \| null` | `null` | Initial session ID |
| `enabled` | `boolean` | `true` | Enable SSE connection |
| `autoReconnect` | `boolean` | `true` | Auto-reconnect on errors |
| `maxReconnectAttempts` | `number` | `5` | Max reconnection attempts |
| `reconnectDelay` | `number` | `2000` | Delay between reconnects (ms) |
| `onUpdate` | `(update) => void` | - | Callback for status updates |
| `onConnectionChange` | `(status) => void` | - | Callback for connection changes |
| `onError` | `(error) => void` | - | Callback for errors |

### useSessionContext Return

| Property | Type | Description |
|----------|------|-------------|
| `connectionStatus` | `SSEConnectionStatus` | Current connection status |
| `latestUpdate` | `SSERequestUpdate \| null` | Latest update received |
| `error` | `Error \| null` | Connection error if any |
| `sessionId` | `string \| null` | Current session ID |
| `setSessionId` | `(id) => void` | Update session ID (triggers reconnect) |
| `reconnect` | `() => void` | Manually reconnect |
| `disconnect` | `() => void` | Manually disconnect |

## Benefits

- ✅ **Single SSE connection** per app (not per component)
- ✅ **Shared state** across all components
- ✅ **Simpler management** of session changes
- ✅ **Better performance** (fewer connections)
- ✅ **Easier testing** (mock the provider)

## Note

The original `useSessionStatus` hook is still available for backwards compatibility or special use cases where you need multiple independent connections.
