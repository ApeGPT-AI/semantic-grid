# Error Handling Documentation

This document describes the comprehensive error handling system implemented in the web application.

## Overview

The application uses a multi-layered error handling approach that catches errors at different levels and logs them to the browser console. This provides a non-intrusive way to handle errors while giving developers full visibility into issues through console logs.

## Architecture

### Error Handling Layers

```
┌─────────────────────────────────────────────────────────┐
│  Global Error Boundary (app/global-error.tsx)          │
│  Catches catastrophic errors at root level             │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  App Error Boundary (app/error.tsx)                    │
│  Catches errors within app (inside providers)          │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Global Error Handler (GlobalErrorHandler component)   │
│  Catches uncaught runtime errors & promise rejections  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  API Error Handler (ApiErrorHandler component)         │
│  Displays API/network errors when notified             │
└─────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Global Error Boundary (`app/global-error.tsx`)

**Purpose**: Catches catastrophic errors at the root level (outside all providers)

**Behavior**:
- Logs error details to the browser console
- Does NOT display any UI (returns null)
- Error message, stack trace, and digest are logged with `[GlobalError]` prefix
- Prevents app from crashing while keeping UI unobtrusive

**When it triggers**:
- Root-level React errors
- Errors in layout/provider initialization
- Critical application failures

**Example**:
```tsx
// This would trigger global-error.tsx (logs to console only)
throw new Error("Critical failure in root layout");
```

### 2. App Error Boundary (`app/error.tsx`)

**Purpose**: Catches errors within the application (inside providers)

**Behavior**:
- Logs error details to the browser console
- Does NOT display any UI (returns null)
- Error message, stack trace, and digest are logged with `[Error]` prefix
- Allows application to continue running without intrusive error pages

**When it triggers**:
- React component render errors
- Server component errors
- Server action errors
- State update errors

**Example**:
```tsx
// This would trigger error.tsx (logs to console only)
const Component = () => {
  throw new Error("Component render error");
};
```

### 3. Global Error Handler (`app/components/GlobalErrorHandler.tsx`)

**Purpose**: Catches uncaught JavaScript errors and promise rejections

**Behavior**:
- Logs errors to the browser console
- Does NOT display any UI (returns null)
- Logs error message, stack trace, and location with `[GlobalErrorHandler]` prefix
- Prevents default error handling to keep UI clean

**When it triggers**:
- Uncaught synchronous errors
- Unhandled promise rejections
- Async errors in setTimeout/setInterval
- Network errors not caught by try-catch

**Example**:
```tsx
// These would trigger GlobalErrorHandler (logs to console only)
onClick={() => {
  throw new Error("Uncaught error");
}}

onClick={() => {
  Promise.reject(new Error("Unhandled rejection"));
}}
```

### 4. API Error Handler (`app/hooks/useApiErrorHandler.ts`)

**Purpose**: Logs API/network errors when explicitly notified

**Behavior**:
- Logs errors to the browser console
- Does NOT display any UI (returns null)
- Logs error message, HTTP status, and timestamp with `[ApiErrorHandler]` prefix
- Useful for tracking API failures without interrupting user workflow

**When it triggers**:
- When `notifyApiError()` is called explicitly
- Useful for SWR/fetch errors that need logging

**Usage**:
```tsx
import { notifyApiError } from "@/app/hooks/useApiErrorHandler";

// In your code
try {
  const response = await fetch('/api/endpoint');
  if (!response.ok) {
    notifyApiError(`Request failed: ${response.statusText}`, response.status);
  }
} catch (error) {
  notifyApiError(error.message);
}
```

## Error Display Locations

| Error Type | Location | Display |
|------------|----------|---------|
| Runtime/JS errors | Console only | `[GlobalErrorHandler]` prefix |
| Promise rejections | Console only | `[GlobalErrorHandler]` prefix |
| API errors (notified) | Console only | `[ApiErrorHandler]` prefix |
| React render errors | Console only | `[Error]` prefix |
| Server errors | Console only | `[Error]` prefix |
| Global catastrophic | Console only | `[GlobalError]` prefix |

## Server-Side Error Handling

### Server Components

Errors thrown in Server Components are automatically caught by Next.js and will trigger `app/error.tsx` in production.

**Example**:
```tsx
// app/my-page/page.tsx
const Page = async () => {
  const data = await fetchData(); // If this throws, error.tsx catches it
  return <div>{data}</div>;
};
```

### Server Actions

Errors in Server Actions are also caught by the error boundary system.

**Example**:
```tsx
"use server";

