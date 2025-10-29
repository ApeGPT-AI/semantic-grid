"""
Unit tests for SQL pagination with CTE support.
Tests for the simplified build_sorted_paginated_sql() implementation.
"""

import os
import sys
from unittest import mock

# Set minimal environment variables before importing fm_app
# This prevents Settings validation errors in CI
os.environ.setdefault('DATABASE_USER', 'test')
os.environ.setdefault('DATABASE_PASS', 'test')
os.environ.setdefault('DATABASE_PORT', '5432')
os.environ.setdefault('DATABASE_SERVER', 'localhost')
os.environ.setdefault('DATABASE_DB', 'test')
os.environ.setdefault('DATABASE_WH_USER', 'test')
os.environ.setdefault('DATABASE_WH_PASS', 'test')
os.environ.setdefault('DATABASE_WH_PORT', '8123')
os.environ.setdefault('DATABASE_WH_PORT_NEW', '8123')
os.environ.setdefault('DATABASE_WH_PORT_V2', '8123')
os.environ.setdefault('DATABASE_WH_SERVER', 'localhost')
os.environ.setdefault('DATABASE_WH_SERVER_NEW', 'localhost')
os.environ.setdefault('DATABASE_WH_SERVER_V2', 'localhost')
os.environ.setdefault('DATABASE_WH_PARAMS', '')
os.environ.setdefault('DATABASE_WH_PARAMS_NEW', '')
os.environ.setdefault('DATABASE_WH_PARAMS_V2', '')
os.environ.setdefault('DATABASE_WH_DB', 'test')
os.environ.setdefault('DATABASE_WH_DB_NEW', 'test')
os.environ.setdefault('DATABASE_WH_DB_V2', 'test')
os.environ.setdefault('AUTH0_DOMAIN', 'test.auth0.com')
os.environ.setdefault('AUTH0_API_AUDIENCE', 'test')
os.environ.setdefault('AUTH0_ISSUER', 'https://test.auth0.com/')
os.environ.setdefault('AUTH0_ALGORITHMS', 'RS256')
os.environ.setdefault('DBMETA', 'http://localhost:8000')
os.environ.setdefault('DBREF', 'http://localhost:8000')
os.environ.setdefault('IRL_SLOTS', '')
os.environ.setdefault('GOOGLE_PROJECT_ID', 'test')
os.environ.setdefault('GOOGLE_CRED_FILE', 'test.json')
os.environ.setdefault('ANTHROPIC_API_KEY', 'sk-ant-test')
os.environ.setdefault('OPENAI_API_KEY', 'sk-test')
os.environ.setdefault('DEEPSEEK_AI_API_URL', 'http://localhost')
os.environ.setdefault('DEEPSEEK_AI_API_KEY', 'test')
os.environ.setdefault('GUEST_AUTH_HOST', 'localhost')
os.environ.setdefault('GUEST_AUTH_ISSUER', 'http://localhost')

# Add the parent directory to the path so we can import fm_app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fm_app.api.routes import build_sorted_paginated_sql


def test_regular_query_without_sort():
    """Test regular SELECT query without sorting - with include_total_count."""
    sql = "SELECT id, name FROM users"
    result = build_sorted_paginated_sql(
        sql,
        sort_by=None,
        sort_order="asc",
        include_total_count=True
    )

    # Implementation wraps in CTE with actual user SQL
    assert "WITH orig_sql AS" in result
    assert "SELECT id, name FROM users" in result
    assert "FROM orig_sql AS t" in result
    assert "COUNT(*) OVER () AS _inner_count" in result
    assert "LIMIT :limit OFFSET :offset" in result
    # No sort_by provided, so no ORDER BY should be added
    assert "ORDER BY" not in result
    print("✅ Test 1 passed: Regular query without sort (with total count)")


def test_regular_query_with_sort():
    """Test regular SELECT query with sorting - without include_total_count."""
    sql = "SELECT id, name FROM users"
    result = build_sorted_paginated_sql(
        sql,
        sort_by="name",
        sort_order="desc",
        include_total_count=False
    )

    # Implementation: always CTE wrapper, no total count when False
    assert "WITH orig_sql AS" in result
    assert "SELECT id, name FROM users" in result
    assert "FROM orig_sql AS t" in result
    assert "ORDER BY name desc" in result
    assert "COUNT(*)" not in result
    assert "LIMIT :limit OFFSET :offset" in result
    print("✅ Test 2 passed: Regular query with sort (no total count)")


