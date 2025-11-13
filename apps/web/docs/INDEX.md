# Web App Documentation Index

This directory contains comprehensive documentation for the Semantic Grid web application.

## Authentication & User Management

Start here: **[README_AUTHENTICATION_DOCS.md](./README_AUTHENTICATION_DOCS.md)** - Navigation guide for all auth docs.

### Quick References
- **[AUTHENTICATION_QUICK_REFERENCE.md](./AUTHENTICATION_QUICK_REFERENCE.md)** ⭐ - Quick start guide with 4 main flows
- **[AUTH_DOCUMENTATION_SUMMARY.md](./AUTH_DOCUMENTATION_SUMMARY.md)** - Overview and key concepts

### Deep Dives
- **[AUTHENTICATION_AND_DASHBOARD_FLOW.md](./AUTHENTICATION_AND_DASHBOARD_FLOW.md)** - Comprehensive technical analysis (20 KB)
- **[AUTHENTICATION_VISUAL_FLOWS.md](./AUTHENTICATION_VISUAL_FLOWS.md)** - 20+ ASCII diagrams of flows
- **[AUTHENTICATION_DOCS_INDEX.md](./AUTHENTICATION_DOCS_INDEX.md)** - Master index with detailed navigation

### Bug Reports & Fixes
- **[BUG_REPORT_GUEST_AUTH_URLS.md](./BUG_REPORT_GUEST_AUTH_URLS.md)** - Original bug analysis (pre-fix)
- **[FIX_AUTH_DASHBOARD_URLS.md](./FIX_AUTH_DASHBOARD_URLS.md)** ✅ - Implemented fix for auth user dashboard URLs
- **[UUID_V5_AUTH_CONVERSION.md](./UUID_V5_AUTH_CONVERSION.md)** ✅ - UUID v5 conversion for Auth0 user IDs

### Project Documentation
- **[DOCUMENTATION_COMPLETE.md](./DOCUMENTATION_COMPLETE.md)** - Summary of documentation project

## Error Handling

- **[ERROR_HANDLING.md](./ERROR_HANDLING.md)** - Comprehensive error handling system documentation
  - Global error boundaries
  - API error notifications
  - Client-side error handling
  - Testing guide

## Recent Fixes (November 2025)

**📋 Complete Summary**: [SESSION_SUMMARY_2025_11_12.md](./SESSION_SUMMARY_2025_11_12.md)

### Linked Query Improvements
- Fixed duplicate session creation for linked queries
- Improved request bubble display with query summaries
- Changed progress indicator to show "Summarizing..." for linked queries

### Authentication & Dashboard URLs
- Implemented auth-first, guest-fallback user ID resolution
- Fixed authenticated users getting "guest-" prefix in dashboard URLs
- Implemented UUID v5 conversion for Auth0 user IDs
- See [FIX_AUTH_DASHBOARD_URLS.md](./FIX_AUTH_DASHBOARD_URLS.md) and [UUID_V5_AUTH_CONVERSION.md](./UUID_V5_AUTH_CONVERSION.md) for details

## Contributing

When adding new documentation:
1. Place it in this directory (`apps/web/docs/`)
2. Update this INDEX.md file
3. Use clear, descriptive filenames
4. Include code examples and diagrams where helpful
