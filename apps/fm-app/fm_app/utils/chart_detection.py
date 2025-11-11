"""
Chart type detection utilities for query results.

Provides empirical validation of chart types based on query result structure
and configuration hints for frontend chart rendering.
"""

from typing import Any, Optional

from fm_app.api.model import ChartMetadata, Column


def detect_available_charts(
    columns: list[Column],
    row_count: int,
    suggested_chart: Optional[str] = None,
) -> list[str]:
    """
    Determine which chart types are supported by the result structure.

    Args:
        columns: List of Column metadata from query results
        row_count: Number of rows in the result
        suggested_chart: Optional LLM suggestion to validate

    Returns:
        List of supported chart types: ["table", "bar", "line", "pie"]

    Rules:
    - table: Always available (default fallback)
    - bar: Requires 1-2 categorical columns + 1+ numeric columns
    - line: Requires 1 datetime/date column + 1+ numeric columns, multiple rows
    - pie: Requires exactly 2 columns (1 categorical + 1 numeric), 2-15 rows
    - none: For queries returning no meaningful visualization (single value, etc.)
    """
    if not columns or row_count == 0:
        return ["table"]

    available = ["table"]  # Always an option

    # Categorize columns by type
    # Note: Use substring check for ClickHouse types like 'DateTime64(6, 'UTC')'
    datetime_cols = [
        c
        for c in columns
        if c.column_type
        and any(dt in c.column_type.lower() for dt in ["datetime", "timestamp", "date"])
    ]

    numeric_cols = [
        c
        for c in columns
        if c.column_type
        and c.column_type.lower()
        in [
            "int",
            "int8",
            "int16",
            "int32",
            "int64",
            "uint8",
            "uint16",
            "uint32",
            "uint64",
            "float",
            "float32",
            "float64",
            "double",
            "real",
            "decimal",
            "numeric",
            "number",
            "bigint",
            "integer",
            "smallint",
        ]
    ]

    # Use substring check for ClickHouse types like 'LowCardinality(String)'
    categorical_cols = [
        c
        for c in columns
        if c.column_type
        and any(
            ct in c.column_type.lower()
            for ct in ["string", "varchar", "text", "char", "enum"]
        )
    ]

    # Bar chart: categorical + numeric, at least 1 row
    if categorical_cols and numeric_cols and row_count > 0:
        available.append("bar")

    # Line chart: datetime + numeric, at least 2 rows for a trend
    if datetime_cols and numeric_cols and row_count > 1:
        available.append("line")

    # Pie chart: exactly 2 columns, small dataset, categorical + numeric
    # Pie charts work best with 2-15 slices
    if len(columns) == 2 and categorical_cols and numeric_cols and 2 <= row_count <= 15:
        available.append("pie")

    # Special case: single row, single numeric value → no chart
    if row_count == 1 and len(columns) == 1 and numeric_cols:
        return ["table", "none"]

    return available


def infer_chart_config(
    columns: list[Column],
    chart_type: str,
    suggested_chart: Optional[str] = None,
) -> dict[str, Any]:
    """
    Generate configuration hints for chart rendering.

    Args:
        columns: List of Column metadata
        chart_type: Chart type to generate config for
        suggested_chart: Optional LLM suggestion for context

    Returns:
        Dictionary with chart-specific configuration hints:
        - x_axis, y_axis: Column names for axes
        - title: Suggested chart title
        - label_column, value_column: For pie charts
        - series: For multi-series charts
    """
    config: dict[str, Any] = {}

    if not columns:
        return config

    # Categorize columns
    datetime_cols = [
        c
        for c in columns
        if c.column_type
        and c.column_type.lower()
        in ["datetime", "timestamp", "date", "datetime64", "timestamptz"]
    ]

    numeric_cols = [
        c
        for c in columns
        if c.column_type
        and c.column_type.lower()
        in [
            "int",
            "int8",
            "int16",
            "int32",
            "int64",
            "uint8",
            "uint16",
            "uint32",
            "uint64",
            "float",
            "float32",
            "float64",
            "double",
            "real",
            "decimal",
            "numeric",
            "number",
            "bigint",
            "integer",
            "smallint",
        ]
    ]

    categorical_cols = [
        c
        for c in columns
        if c.column_type
        and c.column_type.lower()
        in [
            "string",
            "str",
            "varchar",
            "text",
            "char",
            "lowcardinality(string)",
            "enum",
        ]
    ]

    if chart_type == "line":
        # Line chart: datetime on x-axis, numeric on y-axis
        if datetime_cols and numeric_cols:
            x_col = datetime_cols[0]
            y_col = numeric_cols[0]

            config = {
                "x_axis": x_col.column_name,
                "y_axis": y_col.column_name,
                "title": f"{y_col.column_name} over time",
            }

            # If multiple numeric columns, suggest series
            if len(numeric_cols) > 1:
                config["series"] = [c.column_name for c in numeric_cols]

    elif chart_type == "bar":
        # Bar chart: categorical on x-axis, numeric on y-axis
        if categorical_cols and numeric_cols:
            x_col = categorical_cols[0]
            y_col = numeric_cols[0]

            config = {
                "x_axis": x_col.column_name,
                "y_axis": y_col.column_name,
                "title": f"{y_col.column_name} by {x_col.column_name}",
            }

            # If multiple numeric columns, suggest grouped/stacked bars
            if len(numeric_cols) > 1:
                config["series"] = [c.column_name for c in numeric_cols]

    elif chart_type == "pie":
        # Pie chart: first column is label, second is value
        if len(columns) >= 2:
            label_col = categorical_cols[0] if categorical_cols else columns[0]
            value_col = numeric_cols[0] if numeric_cols else columns[1]

            config = {
                "label_column": label_col.column_name,
                "value_column": value_col.column_name,
                "title": f"Distribution of {value_col.column_name}",
            }

    return config


def build_chart_metadata(
    columns: list[Column],
    row_count: int,
    suggested_chart: Optional[str] = None,
) -> ChartMetadata:
    """
    Build complete chart metadata with suggestions and validation.

    Args:
        columns: List of Column metadata from query results
        row_count: Number of rows in result
        suggested_chart: Optional LLM-suggested chart type

    Returns:
        ChartMetadata with suggested chart, available options, and config hints
    """
    # Detect what's actually possible
    available_charts = detect_available_charts(columns, row_count, suggested_chart)

    # Validate LLM suggestion or pick sensible default
    if suggested_chart and suggested_chart in available_charts:
        final_suggestion = suggested_chart
    else:
        # Default priority: line > bar > pie > table
        if "line" in available_charts:
            final_suggestion = "line"
        elif "bar" in available_charts:
            final_suggestion = "bar"
        elif "pie" in available_charts:
            final_suggestion = "pie"
        else:
            final_suggestion = "table"

    # Generate config hints for the suggested chart
    chart_config = infer_chart_config(columns, final_suggestion, suggested_chart)

    return ChartMetadata(
        suggested_chart=final_suggestion,
        available_charts=available_charts,
        chart_config=chart_config,
    )
