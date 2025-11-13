# Authentication & Dashboard - Visual Flow Diagrams

## Flow 1: Guest Session Creation

```
┌─────────────────────────────────────────────────────────────────┐
│ User visits app in incognito window (no cookies)                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Middleware (middleware.ts)                                      │
│ - Check for uid cookie                                          │
│ - NOT FOUND                                                     │
│ - Redirect to /api/auth/guest                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ GET /api/auth/guest (app/api/auth/guest/route.ts)              │
│                                                                  │
│ 1. Generate guest ID                                            │
│    guestId = "guest-" + crypto.randomUUID()                    │
│    Example: "guest-7210a68a-1654-4036-9499-8c9243c1e2f4"      │
│                                                                  │
│ 2. Sign JWT with RS256                                          │
│    {                                                            │
│      sub: "guest-7210a68a...",     // Guest ID                │
│      aud: "[AUTH0_AUDIENCE]",      // API audience             │
│      iss: "https://apegpt.ai",     // Issuer                   │
│      exp: now + 365 days            // Expiration              │
│    }                                                            │
│                                                                  │
│ 3. Set cookies                                                  │
│    uid: [JWT] (httpOnly, 365 days)                             │
│    apegpt-trial: "0" (request counter)                         │
│                                                                  │
│ 4. Redirect to /                                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Home Page                                                        │
│ ✓ User has guest session                                        │
│ ✓ Can add queries to dashboard                                  │
│ ✓ Dashboard URL: /user/guest-7210a68a-1654-4036-9499-8c9243c1e2f4 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 2: Auth0 Login (Authenticate Existing Guest)

```
┌──────────────────────────────────────────────────────────────────┐
│ Guest User (with uid cookie) clicks "Login" button               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Redirect to /api/auth/login                                      │
│ (app/api/auth/[auth0]/route.ts - handleLogin)                   │
│                                                                   │
│ Parameters:                                                      │
│ - returnTo: current path                                        │
│ - redirectUri: https://host/api/auth/callback                   │
│ - scope: openid profile email create:session update:session     │
│ - audience: [AUTH0_AUDIENCE]                                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Auth0 Consent Screen                                             │
│ - User enters email                                              │
│ - User enters password (or social login)                         │
│ - User consents to scopes                                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Auth0 Redirects Back to Callback                                 │
│ https://host/api/auth/callback?code=...&state=...               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ /api/auth/callback (handleCallback)                              │
│                                                                   │
│ 1. Exchange code for tokens (behind the scenes)                 │
│    POST https://tenant.auth0.com/oauth/token                    │
│    Request: code, client_id, client_secret, redirect_uri        │
│    Response: access_token, id_token, refresh_token              │
│                                                                   │
│ 2. Extract user info from ID token                              │
│    {                                                            │
│      sub: "auth0|5f7a2b8c9d0e4f5g6h7i8j9k",                   │
│      email: "user@example.com",                                │
│      email_verified: true,                                     │
│      name: "User Name",                                        │
│      picture: "...",                                           │
│      ...                                                        │
│    }                                                            │
│                                                                   │
│ 3. Create secure session cookie                                 │
│    session: [encrypted auth data]                               │
│                                                                   │
│ 4. Redirect to returnTo (original page or /)                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Home Page (with Auth0 session)                                   │
│ ✓ User is authenticated                                          │
│ ✓ Auth0 user ID: auth0|5f7a2b8c9d0e4f5g6h7i8j9k                │
│ ✓ Access token valid for API calls                              │
│ ✓ Can continue with existing guest dashboard                    │
│ ✓ Can create new personal auth0 dashboard                       │
│                                                                   │
│ NOTE: Guest uid cookie still exists!                            │
│ - User now has BOTH guest session AND auth0 session             │
│ - Auth0 takes precedence in useAppUser()                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Flow 3: Dashboard URL Resolution & Display

