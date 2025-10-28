# CTE LIMIT Duplication Fix

**Date:** 2025-10-27
**Status:** Fixed and deployed to main

## Problem

Production queries with CTEs and trailing LIMIT clauses were failing with ClickHouse syntax errors:

```sql
-- Query like this:
WITH trader_stats AS (...)
SELECT ...
ORDER BY pnl_24h_usd DESC
LIMIT 10;

-- Generated invalid SQL:
... ORDER BY pnl_24h_usd DESC LIMIT 10
LIMIT 100
OFFSET 0
```

**Error message:**
```
SQL syntax error: Code: 62.
DB::Exception: Syntax error: failed at position 1312 (line 45, col 7): 100
Expected one of: token, ..., LIMIT
```

## Root Cause

In `fm_app/api/routes.py`, the `_strip_final_order_by_and_trailing()` function had logic to skip LIMIT/OFFSET removal for CTE queries:

```python
# Before (BROKEN):
if not is_cte:
    m = _TRAILING_LIMIT_OFFSET_FETCH_RE.search(s)
    if m:
        s = s[: m.start()]
```

The comment said: "For CTE queries, skip this step as the regex is too greedy and will match LIMIT clauses inside CTEs".

However, this was incorrect reasoning because:
1. The `_TRAILING_LIMIT_OFFSET_FETCH_RE` regex uses `$` anchor
2. It ONLY matches at the very end of the SQL string
3. It's safe to use even for CTE queries - won't match LIMITs inside nested CTEs

## Solution

Removed the `if not is_cte:` condition so trailing LIMIT/OFFSET are always stripped:

```python
# After (FIXED):
m = _TRAILING_LIMIT_OFFSET_FETCH_RE.search(s)
if m:
    s = s[: m.start()]
```

Updated comment to reflect the correct behavior:
```python
# The regex uses $ anchor so it only matches at the very end,
# safe to use even for CTE queries (won't match LIMITs inside CTEs)
```

## Testing

Created `apps/fm-app/tests/test_cte_limit_fix.py` with the exact production query that failed:
- ✅ Verifies no duplicate LIMIT clauses
- ✅ Confirms original LIMIT is removed
- ✅ Confirms pagination LIMIT/OFFSET are added

All existing tests still pass:
- ✅ `test_pagination.py`: 10/10 tests passing
- ✅ CTE queries with PostgreSQL
- ✅ CTE queries with ClickHouse
- ✅ Regular queries with and without sorting

## Files Changed

- `apps/fm-app/fm_app/api/routes.py` - Fixed stripping logic
- `apps/fm-app/tests/test_cte_limit_fix.py` - New test with production query

## Impact

This fix resolves all CTE queries with trailing LIMIT clauses that were failing in production with ClickHouse syntax errors.
