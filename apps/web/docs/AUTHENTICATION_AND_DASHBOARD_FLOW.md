# Authentication and Dashboard URL Flow - Semantic Grid Web App

## Executive Summary

The Next.js web app uses a **dual authentication model**:
1. **Guest sessions** - Anonymous users with JWT-based temporary access (valid for 365 days)
2. **Authenticated sessions** - Users logged in via Auth0 with email/password

**Critical Issue Identified**: Authenticated users' dashboard URLs incorrectly include a "guest-" prefix in the URL slug format, which is misleading and semantically wrong. The authenticated user's dashboard is stored with `slug: /user/{userId}` where `userId` is their Auth0 user ID (e.g., `guest-73a6caf8...`), making it visually indistinguishable from guest session URLs.

---

## 1. Authentication Flow

### 1.1 Guest Session Creation

**Entry Point**: `/api/auth/guest` route handler  
**File**: `apps/web/app/api/auth/guest/route.ts`

#### Flow:
1. User accesses the app without authentication
2. **Middleware check** (`apps/web/middleware.ts`):
   - Verifies if user has a `uid` cookie containing a valid JWT
   - If not present, redirects to `/api/auth/guest`
3. **Guest JWT Creation** (`/api/auth/guest`):
   ```typescript
   const guestId = `guest-${crypto.randomUUID()}`;
   const jwt = await new jose.SignJWT({ sub: guestId })
     .setProtectedHeader({ alg: "RS256", kid: "guest-key" })
     .setAudience(process.env.AUTH0_AUDIENCE!)
     .setIssuer("https://apegpt.ai")
     .setExpirationTime("365d")
     .sign(privateKey);
   ```
4. JWT is set as `uid` cookie (httpOnly, max age: 365 days)
5. `apegpt-trial` cookie set to "0" (free requests counter)
6. User redirected to home page

**Guest ID Format**: `guest-{UUID}`  
**Example**: `guest-7210a68a-1654-4036-9499-8c9243c1e2f4`

