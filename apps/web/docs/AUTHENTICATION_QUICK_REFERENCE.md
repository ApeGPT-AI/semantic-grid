# Authentication & Dashboard Flow - Quick Reference

## URL Structure Issue (BUG)

Both guest and authenticated users have URLs with "guest-" prefix:
- Guest: `semanticgrid.ai/user/guest-7210a68a-1654-4036-9499-8c9243c1e2f4`
- Authenticated: `beta.apegpt.ai/user/guest-73a6caf8-cd50-47a0-ba22-6226e17e8b8d` ← Wrong!

**Root Cause**: Dashboard slug uses raw `userId` from JWT without distinguishing session type.

---

## How It Works

### 1. Guest Session Creation (No Login)
```
Middleware detects missing uid cookie
  ↓
Redirect to /api/auth/guest
  ↓
Create JWT: { sub: "guest-{UUID}" }
  ↓
Set uid cookie (365 days)
  ↓
User has guest session ✓
```

**Key File**: `apps/web/app/api/auth/guest/route.ts`

### 2. Auth0 Login
```
User clicks "Login"
  ↓
Redirect to Auth0 consent screen
  ↓
User authenticates with email/password
  ↓
Auth0 callback to /api/auth/callback
  ↓
Session cookie created
  ↓
User has authenticated session ✓
```

**Key File**: `apps/web/app/api/auth/[auth0]/route.ts`

### 3. Dashboard URL Resolution
```
User visits /user/xxx
  ↓
Route: app/(dash)/[[...section]]/page.tsx
  ↓
Query Payload CMS: where slug = "/user/xxx"
  ↓
Fetch dashboard data
  ↓
Render dashboard ✓
```

**Key File**: `apps/web/app/lib/payload.ts`

### 4. Create User Dashboard
```
User action triggers ensureSession()
  ↓
Extract userId from uid cookie JWT
  ↓
Query: dashboards where ownerUserId = userId
  ↓
If not exists:
  Create dashboard {
    slug: "/user/{userId}",           ← PROBLEM: userId could be "guest-xxx" OR "auth0|xxx"
    ownerUserId: userId,
    name: "User Dashboard"
  }
  ↓
Dashboard created ✓
```

**Key File**: `apps/web/app/lib/payload.ts` → `ensureUserAndDashboard()`

---

## Authentication State (Client-side)

### useAppUser Hook
Combines guest + Auth0 states:

```typescript
{
  user: authUser || guest,           // Current user
  authUser,                           // Auth0 user if exists
  guest,                              // Guest ID if exists
  isGuest: boolean,
  isAuthUser: boolean,
  canContinueAsGuest: boolean,        // Has quota
  canContinueAsAuthUser: boolean,     // Valid + has permission
  hasQuota: boolean,
  sessionIsValid: boolean,
}
```

**Key File**: `apps/web/app/hooks/useAppUser.ts`

---

## Middleware Flow

### Route Protection Rules
```
/                    → Public (no auth required)
/q/*                 → Public (query sharing)
/user/*              → Requires session (guest OR auth0)
/admin/*             → Requires Auth0 + admin: scope
```

### Session Check Order
1. Guest token (uid cookie) required
2. Free tier quota checked
3. For protected routes: Auth0 session validated
4. Admin routes: `admin:` scope required

**Key File**: `apps/web/middleware.ts`

---

## Database Schema (Payload CMS)

```typescript
Dashboard {
  slug: "/user/{userId}"              // User's ID (guest-xxx or auth0|xxx)
  name: "User Dashboard"
  ownerUserId: userId                 // Same as sub from JWT
  items: DashboardItem[]
}

DashboardItem {
  name: string
  query: Query (reference)
  type: "chart" | "table"
  itemType: "chart" | "table"
  chartType?: string
}

Query {
  queryUid: string                    // Session ID from flow manager
  description?: string
}
```

---

## Environment Variables

```bash
# Auth0 Configuration
AUTH0_SECRET=...
AUTH0_BASE_URL=https://semanticgrid.ai
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_AUDIENCE=https://api.apegpt.ai

# JWT Signing (Guest Sessions)
JWT_PUBLIC_KEY=...                  # RSA public key (PEM)
JWT_PRIVATE_KEY=...                 # RSA private key (PEM)

# Free Tier
FREE_TIER_QUOTA=5000000             # Max free requests (5M = unlimited)

# Payload CMS
PAYLOAD_API_URL=http://cms-api:8000
PAYLOAD_API_KEY=...
```

---

## Common User Flows

### Flow A: Guest User → Add Query to Dashboard
```
1. Guest accesses /q/{queryId}
2. Clicks "Add to User Dashboard"
3. addQueryToUserDashboard({ queryUid, itemType })
4. ensureSession() creates user + dashboard
5. Dashboard slug: /user/guest-{UUID}
6. Navigate to /user/guest-{UUID}
7. Query appears on dashboard
```

**Files**: 
- Trigger: `apps/web/app/q/app-bar.tsx`
- Action: `apps/web/app/actions.tsx` → `addQueryToUserDashboard()`
- Backend: `apps/web/app/lib/payload.ts` → `ensureUserAndDashboard()`

