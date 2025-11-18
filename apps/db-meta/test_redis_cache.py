"""
Quick test script for Redis caching functionality.
"""

import logging

logging.basicConfig(level=logging.INFO)

from dbmeta_app.cache import get_cache


def test_redis_cache():
    """Test basic Redis cache operations."""

    print("\n=== Redis Cache Test ===\n")

    cache = get_cache()

    # Check if Redis is enabled
    print(f"Cache enabled: {cache.enabled}")
    print(f"Cache host: {cache.host}:{cache.port}")

    if not cache.enabled:
        print("\n❌ Redis cache is disabled (connection failed)")
        print("   Make sure Redis is running: redis-server")
        return False

    # Test 1: Health check
    print("\n1. Health check...")
    healthy = cache.health_check()
    print(f"   {'✓' if healthy else '✗'} Health: {healthy}")

    if not healthy:
        return False

    # Test 2: Set and Get
    print("\n2. Testing set/get...")
    test_key = "test"
    test_value = {"message": "Hello Redis!", "number": 42, "nested": {"key": "value"}}

    cache.set(test_key, test_value, 60, "arg1", "arg2", kwarg1="value1")
    retrieved = cache.get(test_key, "arg1", "arg2", kwarg1="value1")

    print(f"   Set: {test_value}")
    print(f"   Get: {retrieved}")
    print(
        f"   {'✓' if retrieved == test_value else '✗'} Match: {retrieved == test_value}"
    )

    # Test 3: Cache miss
    print("\n3. Testing cache miss...")
    missing = cache.get("nonexistent", "args")
    print(
        f"   {'✓' if missing is None else '✗'} Cache miss returns None: {missing is None}"
    )

    # Test 4: Delete
    print("\n4. Testing delete...")
    cache.delete(test_key, "arg1", "arg2", kwarg1="value1")
    after_delete = cache.get(test_key, "arg1", "arg2", kwarg1="value1")
    print(
        f"   {'✓' if after_delete is None else '✗'} After delete: {after_delete is None}"
    )

    # Test 5: Clear prefix
    print("\n5. Testing clear_prefix...")
    cache.set("schema", {"table": "users"}, 60, "profile1")
    cache.set("schema", {"table": "orders"}, 60, "profile2")
    cache.set("examples", {"query": "SELECT *"}, 60, "query1")

    deleted = cache.clear_prefix("schema")
    print(
        f"   {'✓' if deleted >= 2 else '✗'} Deleted {deleted} keys with 'schema' prefix"
    )

    # Verify schema keys are gone but examples remain
    schema_gone = cache.get("schema", "profile1") is None
    examples_remain = cache.get("examples", "query1") is not None
    print(f"   {'✓' if schema_gone else '✗'} Schema keys deleted: {schema_gone}")
    print(
        f"   {'✓' if examples_remain else '✗'} Examples keys remain: {examples_remain}"
    )

    # Cleanup
    cache.clear_prefix("examples")

    print("\n=== All tests passed! ✓ ===\n")
    return True


if __name__ == "__main__":
    success = test_redis_cache()
    exit(0 if success else 1)