#### Key Components:
- **JWT Keys**: Loaded from environment variables or mounted files
  - Public key: `JWT_PUBLIC_KEY` (SPKI PEM format)
  - Private key: `JWT_PRIVATE_KEY` (PKCS#8 PEM format)
- **Signature Algorithm**: RS256 (RSA)
- **Audience**: `AUTH0_AUDIENCE` environment variable
- **Issuer**: `https://apegpt.ai`

---

### 1.2 Authenticated Session Creation (Auth0)

**Entry Point**: `/api/auth/[auth0]` route handler  
**File**: `apps/web/app/api/auth/[auth0]/route.ts`

#### Flow:
1. User clicks "Login" button or accessed protected route
2. **Middleware redirect**: If no session, redirects to `/api/auth/login`
3. **Auth0 Login**:
   ```typescript
   handleLogin(req, ctx, {
     returnTo,
     authorizationParams: {
       redirectUri: `https://{host}/api/auth/callback`,
       scope: "openid profile email create:session update:session create:request update:request admin:requests admin:sessions",
       audience: process.env.AUTH0_AUDIENCE,
     },
   })
   ```
4. **Callback** (`/api/auth/callback`):
   - Auth0 redirects user back with authorization code
   - SDK exchanges code for tokens (ID token, access token)
   - Session created and stored in secure cookie
5. User is redirected to `returnTo` URL (default: home page)

#### Key Components:
- **Library**: `@auth0/nextjs-auth0`
- **Session Storage**: Secure, httpOnly cookies
- **Scopes Requested**:
  - `openid profile email` - Standard OIDC
  - `create:session update:session` - Custom API scopes
  - `create:request update:request` - Custom API scopes
  - `admin:requests admin:sessions` - Admin-only scopes
- **Audience**: `AUTH0_AUDIENCE` (custom API identifier)

#### User Session Structure:
```typescript
type Session = {
  user: {
    sub: string; // Auth0 user ID
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    // ... other OIDC claims
  };
  accessToken: string;
  accessTokenExpiresAt: number; // Unix timestamp in seconds
  accessTokenScope?: string; // Space-separated scopes
  // ... other OAuth2 data
};
```

---

### 1.3 Session State Management in React

**Client-side Hook**: `useAppUser()`  
**File**: `apps/web/app/hooks/useAppUser.ts`

#### Flow:
1. **Auth0 User Detection**:
   ```typescript
   const { user: authUser } = useUser(); // Auth0 hook
   ```
2. **Guest Detection**:
   ```typescript
   const { guest, hasQuota } = useGuest();
   // Calls /api/auth/guest endpoint and reads uid cookie
   ```
3. **Session Validation**:
   ```typescript
   const session = useAuthSession(authUser);
   // Fetches /api/auth/session to get full session data
   
   const sessionIsValid = 
     (session?.accessTokenExpiresAt || 0) * 1000 > Date.now();
   const sessionHasPermission = 
     session?.accessTokenScope?.includes("create:session");
   ```
4. **Return Combined State**:
   ```typescript
   {
     user: authUser || guest,           // Whoever is logged in
     authUser,                           // Auth0 user if exists
     guest,                              // Guest ID if exists
     isGuest: !authUser && !!guest,
     isAuthUser: !!authUser,
     canContinueAsGuest: !authUser && !!guest && hasQuota,
     canContinueAsAuthUser: !!authUser && sessionIsValid && sessionHasPermission,
     hasQuota: boolean,                  // Free tier quota remaining
     // ... other fields
   }
   ```

---

### 1.4 Middleware Authentication Layer

**File**: `apps/web/middleware.ts`

#### Flow:
1. **Guest Token Check**:
   ```typescript
   const guestToken = cookies().get("uid")?.value;
   if (!guestToken) {
     return NextResponse.redirect(`${schema}://${host}/api/auth/guest`);
   }
   ```
2. **Free Tier Quota Check**:
   ```typescript
   const freeRequests = Number(cookies().get("apegpt-trial")?.value || 0);
   const freeTierQuota = process.env.FREE_TIER_QUOTA || "0";
   if (freeRequests < Number(freeTierQuota)) {
     // Allow continuation
   }
   ```
3. **Auth0 Session Check** (for protected routes):
   ```typescript
   const session = await getSession(req, new NextResponse());
   const expired = (session?.accessTokenExpiresAt || 0) * 1000 < Date.now();
   if (expired) {
     return NextResponse.redirect(`/api/auth/login?returnTo=${pathname}`);
   }
   ```
4. **Admin Route Protection**:
   ```typescript
   if (req.nextUrl.pathname.startsWith("/admin/") &&
       !session.accessTokenScope?.includes("admin:")) {
     return NextResponse.redirect(`${schema}://${host}`);
   }
   ```

#### Route Access Rules:
- **Public**: `/`, `/q/*` (query sharing)
- **Guest + Quota**: `/user/*`, `/admin/*`
- **Auth0 Required**: `/admin/*` (with admin scope)

---

## 2. Dashboard/User Page Routing

### 2.1 Dashboard Route Structure

**Route File**: `apps/web/app/(dash)/[[...section]]/page.tsx`  
**Layout File**: `apps/web/app/(dash)/layout.tsx`

#### Dynamic Route Pattern:
```
/                          -> slug = "/"  (root dashboard)
/tokens                    -> slug = "/tokens"
/user/guest-xxxxx          -> slug = "/user/guest-xxxxx"
/user/auth0|xxxxx          -> slug = "/user/auth0|xxxxx"
```

#### URL Resolution Process:
```typescript
const pathFromParams = (params: { section?: string[] }) =>
  params.section ? `/${params.section.join("/")}` : "";
// "/" becomes "" which then resolves to "/"
```

### 2.2 Dashboard Data Fetching

**Functions**: `getDashboardByPath()`, `getDashboardData()`  
**File**: `apps/web/app/lib/payload.ts`

#### Flow:
1. **Get Dashboard Metadata by Slug**:
   ```typescript
   export const getDashboardByPath = async (path: string) => {
     // Payload CMS query: where slug equals {path}
     const [found] = await getFromPayload("dashboards", query);
     return found || null;
   };
   ```

2. **Check if User Dashboard**:
   ```typescript
   const isUserPage = slugPath.startsWith("/user/");
   ```

3. **Fetch Dashboard Data**:
   ```typescript
   const d = await getDashboardData(dMeta?.id || "");
   // Returns dashboard with items, layout, etc.
   ```

4. **Permission Check**:
   ```typescript
   if (!isUserPage || session) {
     return <DashboardGrid ... />;
   } else {
     return <LoginPrompt slugPath={slugPath} />;
   }
   ```

---

### 2.3 User Dashboard Creation

**Function**: `ensureUserAndDashboard()`  
**File**: `apps/web/app/lib/payload.ts`

#### Flow:
1. **Extract User ID from JWT**:
   ```typescript
   if (opts.sid) {
     const publicKey = await getPublicKey();
     const jwt = await jose.jwtVerify(opts.sid, publicKey);
     userId = jwt.payload?.sub; // Guest ID or Auth0 ID
   }
   ```

2. **Find Existing User Dashboard**:
   ```typescript
   const whereDash = { ownerUserId: { equals: userId } };
   const [dash] = await getFromPayload("dashboards", queryDash);
   ```

3. **Create Dashboard if Missing**:
   ```typescript
   if (!dashId) {
     const userDashboard = {
       name: "User Dashboard",
       slug: `/user/${userId}`,           // HERE: Uses raw userId
       ownerUserId: userId,
       description: "Personal dashboard",
       items: [],
     };
     await postToPayload("dashboards", userDashboard);
   }
   ```

---

### 2.4 Dashboard Navigation

**Component**: `TopNavClient`  
**File**: `apps/web/app/components/TopNavClient.tsx`

#### Features:
1. **Renders Dashboard Buttons**:
   ```typescript
   {dashboards.map((d) => (
     <Button
       component={Link}
       href={d.slug}  // Uses slug directly
       color={pathname === d.slug ? "primary" : "inherit"}
     >
       {d.name}
     </Button>
   ))}
   ```

2. **Fetches Dashboards for Logged-In User**:
   ```typescript
   const dashboards = await getDashboards(userId);
   // Payload query: where ownerUserId equals userId
   ```

3. **Returns Ordered List**:
   - Finds root dashboard (`/`)
   - Lists other dashboards not owned by user
   - Lists user's personal dashboard last

---

### 2.5 Add to Dashboard Flow

**Action**: `addQueryToUserDashboard()`  
**File**: `apps/web/app/actions.tsx`

#### Flow:
1. **Ensure Session Exists**:
   ```typescript
   const { uid, userId } = await ensureSession();
   // Creates user record and dashboard if needed
   ```

2. **Find User's Dashboard**:
   ```typescript
   const userDashboards = await getFromPayload("dashboards", query)
     .where({ ownerUserId: { equals: uid } });
   ```

3. **Attach Query**:
   ```typescript
   await attachQueryToDashboard({
     dashboardId: userDashboards[0].id,
     queryUid,
     itemType: "table",
   });
   ```

4. **Navigate to Dashboard**:
   ```typescript
   return `/user/${userId}`;
   ```

**UI Trigger**: "Add to User Dashboard" button in `/q/` view  
**Location**: `apps/web/app/q/app-bar.tsx`

---

## 3. Critical Issues Identified

### Issue 1: Misleading "guest-" Prefix in Authenticated User URLs

**Problem**:
- Guest session URLs: `semanticgrid.ai/user/guest-7210a68a-1654-4036-9499-8c9243c1e2f4`
- Authenticated user URLs: `beta.apegpt.ai/user/guest-73a6caf8-cd50-47a0-ba22-6226e17e8b8d`

Both look identical, but the second is an Auth0-authenticated user.

**Root Cause**:
In `ensureUserAndDashboard()`, the user dashboard slug is created as:
```typescript
slug: `/user/${userId}`
```

Where `userId` comes from the JWT `sub` claim. For Auth0 users, this is the Auth0 user ID. The problem is **naming confusion**:
- For guests: `userId = "guest-{UUID}"` (intentionally prefixed)
- For Auth0: `userId = "auth0|{ID}"` or similar Auth0 format

However, in the screenshot, the authenticated user appears to have `userId = "guest-..."`, which suggests:
1. Either the Auth0 user ID is being generated with a "guest-" prefix (incorrect)
2. Or the JWT verification is falling back to a guest ID for authenticated users

**Evidence from Code**:
```typescript
// In app/lib/payload.ts
const userId = jwt.payload?.sub;  // No differentiation between guest and auth0
slug: `/user/${userId}`,           // Raw userId used in slug
```

**Recommended Fix**:
1. Rename guest user ID to not use "guest-" prefix in Auth0 users
2. Or differentiate the slug structure:
   ```typescript
   slug: `/user/guest/${guestId}` for guests
   slug: `/user/auth/${auth0UserId}` for Auth0 users
   ```
3. Add a type indicator to dashboards to distinguish ownership type

---

### Issue 2: No Clear Visual Distinction Between Guest and Authenticated Sessions

**Problem**:
- Users cannot tell from the URL whether they're using a guest session or authenticated account
- The navigation doesn't clearly indicate which type of session is active

**Root Cause**:
The slug is purely based on userId without indicating the session type. The `isUserPage` check only verifies `startsWith("/user/")`, not whether the user owns that dashboard.

**Recommended Fix**:
Add session type indicator:
```typescript
// In TopNavClient
<Typography variant="caption" color="textSecondary">
  {user.isGuest ? "Guest Session" : "Personal Dashboard"}
</Typography>
```

---

### Issue 3: Guest Session Dashboard Is Mutable

**Problem**:
Guest sessions can have their dashboards modified and saved, creating persistent state for ephemeral users.

**Location**: `apps/web/app/actions.tsx` - `addQueryToUserDashboard()` doesn't verify user ownership

**Impact**:
A guest could add queries to their dashboard, and subsequent accesses would retain those changes if the session cookie persists.

---

## 4. Key Files Reference

### Authentication & Authorization
| File | Purpose |
|------|---------|
| `apps/web/middleware.ts` | Route protection, session validation |
| `apps/web/app/api/auth/guest/route.ts` | Guest JWT creation |
| `apps/web/app/api/auth/[auth0]/route.ts` | Auth0 integration (login/logout/callback) |
| `apps/web/app/api/auth/session/route.ts` | Session data endpoint |
| `apps/web/app/lib/authUser.ts` | Server-side Auth0 session retrieval |
| `apps/web/app/hooks/useAuthSession.ts` | Client-side Auth0 session hook |
| `apps/web/app/hooks/useAppUser.ts` | Combined user state (guest + auth0) |
| `apps/web/app/hooks/useGuest.ts` | Guest ID/quota checking |

### Dashboard Management
| File | Purpose |
|------|---------|
| `apps/web/app/(dash)/layout.tsx` | Dashboard layout wrapper |
| `apps/web/app/(dash)/[[...section]]/page.tsx` | Dynamic dashboard page renderer |
| `apps/web/app/lib/payload.ts` | Payload CMS integration (Drizzle ORM alternative) |
| `apps/web/app/lib/payload-types.ts` | TypeScript definitions for Payload collections |
| `apps/web/app/components/TopNavClient.tsx` | Dashboard navigation buttons |
| `apps/web/app/components/DashboardGrid.tsx` | Dashboard item grid renderer |
| `apps/web/app/actions.tsx` | Server actions for dashboard mutations |

### UI Components
| File | Purpose |
|------|---------|
| `apps/web/app/layout.tsx` | Root layout, Auth0 UserProvider setup |
| `apps/web/app/components/UserProfileMenu.tsx` | Login/logout menu |
| `apps/web/app/q/app-bar.tsx` | "Add to User Dashboard" button |
| `apps/web/app/components/GridItemNavClient.tsx` | Save to dashboard UI |

---

## 5. Configuration Environment Variables

### Required for Auth
```env
AUTH0_SECRET=...                  # Session encryption key
AUTH0_BASE_URL=...                # Callback URL base
AUTH0_ISSUER_BASE_URL=...         # Auth0 tenant domain
AUTH0_CLIENT_ID=...               # Auth0 app ID
AUTH0_CLIENT_SECRET=...           # Auth0 app secret
AUTH0_AUDIENCE=...                # Custom API identifier

JWT_PUBLIC_KEY=...                # RSA public key (PEM)
JWT_PRIVATE_KEY=...               # RSA private key (PEM)

FREE_TIER_QUOTA=...               # Max free requests (default: 5)
FREE_TIER_QUOTA=5000000           # 5 million (effectively unlimited)
```

### Optional
```env
NODE_ENV=production               # For SSL in cookies
NEXT_PUBLIC_GOOGLE_ANALYTICS=...  # GA tracking
```

---

## 6. Data Flow Diagram

### Guest Session Creation
```
User (no cookie) 
  → Middleware: missing uid cookie
  → /api/auth/guest (GET)
  → Generate: guest-{UUID}
  → Create JWT with RS256
  → Set uid cookie (365d)
  → Set apegpt-trial cookie (0)
  → Redirect to /
  ✓ User has guest session
```

### Auth0 Login
```
User clicks "Login"
  → /api/auth/login
  → Redirect to Auth0 consent
  → User authenticates
  → Auth0 callback → /api/auth/callback
  → SDK exchanges code for tokens
  → Session cookie set
  → Redirect to returnTo
  ✓ User has Auth0 session
```

### Dashboard Access
```
User visits /{slugPath}
  → Route: app/(dash)/[[...section]]/page.tsx
  → pathFromParams() converts to slug
  → getDashboardByPath(slug) queries Payload
  → Check isUserPage = slugPath.startsWith("/user/")
  → If user page: check session exists
    → If !session: <LoginPrompt />
    → If session: <DashboardGrid />
  → Else: <DashboardGrid /> (public dashboard)
```

### Add Query to User Dashboard
```
User clicks "Add to User Dashboard"
  → addQueryToUserDashboard({ queryUid, itemType })
  → ensureSession()
    → Extract userId from uid cookie JWT
    → Find/create user in Payload
    → Find/create user dashboard with slug=/user/{userId}
  → attachQueryToDashboard()
    → Query lookup/creation
    → Dashboard item creation
    → Add item.id to dashboard.items array
  → Navigate to /user/{userId}
  ✓ Query attached and visible
```

---

## 7. Security Considerations

### Guest Session Security
- JWT signed with RS256 (strong encryption)
- HttpOnly cookie (prevents JavaScript access)
- 365-day expiration (long-lived)
- Can be revoked by invalidating JWT public key

### Auth0 Session Security
- Auth0 SDK handles token refresh automatically
- Access token expiration checked on middleware
- Scopes restrict API access
- Admin routes require `admin:` scope

### Dashboard Access Control
- User dashboards gated by isUserPage check
- Requires active session to view
- No cross-user dashboard access validation
- **Bug**: No verification that user owns dashboard before mutation

---

## 8. Recommended Improvements

### Priority 1: Fix Guest/Auth Distinction
1. Change guest ID format to `guest-{UUID}` only for guests
2. Ensure Auth0 users have proper `auth0|{ID}` format
3. Add visual indicator in UI showing session type
4. Consider separate URL patterns: `/user/guest/{id}` vs `/user/auth/{id}`

### Priority 2: Dashboard Ownership Validation
1. Add ownership check before allowing mutations:
   ```typescript
   const dashboard = await getDashboardById(dashboardId);
   if (dashboard.ownerUserId !== userId) {
     throw new Error("Unauthorized");
   }
   ```
2. Add request origin validation

### Priority 3: Session Type Indicators
1. Show "Guest Session" vs "Personal Account" in UI
2. Add logout behavior differences (guest: clear cookie, auth: full logout)
3. Warn guests before session expires

### Priority 4: Database Schema
1. Add `ownerType: "guest" | "auth0"` field to dashboards
2. Add `sessionType` to audit logs
3. Index on `(ownerUserId, ownerType)` for faster queries

---

## 9. Testing Checklist

- [ ] Guest creates session, sees guest dashboard URL
- [ ] Guest logs in, gets auth0 dashboard URL
- [ ] Authenticated user gets redirected to own dashboard on login
- [ ] Guest shares session URL, recipient sees guest dashboard
- [ ] Dashboard mutations only work on owned dashboards
- [ ] Session expiration redirects to login
- [ ] Admin routes require admin scope
- [ ] Free tier quota enforced
- [ ] JWT signing/verification uses correct keys
- [ ] Middleware correctly identifies session type

---

## Appendix: Code References

### Session JWT Structure (Guest)
```json
{
  "sub": "guest-7210a68a-1654-4036-9499-8c9243c1e2f4",
  "aud": "[AUTH0_AUDIENCE]",
  "iss": "https://apegpt.ai",
  "exp": 1893456000,
  "iat": 1730000000
}
```

### Session JWT Structure (Auth0)
```json
{
  "sub": "auth0|xxxxx",
  "aud": "...",
  "iss": "https://[tenant].auth0.com/",
  "exp": ...,
  "iat": ...,
  "email": "user@example.com",
  "email_verified": true,
  "name": "User Name",
  "picture": "..."
}
```

### Dashboard Schema (Payload CMS)
```typescript
interface Dashboard {
  id: number;
  slug: string;              // e.g., "/user/guest-xxx" or "/"
  name: string;              // e.g., "User Dashboard"
  description?: string;
  ownerUserId?: string;      // User ID (guest-xxx or auth0|xxx)
  items?: DashboardItem[];
  maxItemsPerRow?: number;
  createdAt: string;
  updatedAt: string;
}
```