### Flow B: Guest User → Login
```
1. Guest with session cookie visits /api/auth/login
2. Redirected to Auth0 consent
3. Logs in with email/password
4. Auth0 creates session (user ID: auth0|xxxxx)
5. Middleware: session valid, can access /user routes
6. Note: Old guest dashboard is orphaned
   (ownerUserId = guest-xxx, but user is auth0|xxxxx)
```

**Files**:
- Login: `apps/web/app/api/auth/[auth0]/route.ts`
- Check: `apps/web/middleware.ts`

### Flow C: Authenticated User → Dashboard
```
1. User logs in via Auth0 (sub = auth0|xxxxx)
2. Visits /user/auth0|xxxxx
3. ensureSession() finds/creates dashboard
4. Dashboard slug: /user/auth0|xxxxx
5. Dashboard persists across sessions
6. Items are tied to ownerUserId = auth0|xxxxx
```

**Files**:
- Same as Flow A, but userId = auth0|xxxxx

---

## Known Issues

### Issue 1: Guest/Auth Confusion
- Guest URLs: `/user/guest-{UUID}`
- Auth URLs: `/user/guest-{UUID}` ← Should be `/user/auth0|xxx` or similar
- **Fix**: Ensure Auth0 users get proper auth0| prefix, not guest- prefix

### Issue 2: No Dashboard Ownership Validation
- `addQueryToUserDashboard()` doesn't verify user owns the dashboard
- Malicious user could mutate another user's dashboard
- **Fix**: Add ownership check before any mutations

### Issue 3: Guest → Auth Migration
- Guest dashboard (ownerUserId = guest-xxx) orphaned after login
- New dashboard created for authenticated session
- **Fix**: Migrate guest dashboard items to auth dashboard on first login

### Issue 4: No Session Type UI Indicator
- Users can't tell from URL if they're guest or authenticated
- **Fix**: Add "Guest Session" vs "Personal Account" label in UI

---

## Testing Quick Checklist

```bash
# Test Guest Session
1. Open app incognito
2. Check /api/auth/guest creates uid cookie
3. Verify JWT format: { sub: "guest-{UUID}" }
4. Add query to dashboard
5. Verify slug: /user/guest-{UUID}

# Test Auth0 Login
1. Click "Login"
2. Sign up with email
3. Check Auth0 session created
4. Verify middleware allows /user routes
5. Check dashboard slug (should NOT have guest-)

# Test Dashboard
1. Visit /user/xxx (public)
2. Visit / (home - always accessible)
3. Visit /admin (should redirect to login if not authenticated)

# Test Logout
1. Click logout
2. Verify session cookie cleared
3. Verify redirected to home
4. Verify guest session still works
```

---

## Key Code Snippets

### Get Current User Type
```typescript
const { user, isGuest, isAuthUser } = useAppUser();

if (isGuest && !isAuthUser) {
  console.log("Guest user:", user.sub); // guest-xxx
}
if (isAuthUser) {
  console.log("Auth user:", user.sub);  // auth0|xxx
}
```

### Create/Get User Dashboard
```typescript
const { uid, userId, dashboardId } = await ensureSession();
// uid = user ID (from JWT sub claim)
// userId = Auth0 sub if authenticated, guest-xxx if guest
// dashboardId = Payload dashboard ID
```

### Check Session Validity
```typescript
const { sessionIsValid, canContinueAsAuthUser } = useAppUser();

if (!sessionIsValid) {
  // Token expired, redirect to login
}
if (!canContinueAsAuthUser) {
  // Missing permissions
}
```

---

## Related Files Map

```
Authentication:
├── middleware.ts                                 [Route protection]
├── app/api/auth/guest/route.ts                   [Guest JWT creation]
├── app/api/auth/[auth0]/route.ts                 [Auth0 login/logout]
├── app/api/auth/session/route.ts                 [Session endpoint]
├── app/lib/authUser.ts                           [Server-side session]
└── app/hooks/useAuthSession.ts                   [Client-side session]

User State:
├── app/hooks/useAppUser.ts                       [Combined user state]
├── app/hooks/useGuest.ts                         [Guest ID/quota]
└── app/contexts/App/index.tsx                    [App context]

Dashboards:
├── app/(dash)/layout.tsx                         [Dashboard layout]
├── app/(dash)/[[...section]]/page.tsx            [Dashboard page]
├── app/lib/payload.ts                            [Payload integration]
├── app/components/TopNavClient.tsx               [Dashboard nav]
├── app/components/DashboardGrid.tsx              [Grid renderer]
└── app/actions.tsx                               [Server actions]

UI Components:
├── app/layout.tsx                                [Root with Auth0 provider]
├── app/components/UserProfileMenu.tsx            [Login/logout menu]
├── app/q/app-bar.tsx                             [Add to dashboard button]
└── app/components/GridItemNavClient.tsx          [Save UI]
```

---

## Deployment Checklist

- [ ] Set AUTH0_SECRET (generate: `openssl rand -hex 32`)
- [ ] Set all AUTH0_* environment variables
- [ ] Generate JWT keys (RSA 2048+)
- [ ] Set JWT_PUBLIC_KEY and JWT_PRIVATE_KEY
- [ ] Configure FREE_TIER_QUOTA
- [ ] Set Payload CMS credentials
- [ ] Test guest session creation
- [ ] Test Auth0 login flow
- [ ] Test dashboard access (own and others)
- [ ] Verify admin routes protected
- [ ] Check CORS/origin in Auth0 settings