export const createSession = async (data: any) => {
  const result = await apiCall(data);
  if (!result) {
    throw new Error("Failed to create session"); // Caught by error.tsx
  }
  return result;
};
```

### Functions Returning `null`

Many API functions in `app/lib/gptAPI.ts` and `app/lib/payload.ts` return `null` instead of throwing errors. This is intentional defensive programming. Components should check for `null` values:

**Example**:
```tsx
const session = await getUserSession({ sessionId });
if (!session) {
  // Handle missing data appropriately
  return <div>Session not found</div>;
}
```

## Development vs Production

### Development Mode

In development, Next.js shows its built-in error overlay **in addition to** our error handlers. This is expected and helpful for debugging. You'll see:
- Next.js red overlay with stack trace
- Our MUI error handlers in the background

### Production Mode

In production builds, the Next.js overlay is disabled and only our custom MUI error handlers are shown, providing a clean, professional user experience.

**To test production behavior locally**:
```bash
cd apps/web
bun run build
bun run start
```

## Testing Error Handling

A comprehensive test page is available at `/test-errors` with buttons to simulate different error scenarios:

1. **Uncaught Synchronous Error** - Tests GlobalErrorHandler (console logs)
2. **Unhandled Promise Rejection** - Tests GlobalErrorHandler (console logs)
3. **Render Error** - Tests error.tsx boundary (console logs)
4. **Async Error (setTimeout)** - Tests GlobalErrorHandler (console logs)
5. **Async Function Error** - Tests GlobalErrorHandler (console logs)
6. **Network Error** - Tests GlobalErrorHandler (console logs)
7. **Multiple Errors** - Tests multiple console logs
8. **State Update Error** - Tests error.tsx boundary (console logs)
9. **Storage Quota Error** - Tests GlobalErrorHandler (console logs)

**Access the test page**:
```
http://localhost:3000/test-errors
```

## Cache Error Handling

The localStorage cache provider (`app/contexts/localStorageProvider.ts`) has built-in error handling:

- **QuotaExceededError**: Automatically clears cache and continues silently
- **Corrupted cache data**: Clears and reinitializes
- **Large cache**: Auto-evicts old entries using LRU strategy
- **Parse errors**: Catches and clears invalid cache data

These errors are handled gracefully without user notification since the cache will auto-recover.

## Best Practices

### When to Use Each Error Handler

1. **Let React Error Boundaries catch it** (most common):
   ```tsx
   // Just throw in components - error.tsx will catch and log it
   if (!data) {
     throw new Error("Data is required");
   }
   ```

2. **Use notifyApiError for explicit API error logging**:
   ```tsx
   // When you want to log API errors with status codes
   if (!response.ok) {
     notifyApiError("Unable to save changes", response.status);
   }
   ```

3. **Return null for missing data** (defensive):
   ```tsx
   // When absence of data is expected/normal
   const user = await getUser(id);
   if (!user) return null; // Component handles this
   ```

4. **Let GlobalErrorHandler catch everything else**:
   ```tsx
   // Uncaught errors automatically logged to console
   setTimeout(() => {
     throw new Error("Background task failed");
   }, 1000);
   ```

### Error Messages

- **Be specific**: "Failed to load dashboard items" not "Error occurred"
- **Be actionable**: "Unable to save. Please try again" not "Save failed"
- **Include context**: "Network error: Could not reach server" not just "Network error"
- **Avoid technical jargon**: "Your session expired" not "401 Unauthorized"

### Error Logging

All error handlers log to console with prefixes:
- `[GlobalError]` - Global error boundary
- `[Error]` - App error boundary
- `[GlobalErrorHandler]` - Runtime error handler
- `[Cache]` - Cache-related errors

**TODO**: Integrate with error tracking service (Sentry, etc.) by uncommenting the placeholder lines in each handler.

## Future Enhancements

1. **Error Tracking Service Integration**:
   - Uncomment Sentry lines in error handlers
   - Add Sentry SDK and configuration
   - Send error context (user ID, session, etc.)

2. **Error Recovery Strategies**:
   - Automatic retry for transient network errors
   - Offline mode detection and handling
   - Optimistic UI updates with rollback

3. **User Feedback**:
   - "Report Error" button in error boundaries
   - Error feedback form
   - Error ID for support reference

4. **Error Analytics**:
   - Track error frequency by type
   - Monitor error patterns
   - Alert on error rate spikes

## File Reference

| File | Purpose |
|------|---------|
| `app/global-error.tsx` | Root-level error boundary |
| `app/error.tsx` | App-level error boundary |
| `app/components/GlobalErrorHandler.tsx` | Runtime error handler |
| `app/components/ApiErrorHandler.tsx` | API error display component |
| `app/hooks/useApiErrorHandler.ts` | API error handler hook & notifier |
| `app/test-errors/page.tsx` | Error testing page |
| `app/contexts/localStorageProvider.ts` | Cache error handling |

## Troubleshooting

### Errors not showing in production

**Check**:
1. Build the app: `bun run build`
2. Run production mode: `bun run start`
3. Verify error handlers are imported in layout.tsx

### Multiple error messages appearing

**Expected**:
- In development, both Next.js overlay and our handlers show
- In production, only our handlers show

### Error boundaries not catching errors

**Common causes**:
- Error thrown in event handler (caught by GlobalErrorHandler instead)
- Error in async function not awaited
- Error in useEffect cleanup function

### API errors not showing

**Check**:
- Are you calling `notifyApiError()`?
- Is ApiErrorHandler rendered in layout?
- Check browser console for handler logs

## Support

For questions or issues with error handling:
1. Check browser console for error handler logs
2. Test with `/test-errors` page
3. Review this documentation
4. Check Next.js error boundary docs: https://nextjs.org/docs/app/building-your-application/routing/error-handling
