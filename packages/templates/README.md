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
    └── resources/       # SQL dialect-specific instructions
        ├── sql_dialect.yaml              # Default (ClickHouse)
        ├── sql_dialect.clickhouse.yaml   # ClickHouse reference
        └── sql_dialect.trino.yaml        # Trino alternative
```

## How Templates Work

### Integration with Prompt Assembly

Templates are automatically added to the Jinja2 include search path by `PromptAssembler`. This means:

1. Templates are available for `{% include %}` statements in any prompt or overlay
2. Template search happens after system pack and overlays (lower priority)
3. Templates are tracked in the lineage for reproducibility

### Using Templates in Client Overlays

**Option 1: Use Default (No Action Needed)**
The default template `resources/sql_dialect.yaml` is automatically merged via the overlay system.
Simply don't create a client overlay file, and the template is used.

**Option 2: Copy and Customize**
Copy template content into your overlay and modify as needed for client-specific requirements.
```bash
# Example: Switch to Trino
cp packages/templates/dbmeta_app/resources/sql_dialect.trino.yaml \
   packages/client-configs/myclient/prod/dbmeta_app/overlays/resources/sql_dialect.yaml
```

**Option 3: Jinja Include (for Markdown prompts)**
For markdown-based prompts, you can include templates:
```markdown
{% include "resources/sql_dialect.clickhouse.yaml" %}
```

## Available Templates

### dbmeta_app/resources/

SQL dialect-specific instructions for LLM-driven query generation:

- **sql_dialect.yaml**: Default SQL dialect (ClickHouse)
  - Used automatically by all clients unless overridden
  - Unsupported features: FULL OUTER JOIN, RIGHT JOIN, LAG(), LEAD()
  - Array handling with arrayMap(), arrayJoin(), groupArray()
  - Correlated subquery limitations
  
- **sql_dialect.clickhouse.yaml**: ClickHouse SQL dialect (reference)
  - Same as default sql_dialect.yaml
  - Keep for documentation and version control
  
- **sql_dialect.trino.yaml**: Trino SQL dialect (alternative)
  - Full support for standard SQL features
  - Array handling with transform(), unnest(), array_agg()
  - Window functions and CTEs
  - To use: Copy content to client overlay as `sql_dialect.yaml`

## Adding New Templates

1. Create the template file in the appropriate component directory
2. Use clear, descriptive names (e.g., `postgres.yaml`, `bigquery.yaml`)
3. Document the template's purpose in this README
4. Templates should be generic and reusable across clients

## Usage Examples

### Example 1: Using the Default Template (ClickHouse)

If your client uses ClickHouse (most common), you don't need any overlay:
- The template at `templates/dbmeta_app/resources/sql_dialect.yaml` provides ClickHouse by default
- Simply delete or don't create a client overlay for `sql_dialect.yaml`
- The template is automatically merged via the overlay system

### Example 2: Switching to Trino

To use Trino instead of ClickHouse:

```bash
# Copy the Trino template to your client overlay
cp packages/templates/dbmeta_app/resources/sql_dialect.trino.yaml \
   packages/client-configs/myclient/prod/dbmeta_app/overlays/resources/sql_dialect.yaml
```

Or manually copy the content and customize as needed.

### Example 3: Adding Client-Specific Rules

To extend the default ClickHouse template with client-specific rules:

```yaml
# In client-configs/myclient/prod/dbmeta_app/overlays/resources/sql_dialect.yaml
version: 1.0.0
description: SQL dialect with client-specific additions
strategy: override
profiles:
  wh_v2:
    # Copy all instructions from template, then add:
    - |
      Client-specific rule: Do not query tables older than 90 days
      without explicit date filters.
```

## Best Practices

- **Versioning**: Templates are unversioned (unlike system packs). Breaking changes should be rare.
- **Naming**: Use descriptive names that indicate purpose (e.g., `sql_dialect.trino.yaml`)
- **Documentation**: Include comments in templates explaining their purpose
- **Scope**: Keep templates focused on a single concern (SQL dialect, policy pattern, etc.)
- **Client Specifics**: If customization is needed, copy to client overlay rather than modifying template
- **Default Behavior**: If most clients use the same config, make it the default template

## Relationship to Other Directories

- **`resources/`**: Versioned system packs (core behavior, tied to version)
- **`client-configs/`**: Client-specific customizations and overrides
- **`templates/`**: Reusable building blocks (shared, unversioned)