```
┌──────────────────────────────────────────────────────────────────┐
│ User navigates to /user/guest-7210a68a-1654-4036-9499-8c9243c1e2f4 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Middleware (middleware.ts)                                       │
│ - Path matches: /user/*                                         │
│ - Check: uid cookie exists                                      │
│ - Check: Free tier quota available                              │
│ - Result: Allow request                                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Route Handler                                                    │
│ (app/(dash)/[[...section]]/page.tsx)                             │
│                                                                   │
│ 1. Parse URL path                                               │
│    pathFromParams(params)                                       │
│    Input: ["user", "guest-7210a68a-..."]                       │
│    Output: "/user/guest-7210a68a-..."                          │
│                                                                   │
│ 2. Check if user dashboard                                      │
│    isUserPage = slugPath.startsWith("/user/")                   │
│    Result: true                                                 │
│                                                                   │
│ 3. Query dashboard metadata                                     │
│    getDashboardByPath("/user/guest-7210a68a-...")              │
│    Payload query: where slug equals "/user/guest-7210a68a-..." │
│    Result: Dashboard { id, name, items[], ... }                │
│                                                                   │
│ 4. Fetch full dashboard data                                    │
│    getDashboardData(dashboardId)                                │
│    Result: Dashboard with items and layout                      │
│                                                                   │
│ 5. Permission check                                             │
│    if (isUserPage && !session) {                               │
│      return <LoginPrompt />                                     │
│    }                                                             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Render Dashboard                                                 │
│                                                                   │
│ <DashboardGrid>                                                  │
│   - Title: "User Dashboard"                                     │
│   - Items:                                                       │
│     * Query 1 (chart)                                           │
│     * Query 2 (table)                                           │
│     * "Create new" placeholder                                  │
│   - Layout: React Grid Layout                                   │
│   - Responsive: 3 columns by default                            │
│                                                                   │
│ ✓ Dashboard displayed successfully                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Flow 4: Add Query to User Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│ User viewing query at /q/some-query-id                           │
│ Clicks "Add to User Dashboard" button                            │
│ (app/q/app-bar.tsx)                                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Server Action: addQueryToUserDashboard()                         │
│ (app/actions.tsx)                                                │
│                                                                   │
│ Input: { queryUid: "session-id", itemType: "table" }            │
│                                                                   │
│ 1. Ensure user exists                                           │
│    ensureSession()                                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────────────────────┐
    │ ensureUserAndDashboard() (app/lib/payload.ts)          │
    │                                                         │
    │ 1. Extract user ID from uid cookie JWT                │
    │    jwt = jose.jwtVerify(uidCookie, publicKey)         │
    │    userId = jwt.payload.sub                           │
    │    Example: "guest-7210a68a-..." or "auth0|..."      │
    │                                                         │
    │ 2. Find user in Payload database                       │
    │    Payload query: where uid equals userId             │
    │                                                         │
    │ 3. If not found, create user                           │
    │    INSERT INTO users (uid) VALUES (userId)            │
    │                                                         │
    │ 4. Find user's dashboard                              │
    │    Payload query: where ownerUserId equals userId     │
    │                                                         │
    │ 5. If not found, create dashboard                      │
    │    {                                                   │
    │      slug: "/user/{userId}",                          │
    │      name: "User Dashboard",                          │
    │      ownerUserId: userId,                             │
    │      items: [],                                       │
    │    }                                                   │
    │                                                         │
    │ Return: { uid, userId, dashboardId }                  │
    └────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Attach Query to Dashboard                                        │
│ attachQueryToUserDashboard()                                     │
│                                                                   │
│ 1. Upsert query                                                 │
│    Find Query by queryUid                                       │
│    If exists: update                                            │
│    If not: insert                                               │
│    Result: Query { id }                                         │
│                                                                   │
│ 2. Create dashboard item                                        │
│    INSERT INTO dashboard_items (                                │
│      dashboardId,                                               │
│      queryId,                                                   │
│      name,                                                      │
│      itemType,                                                  │
│      chartType                                                  │
│    )                                                            │
│    Result: DashboardItem { id }                                │
│                                                                   │
│ 3. Add item to dashboard                                        │
│    UPDATE dashboards                                            │
│    SET items = [...items, itemId]                              │
│    WHERE id = dashboardId                                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Return to User                                                   │
│                                                                   │
│ 1. Revalidate cache                                             │
│    revalidatePath(`/user/${userId}`)                            │
│                                                                   │
│ 2. Navigate to dashboard                                        │
│    router.push(`/user/${userId}`)                              │
│    Example: /user/guest-7210a68a-...                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Dashboard Page Reloaded                                          │
│ - User navigates to /user/{userId}                              │
│ - Dashboard fetched with new item                               │
│ - New query appears in grid                                     │
│                                                                   │
│ ✓ Query successfully added to dashboard                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Flow 5: Guest → Auth0 Transition (Current Behavior)

```
┌──────────────────────────────────────────────────────────────────┐
│ Guest User with Dashboard                                        │
│ - uid cookie: "guest-7210a68a-..."                             │
│ - dashboard.ownerUserId: "guest-7210a68a-..."                  │
│ - dashboard.slug: "/user/guest-7210a68a-..."                   │
│ - Dashboard items: [Query1, Query2, ...]                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ User Clicks "Login"                                              │
│ [Complete Auth0 flow - see Flow 2]                               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ User Now Has TWO Sessions                                        │
│ - uid cookie: "guest-7210a68a-..." (still exists)              │
│ - session: Auth0 session data                                   │
│                                                                   │
│ useAppUser() returns:                                           │
│ - authUser: Auth0 user (takes precedence)                       │
│ - guest: "guest-7210a68a-..." (still available)                │
│ - isAuthUser: true                                              │
│ - isGuest: false (authUser takes precedence)                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ ensureUserAndDashboard() Called (Next User Action)              │
│                                                                   │
│ Issue: Which user ID to use?                                    │
│                                                                   │
│ Current behavior:                                               │
│ - Reads uid cookie                                              │
│ - Gets JWT sub = "guest-7210a68a-..."                         │
│ - Creates/finds dashboard: /user/guest-7210a68a-...           │
│ - Ignores Auth0 authenticated session!                          │
│                                                                   │
│ Expected behavior:                                              │
│ - Should detect Auth0 session exists                            │
│ - Should use Auth0 user ID: "auth0|..."                        │
│ - Should create/find: /user/auth0|...                          │
│ - Should migrate guest items (if desired)                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ Result: TWO Separate Dashboards!                                │
│                                                                   │
│ Guest Dashboard:                                                 │
│ - /user/guest-7210a68a-...                                    │
│ - ownerUserId: "guest-7210a68a-..."                           │
│ - Items: [Query1, Query2, ...]                                 │
│ - Status: Orphaned (user no longer guest)                      │
│                                                                   │
│ Auth0 Dashboard:                                                 │
│ - /user/auth0|5f7a2b8c...                                     │
│ - ownerUserId: "auth0|5f7a2b8c..."                            │
│ - Items: [] (empty, new dashboard)                             │
│ - Status: Active (user is authenticated)                       │
│                                                                   │
│ ⚠ Problem: Old guest items lost!                               │
│ ⚠ Problem: Two dashboards confusing!                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## State Diagram: User Type Detection

