# Authentication & Dashboard Documentation Index

## Overview

Comprehensive documentation has been created explaining how authentication and dashboard URL routing work in the Semantic Grid Next.js web app.

A **critical bug** has been identified: authenticated users are getting "guest-" prefix in their dashboard URLs, making them indistinguishable from guest sessions.

---

## Documents in This Package

### 1. START HERE: `AUTHENTICATION_QUICK_REFERENCE.md`
**For**: Developers who want to understand the system quickly  
**Length**: ~400 lines  
**Contains**:
- Visual flow diagrams (ASCII art)
- How each flow works (Guest, Auth0, Dashboard)
- Key files for each component
- Common user flows with file references
- Known issues summary
- Environment variables
- Code snippets for common tasks
- Testing checklist
- File map/directory structure

**Best for**: Day-to-day development, quick lookups, understanding flows

---

### 2. DEEP DIVE: `AUTHENTICATION_AND_DASHBOARD_FLOW.md`
**For**: Developers who want complete technical understanding  
**Length**: ~450 lines  
**Contains**:
- Complete authentication flow (Guest + Auth0)
- Client-side session state management
- Dashboard routing and data fetching
- Database schema definitions
- Security considerations
- All configuration variables
- Data flow diagrams
- Architecture patterns
- Code organization
- Testing guide

**Best for**: Understanding the full system, architecture decisions, security review

---

### 3. BUG REPORT: `BUG_REPORT_GUEST_AUTH_URLS.md`
**For**: Fixing the identified authentication URL bug  
**Length**: ~350 lines  
**Contains**:
- Bug summary with examples
- Root cause analysis with code references
- Hypothesis about what's wrong
- Investigation steps (how to diagnose)
- Three solution options with pros/cons
- Recommended fix path with specific code changes
- Code diffs showing exact changes needed
- Testing plan (manual + automated)
- Deployment impact analysis

**Best for**: Fixing the bug, understanding what's wrong and how to fix it

---

### 4. SUMMARY: `AUTH_DOCUMENTATION_SUMMARY.md`
**For**: Quick overview of everything  
**Length**: ~350 lines  
**Contains**:
- What each document covers
- The bug in plain language
- Key concepts explained
- Critical files reference
- How URLs work (step-by-step)
- Configuration checklist
- Known issues table
- Testing checklist
- Quick start code examples

**Best for**: Overview, getting oriented, finding specific topics

---

## The Bug (Key Finding)

### The Problem
```
Guest user dashboard URL:         /user/guest-7210a68a-1654-4036-9499-8c9243c1e2f4
Authenticated user dashboard URL: /user/guest-73a6caf8-cd50-47a0-ba22-6226e17e8b8d
                                        ↑ Should NOT have "guest-" prefix!
```

Both look identical but represent different user types. This is confusing and wrong.

### The Issue
In `apps/web/app/lib/payload.ts`, dashboard slug creation doesn't distinguish between guest and authenticated users:

```typescript
slug: `/user/${userId}`  // userId could be "guest-xxx" OR "auth0|xxx"
```

### The Fix
Add an `ownerType` field to the Dashboard schema:

```typescript
{
  slug: "/user/{userId}",
  ownerType: "guest" | "auth0" | "google-oauth2",  // NEW
  ownerUserId: "{userId}"
}
```

See `BUG_REPORT_GUEST_AUTH_URLS.md` for complete details and implementation guide.

---

## Quick Navigation

### "I want to understand how authentication works"
→ Read `AUTHENTICATION_QUICK_REFERENCE.md` → `AUTHENTICATION_AND_DASHBOARD_FLOW.md`

### "I want to fix the guest/auth URL bug"
→ Read `BUG_REPORT_GUEST_AUTH_URLS.md`

### "I need a specific file or feature"
→ Check `AUTHENTICATION_QUICK_REFERENCE.md` file map section

### "I'm deploying this to production"
→ Check `AUTHENTICATION_QUICK_REFERENCE.md` deployment section + environment variables

