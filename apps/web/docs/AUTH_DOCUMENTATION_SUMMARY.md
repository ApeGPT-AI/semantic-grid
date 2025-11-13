# Authentication & Dashboard Documentation - Summary

## What Was Documented

Three comprehensive markdown documents have been created to explain authentication and dashboard URL handling in the Semantic Grid web app:

### 1. **AUTHENTICATION_AND_DASHBOARD_FLOW.md** (Main Document)
Complete technical deep-dive covering:
- Guest session creation with JWT
- Auth0 authentication flow
- Client-side session state management (useAppUser, useGuest, useAuthSession)
- Dashboard routing and data fetching
- Database schema
- Security considerations
- Configuration environment variables
- Data flow diagrams

**Best for**: Understanding the full system architecture

---

### 2. **AUTHENTICATION_QUICK_REFERENCE.md** (Developer Reference)
Quick lookup guide with:
- How each flow works (Guest, Auth0, Dashboard, Add to Dashboard)
- Key files for each component
- Common user flows with file references
- Known issues and fixes
- Testing checklist
- Environment variables
- Code snippets for common tasks
- File map/directory structure

**Best for**: Day-to-day development and troubleshooting

---

### 3. **BUG_REPORT_GUEST_AUTH_URLS.md** (Critical Issue)
Detailed bug report documenting:
- The issue: Authenticated users get "guest-" prefix in URLs
- Root cause analysis with code references
- Hypothesis about what's happening
- Investigation steps
- Three solution options with pros/cons
- Recommended fix path with specific code changes
- Testing plan
- Migration strategy

**Best for**: Fixing the identified bug

---

## The Bug (Most Important Finding)

### Issue
Both guest and authenticated users have URLs with "guest-" prefix:
```
Guest:         semanticgrid.ai/user/guest-7210a68a-1654-4036-9499-8c9243c1e2f4
Authenticated: beta.apegpt.ai/user/guest-73a6caf8-cd50-47a0-ba22-6226e17e8b8d  ← WRONG!
```

### Root Cause
In `apps/web/app/lib/payload.ts`, the `ensureUserAndDashboard()` function creates dashboard slugs using raw `userId` without context:

```typescript
slug: `/user/${userId}`
```

For guests: `userId = "guest-{UUID}"` → `/user/guest-{UUID}` ✓  
For Auth0: `userId = "auth0|{ID}"` or similar → Should NOT include "guest-"

### Impact
- Users cannot distinguish guest sessions from authenticated accounts
- Semantic confusion in URL structure
- Makes it hard to audit user types

### Recommended Fix
Add `ownerType` field to Dashboard schema:
```typescript
{
  slug: "/user/{userId}",
  ownerType: "guest" | "auth0" | "google-oauth2",  // NEW
  ownerUserId: "{userId}",
}
```

Then derive ownerType from userId format:
```typescript
const isGuest = userId?.startsWith("guest-");
const ownerType = isGuest ? "guest" : (userId?.split("|")[0] || "auth0");
```

---

## Key Concepts

### Two Authentication Methods

**1. Guest (Anonymous)**
- No login required
- JWT-based: `{ sub: "guest-{UUID}", exp: +365d }`
- Stored in httpOnly cookie: `uid`
- Free tier quota tracked in: `apegpt-trial` cookie
- Dashboard: `/user/guest-{UUID}`

**2. Auth0 (Authenticated)**
- Email/password login via Auth0
- OAuth2 flow with OIDC
- Session stored in secure cookie
- Access token for API calls
- Dashboard: `/user/{auth0-sub}` (e.g., `/user/auth0|5f7a...`)

### Authentication State (Client)
```typescript
useAppUser() returns {
  user,                        // Current user (auth0 or guest)
  isAuthUser,                  // Is Auth0 authenticated?
  isGuest,                     // Is guest (no auth0)?
  canContinueAsGuest,          // Guest with quota?
  canContinueAsAuthUser,       // Auth0 with valid session?
  sessionIsValid,              // Token not expired?
  hasQuota,                    // Free tier not exceeded?
}
```

### Middleware Protection
```
/ ..................... Always accessible
/q/* ................... Public (query sharing)
/user/* ................ Requires uid cookie (guest OR auth0)
/admin/* ............... Requires Auth0 + admin scope
```

