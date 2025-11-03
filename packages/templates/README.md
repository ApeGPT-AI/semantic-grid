# Templates Directory

This directory contains reusable template components that can be referenced across different client configurations and system packs.

## Purpose

Templates provide:
- **Reusability**: Share common configurations across multiple clients without duplication
- **Maintainability**: Update a template once, and all references benefit
- **Separation of Concerns**: Keep reusable building blocks separate from client-specific and versioned content

## Structure

```
templates/
├── fm_app/              # Templates for Flow Manager
│   └── (future templates)
└── dbmeta_app/          # Templates for DB-Meta
    └── sql_dialects/    # SQL dialect-specific instructions
        ├── clickhouse.yaml
        ├── trino.yaml
        └── (other dialects)
```

## How Templates Work

### Integration with Prompt Assembly

Templates are automatically added to the Jinja2 include search path by `PromptAssembler`. This means:

1. Templates are available for `{% include %}` statements in any prompt or overlay
2. Template search happens after system pack and overlays (lower priority)
3. Templates are tracked in the lineage for reproducibility

### Using Templates in Client Overlays

**Option 1: Jinja Include in Markdown**
```markdown
{% include "sql_dialects/clickhouse.yaml" %}
```

**Option 2: Reference in YAML (via merge)**
```yaml
# In client overlay
profiles:
  wh_v2: {% include "sql_dialects/trino.yaml" %}
```

**Option 3: Copy and Customize**
Copy template content into your overlay and modify as needed for client-specific requirements.

## Available Templates

### dbmeta_app/sql_dialects/

SQL dialect-specific instructions for LLM-driven query generation:

- **clickhouse.yaml**: Instructions for ClickHouse SQL dialect
  - Unsupported features: FULL OUTER JOIN, RIGHT JOIN, LAG(), LEAD()
  - Array handling with arrayMap(), arrayJoin(), groupArray()
  - Correlated subquery limitations
  
- **trino.yaml**: Instructions for Trino SQL dialect
  - Full support for standard SQL features
  - Array handling with transform(), unnest(), array_agg()
  - Window functions and CTEs

## Adding New Templates

1. Create the template file in the appropriate component directory
2. Use clear, descriptive names (e.g., `postgres.yaml`, `bigquery.yaml`)
3. Document the template's purpose in this README
4. Templates should be generic and reusable across clients

## Best Practices

- **Versioning**: Templates are unversioned (unlike system packs). Breaking changes should be rare.
- **Naming**: Use descriptive names that indicate purpose (e.g., `sql_dialects/postgres.yaml`)
- **Documentation**: Include comments in templates explaining their purpose
- **Scope**: Keep templates focused on a single concern (SQL dialect, policy pattern, etc.)
- **Client Specifics**: If customization is needed, copy to client overlay rather than modifying template

## Relationship to Other Directories

- **`resources/`**: Versioned system packs (core behavior, tied to version)
- **`client-configs/`**: Client-specific customizations and overrides
- **`templates/`**: Reusable building blocks (shared, unversioned)
