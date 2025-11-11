#!/usr/bin/env python3
"""
Extract ClickHouse schema and generate Postgres-compatible DDL with minimal sample data.

Usage:
    python export_clickhouse_schema.py --host <clickhouse_host> --port <port> --database <db> --output schema.sql

This script:
1. Connects to ClickHouse warehouse
2. Extracts table schemas using SHOW CREATE TABLE
3. Converts ClickHouse DDL to Postgres-compatible DDL
4. Generates minimal sample data (10-50 rows per table)
5. Outputs a .sql file that can be loaded into Postgres or Trino
"""

import argparse
import sys
from typing import Any, Dict, List

import clickhouse_connect

# ClickHouse to Postgres type mapping
TYPE_MAPPING = {
    "UInt8": "SMALLINT",
    "UInt16": "INTEGER",
    "UInt32": "BIGINT",
    "UInt64": "NUMERIC(20, 0)",
    "Int8": "SMALLINT",
    "Int16": "SMALLINT",
    "Int32": "INTEGER",
    "Int64": "BIGINT",
    "Float32": "REAL",
    "Float64": "DOUBLE PRECISION",
    "String": "TEXT",
    "FixedString": "VARCHAR",
    "Date": "DATE",
    "DateTime": "TIMESTAMP",
    "DateTime64": "TIMESTAMP",
    "Decimal": "DECIMAL",
    "UUID": "UUID",
    "Bool": "BOOLEAN",
    "Nullable": "",  # Handle separately
}


def convert_clickhouse_type_to_postgres(ch_type: str) -> str:
    """Convert ClickHouse type to Postgres type."""
    # Handle Nullable
    if ch_type.startswith("Nullable("):
        inner_type = ch_type[9:-1]
        return convert_clickhouse_type_to_postgres(inner_type)

    # Handle Array
    if ch_type.startswith("Array("):
        inner_type = ch_type[6:-1]
        pg_inner = convert_clickhouse_type_to_postgres(inner_type)
        return f"{pg_inner}[]"

    # Handle LowCardinality
    if ch_type.startswith("LowCardinality("):
        inner_type = ch_type[15:-1]
        return convert_clickhouse_type_to_postgres(inner_type)

    # Direct mapping
    for ch, pg in TYPE_MAPPING.items():
        if ch_type.startswith(ch):
            return pg

    # Default fallback
    return "TEXT"


def get_table_names(client, database: str) -> List[str]:
    """Get list of tables in database."""
    result = client.query(f"SHOW TABLES FROM {database}")
    return [row[0] for row in result.result_rows]


def get_table_schema(client, database: str, table: str) -> str:
    """Get CREATE TABLE statement from ClickHouse."""
    result = client.query(f"SHOW CREATE TABLE {database}.{table}")
    return result.result_rows[0][0] if result.result_rows else ""


def extract_columns_from_create_table(create_statement: str) -> List[Dict[str, str]]:
    """Parse CREATE TABLE to extract column definitions."""
    columns = []
    lines = create_statement.split("\n")

    in_columns = False
    for line in lines:
        line = line.strip()

        if line.startswith("CREATE TABLE"):
            in_columns = True
            continue

        if in_columns and line.startswith("`") and not line.startswith("ENGINE"):
            # Extract column name and type
            parts = line.strip("`").split("`")
            if len(parts) >= 2:
                col_name = parts[0]
                rest = parts[1].strip()

                # Extract type (first word after column name)
                type_parts = rest.split(",")[0].strip().split()
                if type_parts:
                    col_type = type_parts[0]
                    columns.append(
                        {
                            "name": col_name,
                            "type": col_type,
                        }
                    )

    return columns


def generate_postgres_ddl(table: str, columns: List[Dict[str, str]]) -> str:
    """Generate Postgres CREATE TABLE statement."""
    col_defs = []
    for col in columns:
        pg_type = convert_clickhouse_type_to_postgres(col["type"])
        col_defs.append(f'  "{col["name"]}" {pg_type}')

    return f"""CREATE TABLE IF NOT EXISTS {table} (
{",\\n".join(col_defs)}
);"""