---

## Critical Files Reference

### Authentication Entry Points
- `middleware.ts` - Route protection & session validation
- `app/api/auth/guest/route.ts` - Guest JWT creation
- `app/api/auth/[auth0]/route.ts` - Auth0 login/logout/callback

### User State Management
- `app/hooks/useAppUser.ts` - Combined guest+auth0 state
- `app/hooks/useGuest.ts` - Guest ID lookup
- `app/hooks/useAuthSession.ts` - Auth0 session fetch
- `app/lib/authUser.ts` - Server-side Auth0 session

### Dashboard Management
- `app/lib/payload.ts` - Payload CMS integration (dashboard CRUD)
- `app/(dash)/[[...section]]/page.tsx` - Dynamic dashboard page
- `app/components/TopNavClient.tsx` - Dashboard navigation
- `app/actions.tsx` - Server actions (add to dashboard, etc.)

### UI Components
- `app/layout.tsx` - Root layout with Auth0 UserProvider
- `app/components/UserProfileMenu.tsx` - Login/logout menu
- `app/q/app-bar.tsx` - "Add to User Dashboard" button

---

## How URLs Work

### Guest User Flow
```
1. Access app (no cookie)
   ↓
2. Middleware: no uid cookie → redirect /api/auth/guest
   ↓
3. /api/auth/guest: Generate JWT with sub="guest-{UUID}"
   ↓
4. Set uid cookie, redirect to /
   ↓
5. User accesses /user/guest-{UUID}
   ↓
6. Route handler: getDashboardByPath("/user/guest-{UUID}")
   ↓
7. Query Payload: where slug="/user/guest-{UUID}"
   ↓
8. Render dashboard with items
```

### Auth0 User Flow
```
1. Click "Login"
   ↓
2. /api/auth/login → Redirect to Auth0
   ↓
3. Auth0: User authenticates
   ↓
4. /api/auth/callback: Exchange code for tokens
   ↓
5. Session created, redirect to returnTo
   ↓
6. ensureUserAndDashboard(): Extract Auth0 sub from JWT
   ↓
7. Create dashboard with slug="/user/{auth0-sub}"
   ↓
8. Navigate to /user/{auth0-sub}
```

### Add Query to Dashboard
```
1. User on /q/{queryId}
   ↓
2. Click "Add to User Dashboard"
   ↓
3. Action: addQueryToUserDashboard({ queryUid, itemType })
   ↓
4. ensureSession() → Create user if needed
   ↓
5. Find/create user dashboard
   ↓
6. attachQueryToDashboard() → Create dashboard item
   ↓
7. Navigate to /user/{userId}
   ↓
8. Dashboard displays new item
```

---

## Configuration

### Required Environment Variables
```bash
# Auth0
AUTH0_SECRET=...
AUTH0_BASE_URL=https://semanticgrid.ai
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_AUDIENCE=https://api.apegpt.ai

# JWT (Guest Sessions)
JWT_PUBLIC_KEY=...   # RSA public key (PEM format)
JWT_PRIVATE_KEY=...  # RSA private key (PEM format)

# Free Tier
FREE_TIER_QUOTA=5000000  # Max free requests

# Payload CMS
PAYLOAD_API_URL=http://cms-api:8000
PAYLOAD_API_KEY=...
```

---

## Known Issues & Fixes

| Issue | Severity | Fix | Est. Effort |
|-------|----------|-----|-------------|
| Guest/Auth confusion in URLs | High | Add `ownerType` field | 2h |
| No dashboard ownership validation | High | Check ownerUserId on mutation | 1h |
| No session type UI indicator | Medium | Add "Guest" vs "Auth" label | 1h |
| Guest→Auth migration missing | Medium | Copy guest items on first login | 2h |

---

## Testing Checklist