```
                    ┌──────────────────┐
                    │  User Visits App │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Check uid Cookie │
                    └────────┬─────────┘
                             │
                ┌────────────┴─────────────┐
                │                          │
         ┌──────▼───────┐         ┌────────▼──────┐
         │ uid exists   │         │ uid NOT exist │
         │ (has guest)  │         │ (no session)  │
         └──────┬───────┘         └────────┬──────┘
                │                         │
                ▼                         ▼
         ┌──────────────┐         ┌──────────────────┐
         │ Verify Guest │         │ Create Guest JWT │
         │ JWT valid    │         │ Set uid cookie   │
         └──────┬───────┘         └──────┬───────────┘
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │ Check Auth0 Session │
                  └────────┬────────────┘
                           │
            ┌──────────────┴────────────────┐
            │                               │
      ┌─────▼─────┐               ┌────────▼─────┐
      │Auth0 valid│               │No Auth0 valid│
      │(logged in)│               │(not logged in)│
      └─────┬─────┘               └────────┬──────┘
            │                              │
            ▼                              ▼
    ┌──────────────────┐        ┌──────────────────┐
    │ useAppUser() =   │        │ useAppUser() =   │
    │ - authUser       │        │ - guest ID       │
    │ - isAuthUser:T   │        │ - isGuest:T      │
    │ - isGuest:F      │        │ - isAuthUser:F   │
    │ - session valid  │        │ - canContinue:T* │
    │ - canContinue:T  │        │ *if has quota    │
    └──────────────────┘        └──────────────────┘
```