### "I'm adding a new route/feature"
→ Check `AUTHENTICATION_QUICK_REFERENCE.md` common flows + `AUTHENTICATION_AND_DASHBOARD_FLOW.md` architecture

### "I need to audit security"
→ Read security sections in `AUTHENTICATION_AND_DASHBOARD_FLOW.md` + `BUG_REPORT_GUEST_AUTH_URLS.md`

---

## Key Concepts at a Glance

### Two Types of Users
1. **Guest** (no login)
   - JWT: `{ sub: "guest-{UUID}", exp: +365d }`
   - Stored in `uid` cookie
   - Can use free tier
   - Dashboard: `/user/guest-{UUID}`

2. **Auth0** (email/password login)
   - OAuth2 + OIDC via Auth0
   - Session in secure cookie
   - Persistent across browser sessions
   - Dashboard: `/user/{auth0-id}`

### Middleware Protection
```
/ ..................... Public
/q/* ................... Public (query sharing)
/user/* ................ Requires uid cookie (guest OR auth0)
/admin/* ............... Requires Auth0 + admin:scope
```

### Dashboard URL Resolution
```
User visits /user/xxx
  → Query Payload CMS: where slug="/user/xxx"
  → Render dashboard if found
  → If user page (/user/*): require session
```

---

## File Locations

All documentation files are in the repository root:

```
/Users/lbelyaev/dev/semantic-grid/
├── AUTHENTICATION_QUICK_REFERENCE.md .................. START HERE
├── AUTHENTICATION_AND_DASHBOARD_FLOW.md ............... DEEP DIVE
├── BUG_REPORT_GUEST_AUTH_URLS.md ...................... BUG FIX
├── AUTH_DOCUMENTATION_SUMMARY.md ...................... SUMMARY
└── README_AUTHENTICATION_DOCS.md ....................... THIS FILE
```

Code files referenced:
```
apps/web/
├── middleware.ts ......................................... Route protection
├── app/api/auth/
│   ├── guest/route.ts .................................... Guest JWT
│   ├── [auth0]/route.ts ................................... Auth0 flow
│   └── session/route.ts ................................... Session endpoint
├── app/lib/
│   ├── authUser.ts ........................................ Server-side auth
│   ├── payload.ts ......................................... Dashboard CRUD
│   └── payload-types.ts ................................... Schema types
├── app/hooks/
│   ├── useAppUser.ts ...................................... Combined user state
│   ├── useAuthSession.ts .................................. Auth0 session
│   └── useGuest.ts ........................................ Guest lookup
├── app/(dash)/
│   ├── layout.tsx ......................................... Dashboard layout
│   ├── top-nav.tsx ........................................ Nav component
│   └── [[...section]]/page.tsx ........................... Dynamic dashboard page
├── app/components/
│   ├── TopNavClient.tsx ................................... Dashboard buttons
│   ├── UserProfileMenu.tsx ................................ Login/logout
│   ├── DashboardGrid.tsx .................................. Grid renderer
│   └── GridItemNavClient.tsx .............................. Save UI
├── app/actions.tsx ........................................ Server actions
└── app/layout.tsx ......................................... Root layout
```

---

## How to Use This Documentation

### Step 1: Understand the System
1. Read `AUTHENTICATION_QUICK_REFERENCE.md` (30 min)
2. Skim `AUTHENTICATION_AND_DASHBOARD_FLOW.md` for architecture (30 min)
3. Refer to specific sections as needed

### Step 2: Implement or Fix
1. Find your task in the quick reference
2. Follow the file references
3. Check code snippets for patterns
4. Run the testing checklist

### Step 3: Deploy or Review
1. Check environment variables
2. Review security sections
3. Run full test suite
4. Follow deployment checklist

---

## Key Findings Summary

### Issues Found
1. **Auth/Guest URL Confusion** (High Priority)
   - Authenticated users get "guest-" prefix in URLs
   - Cannot distinguish from guest sessions
   - Fix: Add `ownerType` field to schema

2. **No Dashboard Ownership Validation** (High Priority)
   - No check that user owns dashboard before mutation
   - Could allow cross-user modifications
   - Fix: Add `if (dashboard.ownerUserId !== userId)` check