```
Authentication:
☐ Guest session created on first visit
☐ Guest JWT valid (RS256 signed, 365d expiry)
☐ Auth0 login flow works (Auth0 → callback → session)
☐ Session expires and user redirected to login
☐ Admin routes require admin: scope

Dashboards:
☐ Guest can add items to own dashboard
☐ Auth0 user gets separate dashboard
☐ User can see own dashboard at /user/{id}
☐ User cannot mutate other user's dashboard
☐ TopNav shows correct dashboard list for user

URLs:
☐ Guest dashboard: /user/guest-{UUID}
☐ Auth0 dashboard: /user/{auth0-sub} (no guest-)
☐ Root dashboard: / (always accessible)
☐ Public dashboards: /tokens, /trends, etc.

Permissions:
☐ Guest can use free tier
☐ Auth0 can create sessions (scope)
☐ Admin cannot access /admin without admin: scope
☐ Expired sessions redirect to login
```

---

## Quick Start for Developers

### Understanding User Type
```typescript
// In any component
const { isGuest, isAuthUser, user } = useAppUser();

if (isGuest) {
  console.log("Guest ID:", user.sub); // "guest-xxx"
}
if (isAuthUser) {
  console.log("Auth0 ID:", user.sub); // "auth0|xxx"
}
```

### Creating User Dashboard
```typescript
// In server action
const { uid, userId, dashboardId } = await ensureSession();
// uid = Auth0 sub or guest-UUID
// userId = Same as uid
// dashboardId = Payload dashboard ID

// Dashboard automatically created at /user/{userId}
```

### Adding Query to Dashboard
```typescript
// In button click handler
const dashboardUrl = await addQueryToUserDashboard({
  queryUid: "session-id-from-flow-manager",
  itemType: "table",  // or "chart"
});
router.push(dashboardUrl);  // /user/{userId}
```

### Checking Auth0 Session
```typescript
const { session, sessionIsValid, canContinueAsAuthUser } = useAppUser();

if (!sessionIsValid) {
  // Token expired
}
if (!canContinueAsAuthUser) {
  // Missing required scope or session invalid
}
```

---

## Deployment Notes

1. **JWT Keys**:
   - Generate with: `openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048`
   - Extract public: `openssl rsa -in private.pem -pubout -out public.pem`
   - Set as `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` env vars

2. **Auth0 Setup**:
   - Configure return URL: `{BASE_URL}/api/auth/callback`
   - Configure logout URL: `{BASE_URL}`
   - Create custom API with identifier (set as `AUTH0_AUDIENCE`)
   - Set scopes: `create:session update:session create:request update:request`
   - For admins add: `admin:requests admin:sessions`

3. **Database**:
   - Payload CMS handles dashboard schema
   - No manual migrations needed for guests
   - Guest sessions are stateless (JWT-only)

4. **Testing in Production**:
   - Always test guest session creation first
   - Then test Auth0 login flow
   - Verify dashboard access for both types
   - Check admin routes are protected

---

## Files Created

1. **AUTHENTICATION_AND_DASHBOARD_FLOW.md** (Comprehensive)
   - 450+ lines
   - Complete technical documentation
   - All flows, security, architecture

2. **AUTHENTICATION_QUICK_REFERENCE.md** (Developer Guide)
   - 400+ lines
   - Code snippets
   - Quick lookups
   - File map

3. **BUG_REPORT_GUEST_AUTH_URLS.md** (Issue Tracker)
   - 350+ lines
   - Bug analysis
   - Root cause
   - Solution options
   - Code fixes

All files saved in: `/Users/lbelyaev/dev/semantic-grid/`

---

## Next Steps

### For Developers
1. Read `AUTHENTICATION_QUICK_REFERENCE.md` first
2. Refer to specific sections in `AUTHENTICATION_AND_DASHBOARD_FLOW.md` as needed
3. Use file map to navigate codebase

### For Bug Fix
1. Read `BUG_REPORT_GUEST_AUTH_URLS.md` entirely
2. Follow "Investigation Needed" section to diagnose
3. Implement recommended fix (Option B: Add ownerType)
4. Run test suite

### For New Features
1. Check `AUTHENTICATION_QUICK_REFERENCE.md` for related flows
2. Reference code snippets
3. Add tests to checklist
4. Update middleware if new routes added

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Documentation Lines | 1,200+ |
| Code Files Analyzed | 15+ |
| Key Findings | 4 major issues |
| Recommended Fixes | 3+ solutions |
| Configuration Variables | 12+ |
| Test Cases | 15+ |