---

## Middleware Flow Chart

```
     Request to Next.js App
                │
                ▼
     ┌──────────────────────┐
     │ Middleware (next)    │
     │ middleware.ts        │
     └──────────┬───────────┘
                │
                ▼
     ┌──────────────────────────────────────┐
     │ Is path /api/payload/* ?             │
     │ (CMS proxy)                          │
     └────────┬──────────────────────┬──────┘
     ┌────────▼──────┐        ┌──────▼──────────┐
     │ YES: Rewrite  │        │ NO: Continue    │
     │ to PAYLOAD_   │        │                 │
     │ API_URL       │        └────────┬────────┘
     └───────────────┘                 │
                                       ▼
                        ┌──────────────────────────────┐
                        │ Check uid Cookie (guest)     │
                        │ Missing?                     │
                        └────────┬─────────────┬───────┘
                    ┌────────────▼──────┐  ┌──▼───────────────┐
                    │ YES: Redirect to  │  │ NO: Continue     │
                    │ /api/auth/guest   │  │                  │
                    └───────────────────┘  └────────┬─────────┘
                                                   │
                                        ┌──────────▼──────────┐
                                        │ Check Free Quota    │
                                        │ apegpt-trial cookie │
                                        └────────┬────────────┘
                    ┌───────────────────────────┤
                    │                           │
          ┌─────────▼──────────┐    ┌──────────▼─────────┐
          │ Has quota left     │    │ No quota left      │
          │ Continue           │    │                    │
          └────────────────────┘    └──────────┬─────────┘
                                              │
                                    ┌─────────▼─────────────┐
                                    │ Is protected route?   │
                                    │ (/user/*, /admin/*)  │
                                    └────────┬─────────┬────┘
                                ┌───────────▼──┐  ┌──▼─────────────────┐
                                │ YES: Check   │  │ NO: Allow (public) │
                                │ Auth0 Session│  │                    │
                                └───────┬──────┘  └────────────────────┘
                            ┌──────────▼────────────────┐
                            │ Check /admin/* specially  │
                            │ Requires admin: scope     │
                            └──────────┬────────────────┘
                        ┌─────────────▼──────────────────┐
                        │ All checks passed?             │
                        │ Allow request to continue      │
                        └────────────────────────────────┘
```

---

## Database Schema Relationships

```
┌─────────────────┐
│  User           │ (Payload CMS)
├─────────────────┤
│ id              │◄──┐
│ uid             │   │
│ email           │   │
│ sessions: []    │   │
└─────────────────┘   │
                      │
                      │
┌─────────────────────────────┐
│  Dashboard                  │ (Payload CMS)
├─────────────────────────────┤
│ id                          │
│ slug: /user/{userId}        │
│ name: "User Dashboard"      │
│ ownerUserId ─────────────────┘
│ items: [item_id, ...]       │
│ ownerType: "guest"|"auth0"  │ ← NEW FIELD
└────────┬────────────────────┘
         │
         │
    ┌────▼──────────────────────┐
    │  DashboardItem            │ (Payload CMS)
    ├───────────────────────────┤
    │ id                        │
    │ name                      │
    │ description               │
    │ itemType: "chart"|"table" │
    │ chartType: "bar"|"line"   │
    │ query ────────────┐       │
    └───────────────────┼───────┘
                        │
                        │
                    ┌───▼──────────┐
                    │  Query       │ (Payload CMS)
                    ├──────────────┤
                    │ id           │
                    │ queryUid     │ (from Flow Manager)
                    │ description  │
                    │ name         │
                    └──────────────┘
```

---

## JWT Token Payloads

### Guest JWT
```json
{
  "sub": "guest-7210a68a-1654-4036-9499-8c9243c1e2f4",
  "aud": "https://api.apegpt.ai",
  "iss": "https://apegpt.ai",
  "exp": 1893456000,
  "iat": 1730000000,
  "alg": "RS256",
  "kid": "guest-key"
}
```