3. **No Session Type UI Indicator** (Medium Priority)
   - Users cannot see session type from URL or UI
   - No "Guest" vs "Auth" label in navigation
   - Fix: Add session type label in TopNav

4. **Guest→Auth Migration Missing** (Medium Priority)
   - Guest dashboard orphaned after login
   - New separate dashboard created for auth user
   - Fix: Migrate guest items on first login

### Solutions Recommended
- Option B (Add `ownerType` field) is recommended
- Complete code changes provided in bug report
- Testing plan included
- Low deployment risk (derived field)

---

## For Different Roles

### For Backend Engineers
- Read: `AUTHENTICATION_AND_DASHBOARD_FLOW.md` sections 1-3
- Focus: Auth flows, database schema, API integration
- Check: Security section for auth best practices

### For Frontend Engineers
- Read: `AUTHENTICATION_QUICK_REFERENCE.md` sections 1-4
- Focus: useAppUser hook, URL routing, component integration
- Check: Common user flows and code snippets

### For DevOps/SRE
- Read: `AUTHENTICATION_AND_DASHBOARD_FLOW.md` section 5 & `AUTHENTICATION_QUICK_REFERENCE.md` deployment
- Focus: Environment variables, JWT keys, Auth0 configuration
- Check: Deployment checklist

### For QA/Testers
- Read: `AUTHENTICATION_QUICK_REFERENCE.md` testing checklist
- Read: `BUG_REPORT_GUEST_AUTH_URLS.md` testing plan
- Create test cases based on provided scenarios
- Check: Manual and automated testing examples

### For Product Managers
- Read: `AUTH_DOCUMENTATION_SUMMARY.md`
- Read: Bug report summary section
- Understand: Two user types, authentication flows, known issues
- Check: Impact analysis in bug report

---

## Questions Answered by These Docs

### "How does authentication work?"
→ `AUTHENTICATION_QUICK_REFERENCE.md` - How It Works section (25 min)

### "How do URLs get created for users?"
→ `AUTHENTICATION_QUICK_REFERENCE.md` - Dashboard URL Resolution section (10 min)

### "What's the security model?"
→ `AUTHENTICATION_AND_DASHBOARD_FLOW.md` - Security Considerations section (20 min)

### "How do I add authentication to a new page?"
→ `AUTHENTICATION_AND_DASHBOARD_FLOW.md` - Key Architecture Patterns section (30 min)

### "What's the bug with guest URLs?"
→ `BUG_REPORT_GUEST_AUTH_URLS.md` - Summary + Root Cause (20 min)

### "How do I fix the bug?"
→ `BUG_REPORT_GUEST_AUTH_URLS.md` - Solution Options + Recommended Fix Path (1-2 hours)

### "What environment variables do I need?"
→ `AUTHENTICATION_QUICK_REFERENCE.md` - Environment Variables section (5 min)

### "What test cases do I need?"
→ All documents have testing sections with checklists

---

## Related Documentation

If you also need to understand:
- **Flow Manager orchestration**: See `CLAUDE.md` in repo root
- **Database schema (Drizzle ORM)**: See schema files in `apps/web/app/db/`
- **Payload CMS integration**: See `apps/web/app/lib/payload.ts`
- **Auth0 configuration**: See Auth0 tenant docs + `AUTH0_*` env vars

---

## Last Updated

Generated: 2025-11-12  
Based on codebase analysis of: Semantic Grid monorepo (git commit 36131b6)

---

## Contributing to These Docs

If you find:
- Inaccuracies: Update the relevant section
- Missing information: Add new section with references
- New issues: Create separate bug report document
- Code changes: Update "Code Changes Required" sections

Keep documents in sync with actual code.

---

## Feedback

These docs should:
- [x] Explain how authentication works
- [x] Document all relevant files and flows
- [x] Identify the URL bug with root cause
- [x] Provide solutions with code examples
- [x] Include testing strategies
- [x] Cover deployment considerations
- [x] Be navigable for different roles

Missing anything? Check the individual documents or create a new analysis.

