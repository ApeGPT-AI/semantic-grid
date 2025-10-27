"""
Test all query examples from client config YAML files.

This ensures our pagination logic works correctly with real production queries.
"""

import sys
import os
from pathlib import Path
from unittest import mock
import yaml

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fm_app.api.routes import build_sorted_paginated_sql


def load_query_examples():
    """Load query examples from the apegpt prod config."""
    repo_root = Path(__file__).parent.parent.parent.parent
    yaml_path = repo_root / "packages/client-configs/apegpt/prod/dbmeta_app/overlays/resources/query_examples.yaml"

    with open(yaml_path, 'r') as f:
        data = yaml.safe_load(f)

    examples = []
    for profile, profile_data in data.get('profiles', {}).items():
        for idx, example in enumerate(profile_data.get('examples', []), 1):
            examples.append({
                'profile': profile,
                'index': idx,
                'request': example.get('request', '').strip(),
                'query': example.get('response', '').strip(),
                'db': example.get('db', '')
            })

    return examples


def test_query_example(example, dialect='clickhouse'):
    """Test a single query example with pagination."""
    query = example['query']

    # Test without sorting
    try:
        result_no_sort = build_sorted_paginated_sql(
            query,
            sort_by=None,
            sort_order="asc",
            include_total_count=True
        )

        # Basic validation: query should contain LIMIT and OFFSET
        assert 'LIMIT :limit' in result_no_sort, "Missing LIMIT clause"
        assert 'OFFSET :offset' in result_no_sort, "Missing OFFSET clause"

        # Query should not be empty
        assert len(result_no_sort) > 100, "Query seems too short, might be truncated"

        # Check if CTE queries are preserved
        if query.strip().upper().startswith('WITH'):
            # Count WITH occurrences in original vs result
            original_with_count = query.upper().count('WITH')
            result_with_count = result_no_sort.upper().count('WITH')

            # Result should have same or more WITH (might wrap in outer CTE)
            assert result_with_count >= original_with_count, \
                f"CTE count mismatch: original={original_with_count}, result={result_with_count}"

        return True, None

    except Exception as e:
        return False, str(e)


def main():
    print("=" * 80)
    print("TESTING QUERY EXAMPLES FROM CLIENT CONFIG")
    print("=" * 80)
    print()

    examples = load_query_examples()
    print(f"Loaded {len(examples)} query examples")
    print()

    passed = 0
    failed = 0
    errors = []

    # Test with ClickHouse dialect
    with mock.patch('fm_app.utils.get_cached_warehouse_dialect', return_value='clickhouse'):
        for example in examples:
            profile = example['profile']
            idx = example['index']
            request = example['request'][:60] + "..." if len(example['request']) > 60 else example['request']

            print(f"Test {idx}/{len(examples)}: {profile} - {request}")

            success, error = test_query_example(example)

            if success:
                print(f"  ✓ Passed")
                passed += 1
            else:
                print(f"  ✗ Failed: {error}")
                failed += 1
                errors.append({
                    'profile': profile,
                    'index': idx,
                    'request': example['request'],
                    'error': error
                })

            print()

    print("=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed out of {len(examples)} total")
    print("=" * 80)

    if errors:
        print("\nFailed queries:")
        for err in errors:
            print(f"\n  Profile: {err['profile']}, Index: {err['index']}")
            print(f"  Request: {err['request'][:100]}")
            print(f"  Error: {err['error']}")

    if failed > 0:
        exit(1)


if __name__ == "__main__":
    main()