### Auth0 JWT (ID Token)
```json
{
  "sub": "auth0|5f7a2b8c9d0e4f5g6h7i8j9k",
  "aud": "client_id_here",
  "iss": "https://your-tenant.auth0.com/",
  "exp": 1730086400,
  "iat": 1730000000,
  "email": "user@example.com",
  "email_verified": true,
  "name": "User Name",
  "picture": "https://s.gravatar.com/...",
  "updated_at": "2024-11-12T10:30:00.000Z"
}
```

### Auth0 Access Token (for API calls)
```
Header:
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "auth0_key_id"
}

Payload:
{
  "sub": "auth0|5f7a2b8c9d0e4f5g6h7i8j9k",
  "aud": "https://api.apegpt.ai",
  "iss": "https://your-tenant.auth0.com/",
  "iat": 1730000000,
  "exp": 1730003600,
  "scope": "create:session update:session create:request",
  "azp": "client_id_here",
  "gty": "authorization_code"
}
```

---

## URL Resolution Path

```
User Input URL:
/user/guest-7210a68a-1654-4036-9499-8c9243c1e2f4

                          │
                          ▼
Next.js Route:
app/(dash)/[[...section]]/page.tsx

                          │
                          ▼
pathFromParams():
["user", "guest-7210a68a-..."] → "/user/guest-7210a68a-..."

                          │
                          ▼
getDashboardByPath():
Query Payload: SELECT * FROM dashboards
              WHERE slug = "/user/guest-7210a68a-..."

                          │
                          ▼
Result:
{
  id: 123,
  slug: "/user/guest-7210a68a-...",
  name: "User Dashboard",
  ownerUserId: "guest-7210a68a-...",
  items: [item1_id, item2_id],
  createdAt: "2024-11-12T..."
}

                          │
                          ▼
getDashboardData():
1. Fetch dashboard items
2. Join with queries
3. Calculate layout
4. Return with layout grid

                          │
                          ▼
Render:
<DashboardGrid
  items={[...items...]}
  layout={[...layout...]}
  maxItemsPerRow={3}
/>
```

---

## Decision Tree: Fix the Bug

```
                     Bug: Guest prefix on Auth URLs
                               │
                               ▼
              ┌─────────────────────────────────┐
              │ What's the real issue?          │
              │ - Auth0 users get guest- prefix │
              │ - Cannot distinguish types      │
              └────────────────────┬────────────┘
                                   │
                  ┌────────────────┴─────────────────┐
                  │                                  │
          ┌───────▼────────┐           ┌────────────▼──────┐
          │ Option A:      │           │ Option B (BEST):  │
          │ Change URL     │           │ Add ownerType    │
          │ structure      │           │ field to schema  │
          └───────┬────────┘           └────────────┬──────┘
                  │                                  │
        (BREAKING)│                        (NO BREAKS)│
                  │                                  │
         ├─ /user/guest/{id}                ├─ slug stays same
         ├─ /user/auth/{id}                 ├─ ownerType added
         ├─ /user/google/{id}               ├─ Derive from userId
         └─ Migrate existing URLs            └─ Query by type
                                                   │
                                                   ▼
                                     ┌────────────────────────┐
                                     │ Implement Option B:    │
                                     │ 1. Add ownerType field │
                                     │ 2. Update creation     │
                                     │ 3. Add UI indicator    │
                                     │ 4. Write tests         │
                                     │ 5. No migration needed │
                                     └────────────────────────┘
```

---

## Summary: Two Systems

```
┌────────────────────────────┬────────────────────────────┐
│ GUEST SESSION              │ AUTH0 SESSION              │
├────────────────────────────┼────────────────────────────┤
│ Duration: 365 days         │ Duration: configured (~24h)│
│ JWT signed                 │ OAuth2 + OIDC              │
│ sub: guest-{UUID}          │ sub: auth0|{ID}            │
│ No password                │ Email + password login     │
│ Stateless (JWT only)       │ Stateful (server session)  │
│ Free tier quota            │ Premium/unlimited          │
│ Dashboard: /user/guest-xxx │ Dashboard: /user/auth0|xxx │
│ Can logout                 │ Can logout + full Auth0    │
│ Limited features           │ Full access to features    │
└────────────────────────────┴────────────────────────────┘
```