def test_cte_query_postgres():
    """Test CTE query - implementation treats all queries the same."""
    sql = """
    WITH temp AS (
        SELECT id, name FROM users
    )
    SELECT * FROM temp
    """

    # Implementation doesn't check dialect - wraps everything the same way
    with mock.patch('fm_app.utils.get_cached_warehouse_dialect', return_value='postgres'):
        result = build_sorted_paginated_sql(
            sql,
            sort_by=None,
            sort_order="asc",
            include_total_count=True
        )

        # Always wrapped in CTE with actual user SQL
        assert "WITH orig_sql AS" in result
        assert "WITH temp AS" in result  # Original CTE preserved
        assert "FROM orig_sql AS t" in result
        assert "COUNT(*) OVER () AS _inner_count" in result

    print("✅ Test 3 passed: CTE query with PostgreSQL")


def test_cte_query_clickhouse():
    """Test CTE query - implementation treats all queries the same."""
    sql = """
    WITH temp AS (
        SELECT id, name FROM users
    )
    SELECT * FROM temp
    """

    # Implementation doesn't check dialect
    with mock.patch('fm_app.utils.get_cached_warehouse_dialect', return_value='clickhouse'):
        result = build_sorted_paginated_sql(
            sql,
            sort_by=None,
            sort_order="asc",
            include_total_count=True
        )

        # Same as PostgreSQL - no special handling
        assert "WITH orig_sql AS" in result
        assert "WITH temp AS" in result
        assert "FROM orig_sql AS t" in result
        assert "COUNT(*) OVER () AS _inner_count" in result

    print("✅ Test 3b passed: CTE query with ClickHouse")


def test_cte_query_with_sort_postgres():
    """Test CTE query with sorting on PostgreSQL."""
    sql = """
    WITH temp AS (
        SELECT id, name FROM users
    )
    SELECT * FROM temp
    """

    with mock.patch('fm_app.utils.get_cached_warehouse_dialect', return_value='postgres'):
        result = build_sorted_paginated_sql(
            sql,
            sort_by="name",
            sort_order="asc",
            include_total_count=True
        )

        # Fixed: ORDER BY should be added even with include_total_count=True
        assert "WITH orig_sql AS" in result
        assert "FROM orig_sql AS t" in result
        assert "COUNT(*) OVER () AS _inner_count" in result
        assert "ORDER BY name asc" in result

    print("✅ Test 4 passed: CTE query with sort (PostgreSQL)")


def test_cte_query_with_sort_clickhouse():
    """Test CTE query with sorting on ClickHouse."""
    sql = """
    WITH temp AS (
        SELECT id, name FROM users
    )
    SELECT * FROM temp
    """

    with mock.patch('fm_app.utils.get_cached_warehouse_dialect', return_value='clickhouse'):
        result = build_sorted_paginated_sql(
            sql,
            sort_by="name",
            sort_order="asc",
            include_total_count=False
        )

        # With include_total_count=False, ORDER BY is added
        assert "WITH orig_sql AS" in result
        assert "FROM orig_sql AS t" in result
        assert "ORDER BY name asc" in result
        assert "COUNT(*)" not in result

    print("✅ Test 4b passed: CTE query with sort (ClickHouse)")


def test_complex_cte_query():
    """Test complex multi-CTE query."""
    sql = """
    WITH
        now() AS t_now,
        t_now - INTERVAL 24 HOUR AS t_start,
        base AS (
            SELECT * FROM trades WHERE ts >= t_start
        ),
        top_traders AS (
            SELECT trader, sum(pnl) AS total_pnl
            FROM base
            GROUP BY trader
        )
    SELECT * FROM top_traders
    """

    with mock.patch('fm_app.utils.get_cached_warehouse_dialect', return_value='clickhouse'):
        result = build_sorted_paginated_sql(
            sql,
            sort_by="total_pnl",
            sort_order="desc",
            include_total_count=False  # Changed to False to get ORDER BY
        )

        # Implementation wraps everything in CTE
        assert "WITH orig_sql AS" in result
        assert "WITH" in result  # Original WITH is preserved
        assert "ORDER BY total_pnl desc" in result
        assert "FROM orig_sql AS t" in result

    print("✅ Test 5 passed: Complex multi-CTE query")