def get_sample_data(client, database: str, table: str, limit: int = 50) -> List[tuple]:
    """Fetch sample rows from ClickHouse table."""
    try:
        result = client.query(f"SELECT * FROM {database}.{table} LIMIT {limit}")
        return result.result_rows
    except Exception as e:
        print(f"Warning: Could not fetch data from {table}: {e}", file=sys.stderr)
        return []


def generate_postgres_insert(
    table: str, columns: List[Dict[str, str]], rows: List[tuple]
) -> str:
    """Generate Postgres INSERT statements."""
    if not rows:
        return f"-- No sample data for {table}\n"

    col_names = [col["name"] for col in columns]
    inserts = []

    for row in rows:
        # Convert values to Postgres format
        values = []
        for val in row:
            if val is None:
                values.append("NULL")
            elif isinstance(val, str):
                # Escape single quotes
                escaped = val.replace("'", "''")
                values.append(f"'{escaped}'")
            elif isinstance(val, (int, float)):
                values.append(str(val))
            elif isinstance(val, bool):
                values.append("TRUE" if val else "FALSE")
            else:
                values.append(f"'{str(val)}'")

        values_str = ", ".join(values)
        col_names_quoted = ", ".join([f'"{col}"' for col in col_names])
        inserts.append(
            f"INSERT INTO {table} ({col_names_quoted}) VALUES ({values_str});"
        )

    return "\n".join(inserts) + "\n"


def main():
    parser = argparse.ArgumentParser(
        description="Export ClickHouse schema to Postgres SQL"
    )
    parser.add_argument("--host", required=True, help="ClickHouse host")
    parser.add_argument("--port", type=int, default=9000, help="ClickHouse port")
    parser.add_argument("--database", required=True, help="Database name")
    parser.add_argument("--user", default="default", help="Username")
    parser.add_argument("--password", default="", help="Password")
    parser.add_argument("--output", required=True, help="Output SQL file")
    parser.add_argument(
        "--sample-rows", type=int, default=50, help="Number of sample rows per table"
    )
    parser.add_argument(
        "--tables", nargs="*", help="Specific tables to export (default: all)"
    )

    args = parser.parse_args()

    # Connect to ClickHouse
    print(f"Connecting to ClickHouse at {args.host}:{args.port}...")
    client = clickhouse_connect.get_client(
        host=args.host,
        port=args.port,
        username=args.user,
        password=args.password,
        database=args.database,
    )

    # Get table list
    if args.tables:
        tables = args.tables
    else:
        tables = get_table_names(client, args.database)

    print(f"Found {len(tables)} tables: {', '.join(tables)}")

    # Generate SQL
    with open(args.output, "w") as f:
        f.write(f"-- Exported from ClickHouse database: {args.database}\n")
        f.write(f"-- Generated schema with sample data\n\n")

        for table in tables:
            print(f"Processing table: {table}")

            # Get CREATE TABLE
            create_stmt = get_table_schema(client, args.database, table)
            columns = extract_columns_from_create_table(create_stmt)

            if not columns:
                print(f"  Warning: Could not extract columns for {table}, skipping")
                continue

            # Write Postgres DDL
            f.write(f"\n-- Table: {table}\n")
            ddl = generate_postgres_ddl(table, columns)
            f.write(ddl + "\n\n")

            # Get sample data
            rows = get_sample_data(client, args.database, table, args.sample_rows)
            print(f"  Fetched {len(rows)} sample rows")

            # Write INSERT statements
            if rows:
                f.write(f"-- Sample data for {table}\n")
                inserts = generate_postgres_insert(table, columns, rows)
                f.write(inserts + "\n")

    print(f"\nExport complete! Output written to: {args.output}")


if __name__ == "__main__":
    main()
