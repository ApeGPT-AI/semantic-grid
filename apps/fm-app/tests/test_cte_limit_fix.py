"""
Test for CTE query with trailing LIMIT.
Reproduces the production error where duplicate LIMIT clauses were generated.
"""

import os
from unittest import mock

# Set environment variables before importing fm_app modules
os.environ.setdefault('DATABASE_USER', 'test')
os.environ.setdefault('DATABASE_PASS', 'test')
os.environ.setdefault('DATABASE_SERVER', 'localhost')
os.environ.setdefault('DATABASE_PORT', '5432')
os.environ.setdefault('DATABASE_DB', 'test')
os.environ.setdefault('DATABASE_WH_SERVER', 'localhost')
os.environ.setdefault('DATABASE_WH_PORT', '5432')
os.environ.setdefault('DATABASE_WH_DB', 'test')
os.environ.setdefault('DATABASE_WH_USER', 'test')
os.environ.setdefault('DATABASE_WH_PASS', 'test')
os.environ.setdefault('DATABASE_WH_PARAMS', '')
os.environ.setdefault('DATABASE_WH_DRIVER', 'postgresql')
os.environ.setdefault('DATABASE_WH_NEW_SERVER', 'localhost')
os.environ.setdefault('DATABASE_WH_NEW_PORT', '5432')
os.environ.setdefault('DATABASE_WH_NEW_DB', 'test')
os.environ.setdefault('DATABASE_WH_NEW_USER', 'test')
os.environ.setdefault('DATABASE_WH_NEW_PASS', 'test')
os.environ.setdefault('DATABASE_WH_NEW_PARAMS', '')
os.environ.setdefault('DATABASE_WH_NEW_DRIVER', 'postgresql')
os.environ.setdefault('DATABASE_WH_V2_SERVER', 'localhost')
os.environ.setdefault('DATABASE_WH_V2_PORT', '9000')
os.environ.setdefault('DATABASE_WH_V2_DB', 'default')
os.environ.setdefault('DATABASE_WH_V2_USER', 'default')
os.environ.setdefault('DATABASE_WH_V2_PASS', '')
os.environ.setdefault('DATABASE_WH_V2_PARAMS', '')
os.environ.setdefault('DATABASE_WH_V2_DRIVER', 'clickhouse')
os.environ.setdefault('ANTHROPIC_API_KEY', 'test')
os.environ.setdefault('OPENAI_API_KEY', 'test')
os.environ.setdefault('LLM_MODEL', 'test')
os.environ.setdefault('AUTH0_SECRET', 'test')
os.environ.setdefault('AUTH0_BASE_URL', 'http://localhost')
os.environ.setdefault('AUTH0_ISSUER_BASE_URL', 'http://localhost')
os.environ.setdefault('AUTH0_AUDIENCE', 'test')

from fm_app.api.routes import build_sorted_paginated_sql


def test_cte_with_trailing_limit_clickhouse():
    """
    Test that CTE queries with trailing LIMIT don't generate duplicate LIMIT clauses.
    Reproduces the production error from ClickHouse.
    """
    sql = """
-- CTE: Filter trades in the last 24h
WITH last_24h_trades AS (
    SELECT *
    FROM enriched_trades
    WHERE ts >= now() - INTERVAL 1 DAY
),
-- CTE: Calculate per-trade win/loss (SELL trades only)
per_trade_pnl AS (
    SELECT
        destination_account_owner AS trader,
        signature,
        profit_usd,
        cost_basis_usd,
        (profit_usd > 0) AS is_win
    FROM last_24h_trades
    WHERE side = 'SELL' AND profit_usd IS NOT NULL
),
-- CTE: Count all trades per trader
trade_counts AS (
    SELECT
        destination_account_owner AS trader,
        count(DISTINCT signature) AS num_trades
    FROM last_24h_trades
    WHERE destination_account_owner IS NOT NULL
    GROUP BY trader
),
-- CTE: Aggregate P&L and win rate per trader
trader_stats AS (
    SELECT
        p.trader,
        sum(p.profit_usd) AS total_pnl_usd,
        count() AS num_sell_trades,
        sum(p.is_win) AS num_wins
    FROM per_trade_pnl p
    GROUP BY p.trader
)
SELECT
    t.trader AS wallet,
    t.total_pnl_usd AS pnl_24h_usd,
    c.num_trades AS trades_24h,
    round(t.num_wins / t.num_sell_trades * 100, 2) AS win_rate_24h_pct
FROM trader_stats t
JOIN trade_counts c ON t.trader = c.trader
ORDER BY pnl_24h_usd DESC
LIMIT 10;
"""

    # Test with ClickHouse dialect
    with mock.patch('fm_app.utils.get_cached_warehouse_dialect', return_value='clickhouse'):
        result = build_sorted_paginated_sql(
            sql,
            sort_by='pnl_24h_usd',
            sort_order='desc',
            include_total_count=False,
        )

        # Should have exactly ONE LIMIT clause (the parameterized one)
        limit_count = result.count('LIMIT')
        assert limit_count == 1, f"Expected 1 LIMIT, found {limit_count}. Query:\n{result}"

        # Should have the pagination LIMIT placeholder
        assert 'LIMIT :limit' in result, "Should have LIMIT :limit for pagination"

        # Should have OFFSET placeholder
        assert 'OFFSET :offset' in result, "Should have OFFSET :offset"

        # Original LIMIT 10 should be removed
        assert 'LIMIT 10' not in result, "Original LIMIT 10 should be removed"

        # Should still have all the CTEs
        assert 'WITH last_24h_trades AS' in result
        assert 'per_trade_pnl AS' in result
        assert 'trade_counts AS' in result
        assert 'trader_stats AS' in result

        print("✅ Test passed: CTE with trailing LIMIT handles correctly")
        print(f"Generated SQL (last 200 chars):\n...{result[-200:]}")


if __name__ == "__main__":
    test_cte_with_trailing_limit_clickhouse()
    print("\n✅ All tests passed!")