def test_query_with_trailing_semicolon():
    """Test that trailing semicolons are preserved."""
    sql = "SELECT id, name FROM users;"
    result = build_sorted_paginated_sql(
        sql,
        sort_by="id",
        sort_order="asc",
        include_total_count=False
    )

    # Semicolon from user SQL is preserved, plus one at the end
    assert "SELECT id, name FROM users;" in result
    assert result.strip().endswith(";")
    print("✅ Test 6 passed: Trailing semicolon handling")


def test_query_with_existing_order_by():
    """Test that existing ORDER BY is preserved in the CTE."""
    sql = "SELECT id, name FROM users ORDER BY created_at DESC"
    result = build_sorted_paginated_sql(
        sql,
        sort_by="name",
        sort_order="asc",
        include_total_count=False
    )

    # Implementation doesn't strip ORDER BY from user SQL
    assert "WITH orig_sql AS" in result
    assert "SELECT id, name FROM users ORDER BY created_at DESC" in result
    assert "ORDER BY name asc" in result  # Our new ORDER BY
    # Original ORDER BY is preserved in the CTE, so it appears twice
    assert result.count("ORDER BY") >= 2
    print("✅ Test 7 passed: Existing ORDER BY preserved in CTE")


def test_case_insensitive_with():
    """Test that lowercase 'with' is handled the same way."""
    sql = "with temp as (select 1) select * from temp"

    with mock.patch('fm_app.utils.get_cached_warehouse_dialect', return_value='postgres'):
        result = build_sorted_paginated_sql(
            sql,
            sort_by="id",
            sort_order="asc",
            include_total_count=True
        )

        # Implementation wraps everything in CTE regardless
        assert "WITH orig_sql AS" in result
        assert "with temp as (select 1) select * from temp" in result
        assert "FROM orig_sql AS t" in result
        assert "COUNT(*) OVER () AS _inner_count" in result
        # Fixed: ORDER BY should be added when sort_by is provided
        assert "ORDER BY id asc" in result

    print("✅ Test 8 passed: Case-insensitive WITH detection")


def test_no_sort_without_total_count():
    """Test that sort_by=None without total count doesn't generate invalid ORDER BY."""
    sql = "SELECT id, name FROM users"
    result = build_sorted_paginated_sql(
        sql,
        sort_by=None,
        sort_order="asc",
        include_total_count=False
    )

    # Should not have "ORDER BY None" or any ORDER BY when sort_by is None
    assert "ORDER BY" not in result
    assert "WITH orig_sql AS" in result
    assert "FROM orig_sql AS t" in result
    assert "LIMIT :limit OFFSET :offset" in result
    assert "COUNT(*)" not in result

    print("✅ Test 9 passed: No invalid ORDER BY when sort_by is None")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("SQL PAGINATION TESTS")
    print("="*60)

    tests = [
        ("Regular query without sort", test_regular_query_without_sort),
        ("Regular query with sort", test_regular_query_with_sort),
        ("CTE query with PostgreSQL", test_cte_query_postgres),
        ("CTE query with ClickHouse", test_cte_query_clickhouse),
        ("CTE query with sort (PostgreSQL)", test_cte_query_with_sort_postgres),
        ("CTE query with sort (ClickHouse)", test_cte_query_with_sort_clickhouse),
        ("Complex multi-CTE query", test_complex_cte_query),
        ("Trailing semicolon handling", test_query_with_trailing_semicolon),
        ("Existing ORDER BY stripped", test_query_with_existing_order_by),
        ("Case-insensitive WITH", test_case_insensitive_with),
        ("No sort without total count", test_no_sort_without_total_count),
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"❌ FAILED: {test_name}")
            print(f"   Error: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR in {test_name}: {e}")
            failed += 1

    print("\n" + "="*60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("="*60)

    if failed > 0:
        exit(1)
