# Trino Database Support

This document describes the Trino-specific optimizations and handling in the pagination system.

## Overview

Trino has several quirks that differ from ClickHouse and PostgreSQL when it comes to dynamic query modification for sorting and pagination:

1. **Case-sensitive identifiers**: Unquoted identifiers are converted to lowercase
2. **Non-deterministic pagination**: OFFSET without ORDER BY produces unpredictable results
3. **CTE optimization**: CTEs may not be materialized, leading to double execution
4. **Window function performance**: COUNT(*) OVER() can be slow on large datasets

## Implementation

### Dialect Detection

The system auto-detects the database dialect from the SQLAlchemy engine:

```python
from fm_app.utils.dialect import get_cached_warehouse_dialect

dialect = get_cached_warehouse_dialect()  # Returns: 'trino', 'clickhouse', 'postgres', etc.
```

### Case-Sensitive Column Names

**Problem**: Trino converts unquoted identifiers to lowercase. If your data has mixed-case column names like `userId`, Trino won't find them without quotes.

**Solution**: The `build_sorted_paginated_sql` function automatically quotes column names when generating SQL for Trino:

```python
# For Trino
ORDER BY "userId" DESC  # Quoted for case-sensitivity

# For ClickHouse/Postgres
ORDER BY userId DESC    # No quoting needed
```

### Deterministic Pagination

**Problem**: Trino doesn't guarantee row order without an explicit ORDER BY clause. Pagination with LIMIT/OFFSET becomes non-deterministic.

**Solution**: When no `sort_by` is provided, Trino automatically adds `ORDER BY 1 ASC` (sort by first column):

```sql
-- User provides no sort_by
SELECT t.* FROM (user_query) AS t
ORDER BY 1 ASC  -- Added automatically for Trino
LIMIT :limit OFFSET :offset
```

### Optimized COUNT Queries

**Problem**: In Trino, CTEs are not always materialized. Using `COUNT(*) OVER ()` can cause the base query to execute twice - once for the data and once for the count.

**Solution**: For Trino, we use a scalar subquery instead of a window function:

```sql
-- Trino: Scalar subquery (single execution)
SELECT
  t.*,
  (SELECT COUNT(*) FROM (user_query) AS count_subquery) AS total_count
FROM (user_query) AS t
ORDER BY "userId" DESC
LIMIT :limit OFFSET :offset;

-- ClickHouse/Postgres: Window function (CTE is materialized)
WITH orig_sql AS (
  user_query
)
SELECT
  t.*,
  COUNT(*) OVER () AS total_count
FROM orig_sql AS t
ORDER BY userId DESC
LIMIT :limit OFFSET :offset;
```

## Usage

The function automatically detects the dialect and applies the appropriate optimizations:

```python
from fm_app.api.routes import build_sorted_paginated_sql

# Auto-detect dialect
sql = build_sorted_paginated_sql(
    user_sql="SELECT userId, userName FROM users",
    sort_by="userId",
    sort_order="desc",
    include_total_count=True,
)

# Or explicitly specify Trino
sql = build_sorted_paginated_sql(
    user_sql="SELECT userId, userName FROM users",
    sort_by="userId",
    sort_order="desc",
    include_total_count=True,
    dialect="trino",
)
```

## Testing

Run the Trino-specific tests to verify behavior:

```bash
cd apps/fm-app
uv run python examples/test_trino_pagination.py
```

Tests cover:
- ✅ Case-sensitive column quoting
- ✅ Default ORDER BY for stability
- ✅ Optimized COUNT queries
- ✅ Comparison with ClickHouse/Postgres behavior

## Performance Considerations

### Trino

- **Scalar subquery for COUNT**: Slightly less efficient than window functions but avoids double execution
- **Quoted identifiers**: Minimal performance impact
- **Mandatory ORDER BY**: Ensures deterministic results but adds sorting overhead if not indexed

### ClickHouse

- **Window function for COUNT**: Very efficient due to CTE materialization
- **No column quoting**: Cleaner SQL, no overhead

### PostgreSQL

- **Window function for COUNT**: Efficient with proper indexing
- **No column quoting**: Standard SQL behavior

## Migration Notes

If you're migrating from ClickHouse/Postgres to Trino:

1. **Review column names**: Ensure mixed-case columns are handled correctly
2. **Check sorting**: Queries without explicit ORDER BY will now have a default sort
3. **Monitor performance**: The COUNT optimization may behave differently than window functions
4. **Test pagination**: Verify that paginated results are stable and deterministic

## Known Limitations

1. **Column name escaping**: Currently escapes double quotes by doubling them (`"` → `""`). If column names contain other special characters, additional escaping may be needed.

2. **ORDER BY 1 fallback**: When no sort column is specified, falls back to sorting by the first column. This may not be the desired behavior for all queries.

3. **COUNT performance**: The scalar subquery approach executes the base query separately for counting. For very large result sets, consider fetching the count separately if needed.

## Future Enhancements

Potential improvements for Trino support:

- [ ] Configurable fallback ORDER BY column (instead of `1`)
- [ ] Option to skip COUNT query entirely for better performance
- [ ] Support for complex column expressions in ORDER BY
- [ ] Automatic index hint generation for Trino
- [ ] Connection-level caching of dialect to avoid repeated detection
