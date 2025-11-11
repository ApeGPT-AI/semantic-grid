"""
Test Trino-specific SQL pagination quirks.

This test verifies that the build_sorted_paginated_sql function correctly
handles Trino's specific requirements:
1. Case-sensitive column names (must be quoted)
2. Deterministic pagination (requires ORDER BY)
3. Optimized COUNT queries (scalar subquery instead of window function)
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from fm_app.api.routes import build_sorted_paginated_sql


def test_trino_case_sensitive_columns():
    """Test that Trino quotes column names for case-sensitivity."""
    user_sql = "SELECT userId, userName FROM users"

    result = build_sorted_paginated_sql(
        user_sql,
        sort_by="userId",
        sort_order="desc",
        include_total_count=False,
        dialect="trino",
    )

    print("=== Trino Case-Sensitive Column Test ===")
    print(result)
    assert '"userId"' in result, "Column name should be quoted for Trino"
    assert "ORDER BY" in result, "Should have ORDER BY clause"
    print("✓ Pass: Column names are properly quoted\n")


def test_trino_default_order_by():
    """Test that Trino adds default ORDER BY when none is specified."""
    user_sql = "SELECT * FROM trades"

    result = build_sorted_paginated_sql(
        user_sql,
        sort_by=None,
        sort_order="asc",
        include_total_count=False,
        dialect="trino",
    )

    print("=== Trino Default ORDER BY Test ===")
    print(result)
    assert "ORDER BY 1 ASC" in result, "Should add default ORDER BY for deterministic pagination"
    print("✓ Pass: Default ORDER BY added for stability\n")


def test_trino_optimized_count():
    """Test that Trino uses scalar subquery for COUNT instead of window function."""
    user_sql = "SELECT * FROM large_table"

    result = build_sorted_paginated_sql(
        user_sql,
        sort_by="created_at",
        sort_order="desc",
        include_total_count=True,
        dialect="trino",
    )

    print("=== Trino Optimized COUNT Test ===")
    print(result)
    assert "(SELECT COUNT(*)" in result, "Should use scalar subquery for count"
    assert "count_subquery" in result, "Should have count subquery alias"
    assert "COUNT(*) OVER ()" not in result, "Should NOT use window function"
    print("✓ Pass: COUNT query is optimized with scalar subquery\n")


def test_clickhouse_window_function():
    """Test that ClickHouse still uses window function for COUNT (faster with CTEs)."""
    user_sql = "SELECT * FROM trades"

    result = build_sorted_paginated_sql(
        user_sql,
        sort_by="timestamp",
        sort_order="asc",
        include_total_count=True,
        dialect="clickhouse",
    )

    print("=== ClickHouse Window Function Test ===")
    print(result)
    assert "COUNT(*) OVER ()" in result, "Should use window function for ClickHouse"
    assert "WITH orig_sql AS" in result, "Should use CTE"
    print("✓ Pass: ClickHouse uses window function as expected\n")


def test_postgres_no_quoting():
    """Test that Postgres doesn't quote column names unnecessarily."""
    user_sql = "SELECT id, name FROM users"

    result = build_sorted_paginated_sql(
        user_sql,
        sort_by="name",
        sort_order="asc",
        include_total_count=False,
        dialect="postgres",
    )

    print("=== Postgres No Quoting Test ===")
    print(result)
    assert '"name"' not in result, "Postgres shouldn't quote simple column names"
    assert "ORDER BY name" in result, "Should have unquoted column name"
    print("✓ Pass: Postgres doesn't add unnecessary quotes\n")


def test_dialect_auto_detection():
    """Test that dialect is auto-detected when not provided."""
    user_sql = "SELECT * FROM test"

    # This should not crash - it will use whatever dialect is configured
    result = build_sorted_paginated_sql(
        user_sql,
        sort_by="id",
        sort_order="asc",
        include_total_count=True,
        dialect=None,  # Auto-detect
    )

    print("=== Auto-Detection Test ===")
    print(f"Generated SQL (using auto-detected dialect):\n{result}")
    assert "ORDER BY" in result, "Should have ORDER BY clause"
    assert "LIMIT :limit" in result, "Should have LIMIT"
    assert "OFFSET :offset" in result, "Should have OFFSET"
    print("✓ Pass: Auto-detection works\n")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Testing Trino-Specific SQL Pagination")
    print("=" * 60 + "\n")

    test_trino_case_sensitive_columns()
    test_trino_default_order_by()
    test_trino_optimized_count()
    test_clickhouse_window_function()
    test_postgres_no_quoting()
    test_dialect_auto_detection()

    print("=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
