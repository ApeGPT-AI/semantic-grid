# SQL Repair Guidance Enhancement

**Status:** Planned  
**Date:** 2025-11-07  
**Component:** db-meta, interactive_flow

## Problem Statement

Currently, when SQL generation fails, the repair loop provides limited guidance to the LLM:
- Raw ClickHouse error message
- Generic "please fix" instruction
- No reinforcement of violated constraints
- No examples of successful similar queries

This leads to:
- LLM repeating the same errors across attempts
- Low success rate even with multiple retries (currently 3 attempts, ~70% failure on complex queries)
- Ignoring system prompt constraints that are relevant to the specific error

### Example Failure Pattern

**Request:** "add previous day balance column"

**Attempt 1:** Used `LAG()` function  
→ Error: "LAG does not exist in ClickHouse"

**Attempt 2-3:** Used `row_number()` with incorrect scoping  
→ Error: "Identifier 't2.rn' cannot be resolved from subquery"  
→ Same error repeated

**Result:** Failed after 3 attempts despite system prompt containing relevant guidance.

## Proposed Solution

Enhance `db_meta` to provide structured repair guidance that:
1. Identifies which constraint was violated
2. Suggests alternative approaches
3. Provides concrete examples of successful similar queries

### Architecture Overview

```
fm_app (interactive_query.py)
    ↓
    1. Generate SQL with LLM
    ↓
    2. Call db_meta.explain_analyze(sql)
    ↓
db_meta
    ├─ Run EXPLAIN
    ├─ If error:
    │   ├─ Match error pattern (deterministic)
    │   ├─ Search Milvus for similar fixes (RAG)
    │   └─ Return repair_guidance
    └─ Return response
    ↓
fm_app
    ├─ If valid: Execute query ✓
    ├─ If invalid:
    │   ├─ Extract repair_guidance
    │   ├─ Add to LLM repair prompt:
    │   │   - Violated constraint
    │   │   - Alternative approach
    │   │   - Similar successful queries
    │   ├─ Retry SQL generation
    │   └─ Loop (up to N attempts)
    └─ If successful after repair:
        └─ Call db_meta.log_successful_query()
            (feed learning loop)
```

## Implementation Details

### 1. Enhanced API Response

**Current `explain_analyze` response:**
```python
{
    "valid": True/False,
    "explain": {...},
    "error": "error message if invalid"
}
```

**Proposed response:**
```python
{
    "valid": False,
    "error": "Code: 63. LAG function does not exist",
    "repair_guidance": {
        "violated_constraint": "Do not use LAG() or LEAD() functions. ClickHouse does not support them.",
        "alternative_approach": "Use groupArray() with arrayJoin() and indexing",
        "category": "unsupported_function",
        "similar_fixes": [
            {
                "query_id": "uuid-123",
                "sql": "WITH ordered_data AS (...) SELECT ...",
                "description": "Compare adjacent rows using groupArray",
                "similarity_score": 0.92
            }
        ]
    }
}
```

### 2. New Data Models

```python
class RepairGuidance(BaseModel):
    violated_constraint: Optional[str]
    alternative_approach: Optional[str]
    category: str  # "unsupported_function", "scope_error", "type_mismatch", etc.
    similar_fixes: List[SimilarFix] = []
    
class SimilarFix(BaseModel):
    query_id: UUID
    sql: str
    description: str
    similarity_score: float

class ExplainAnalyzeResponse(BaseModel):
    valid: bool
    explain: Optional[dict]
    error: Optional[str]
    repair_guidance: Optional[RepairGuidance]  # NEW
```

### 3. Error Pattern Registry

```python
# db_meta/error_patterns.py

ERROR_GUIDANCE = {
    "LAG.*does not exist": {
        "constraint": "Do not use LAG() or LEAD() functions. ClickHouse does not support them.",
        "alternative": "Use groupArray() with arrayJoin() and indexing if you need to compare adjacent rows.",
        "category": "unsupported_function"
    },
    "Identifier.*cannot be resolved.*subquery": {
        "constraint": "ClickHouse doesn't support referencing outer query columns in scalar subqueries",
        "alternative": "Use JOIN or pre-aggregated CTE instead",
        "category": "scope_error"
    },
    "FULL OUTER JOIN": {
        "constraint": "FULL OUTER JOIN is not supported in ClickHouse",
        "alternative": "Use LEFT JOIN UNION ALL RIGHT JOIN with appropriate filters",
        "category": "unsupported_join"
    },
    "window function.*GROUP BY": {
        "constraint": "Window functions cannot be used directly in GROUP BY",
        "alternative": "Use window functions in a CTE, then GROUP BY the results",
        "category": "window_function_misuse"
    },
    # Add 10-20 common patterns
}
```

### 4. Error Analyzer Component

```python
# db_meta/error_analyzer.py

class ErrorAnalyzer:
    def __init__(self, milvus_client, error_patterns):
        self.milvus = milvus_client
        self.patterns = error_patterns
    
    def analyze_error(self, error_msg: str, failed_sql: str) -> RepairGuidance:
        """
        Analyze SQL error and provide repair guidance.
        
        Phase 1: Pattern matching (fast, deterministic)
        Phase 2: RAG search for similar fixes (smart, learning)
        """
        # Step 1: Pattern matching
        guidance = self._match_pattern(error_msg)
        
        # Step 2: RAG search for similar fixes
        if self.milvus:
            similar = self._search_similar_fixes(error_msg, failed_sql)
            guidance.similar_fixes = similar
        
        return guidance
    
    def _match_pattern(self, error_msg: str) -> RepairGuidance:
        """Check against known error patterns"""
        for pattern, guidance in self.patterns.items():
            if re.search(pattern, error_msg, re.IGNORECASE):
                return RepairGuidance(
                    violated_constraint=guidance["constraint"],
                    alternative_approach=guidance["alternative"],
                    category=guidance["category"]
                )
        return RepairGuidance(category="unknown")
    
    def _search_similar_fixes(self, error_msg: str, failed_sql: str) -> List[SimilarFix]:
        """Query Milvus for similar past errors that were fixed"""
        embedding = self.embed_text(error_msg)
        results = self.milvus.search(
            collection="error_fixes",
            data=[embedding],
            limit=3,
            output_fields=["query_id", "sql", "description"]
        )
        return [
            SimilarFix(
                query_id=r["query_id"],
                sql=r["successful_sql"],
                description=r["fix_description"],
                similarity_score=r["distance"]
            )
            for r in results
        ]
```

### 5. Query Corpus Management

```python
# db_meta/query_corpus.py

class QueryCorpus:
    """Manages successful query examples and error→fix pairs"""
    
    async def store_query(self, query_id: UUID, sql: str, description: str, category: Optional[str] = None):
        """Store successful query with embedding for future retrieval"""
        embedding = await self.embed_text(sql + " " + description)
        await self.db.execute(
            """
            INSERT INTO successful_queries 
            (query_id, sql, description, category, embedding, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            """,
            query_id, sql, description, category, embedding
        )
    
    async def store_fix(self, error_msg: str, failed_sql: str, successful_sql: str, fix_description: str):
        """Store an error→fix pair for learning"""
        error_signature = hashlib.sha256(error_msg.encode()).hexdigest()[:16]
        embedding = await self.embed_text(error_msg)
        
        await self.db.execute(
            """
            INSERT INTO error_fix_history
            (error_signature, error_msg, failed_sql, successful_sql, fix_description, embedding, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            """,
            error_signature, error_msg, failed_sql, successful_sql, fix_description, embedding
        )
```

### 6. New Database Tables

```sql
-- Successful query examples
CREATE TABLE successful_queries (
    query_id UUID PRIMARY KEY,
    sql TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50),  -- 'window_functions', 'aggregations', 'joins', etc.
    embedding VECTOR(1536),  -- For similarity search
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_queries_category ON successful_queries(category);

-- Error fix history (for learning)
CREATE TABLE error_fix_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_signature VARCHAR(16) NOT NULL,  -- Hash of error type
    error_msg TEXT NOT NULL,
    failed_sql TEXT NOT NULL,
    successful_sql TEXT NOT NULL,
    fix_description TEXT,
    embedding VECTOR(1536),  -- Embedding of error message
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_error_signature ON error_fix_history(error_signature);
```

### 7. Modified `explain_analyze` Tool

```python
# db_meta/tools.py

async def explain_analyze(
    sql: str,
    profile: str = "default",
    **kwargs
) -> dict:
    """
    Validate SQL by running EXPLAIN.
    Returns structured error guidance if validation fails.
    """
    try:
        # Run EXPLAIN
        result = await run_explain_query(sql, profile)
        return {
            "valid": True,
            "explain": result
        }
    
    except Exception as e:
        # ENHANCED: Analyze the error and provide repair guidance
        error_analyzer = ErrorAnalyzer(
            milvus_client=get_milvus_client(),
            error_patterns=ERROR_GUIDANCE
        )
        
        repair_guidance = error_analyzer.analyze_error(
            error_msg=str(e),
            failed_sql=sql
        )
        
        return {
            "valid": False,
            "error": str(e),
            "repair_guidance": repair_guidance.model_dump()
        }
```

### 8. New MCP Tool: `log_successful_query`

```python
@tool
async def log_successful_query(
    query_id: str,
    sql: str,
    description: str,
    category: Optional[str] = None,
    previous_error: Optional[str] = None,
    previous_sql: Optional[str] = None
) -> dict:
    """
    Store a successful query in the corpus for future reference.
    
    Args:
        query_id: UUID of the query
        sql: The successful SQL
        description: Human-readable description
        category: Optional category (e.g., 'window_functions')
        previous_error: If this fixed an error, the error message
        previous_sql: If this fixed an error, the failed SQL
    
    Returns:
        {"stored": True}
    """
    corpus = QueryCorpus()
    
    # Store as successful query
    await corpus.store_query(
        query_id=UUID(query_id),
        sql=sql,
        description=description,
        category=category
    )
    
    # If this was a fix, also store in error_fix_history
    if previous_error and previous_sql:
        await corpus.store_fix(
            error_msg=previous_error,
            failed_sql=previous_sql,
            successful_sql=sql,
            fix_description=description
        )
    
    return {"stored": True}
```

### 9. Integration with fm_app Repair Loop

```python
# fm_app/workers/interactive_flow/interactive_query.py

# Current repair loop (simplified)
attempt = 1
while attempt <= 3:
    llm_response = ai_model.get_structured(messages, QueryMetadata)
    
    # Validate SQL
    validation = await db_meta_mcp_analyze_query(llm_response.sql)
    
    if validation["valid"]:
        break  # Success!
    
    # ENHANCED: Use repair guidance in retry prompt
    repair_guidance = validation.get("repair_guidance", {})
    
    retry_message = f"""
The SQL failed validation with error:
{validation['error']}

VIOLATED CONSTRAINT:
{repair_guidance.get('violated_constraint', 'N/A')}

ALTERNATIVE APPROACH:
{repair_guidance.get('alternative_approach', 'N/A')}
"""
    
    # Add similar successful queries as examples
    if repair_guidance.get('similar_fixes'):
        retry_message += "\n\nSIMILAR SUCCESSFUL QUERIES:\n"
        for fix in repair_guidance['similar_fixes']:
            retry_message += f"\n{fix['description']}:\n```sql\n{fix['sql']}\n```\n"
    
    retry_message += "\nPlease rewrite the SQL following these constraints."
    
    messages.append({"role": "assistant", "content": llm_response.model_dump_json()})
    messages.append({"role": "user", "content": retry_message})
    
    attempt += 1

# If successful after repair, log it for learning
if validation["valid"] and attempt > 1:
    await log_successful_query(
        query_id=str(query_id),
        sql=llm_response.sql,
        description=llm_response.description,
        previous_error=validation_history[-2]["error"],  # The error that was fixed
        previous_sql=validation_history[-2]["sql"]
    )
```

## Migration Path

### Phase 1: Pattern Matching (Quick Win)
**Timeline:** 1-2 weeks  
**Effort:** Low

- [ ] Create `error_patterns.py` with 10-20 common ClickHouse errors
- [ ] Add `ErrorAnalyzer` class with pattern matching
- [ ] Modify `explain_analyze` to return `repair_guidance`
- [ ] Update fm_app repair loop to use guidance in retry prompts
- [ ] Test with historical failed queries

**Expected Impact:** 20-30% improvement in repair success rate

### Phase 2: Query Corpus (Foundation)
**Timeline:** 2-3 weeks  
**Effort:** Medium

- [ ] Create database tables (`successful_queries`, `error_fix_history`)
- [ ] Implement `QueryCorpus` class
- [ ] Add `log_successful_query` MCP tool
- [ ] Integrate into fm_app to log successful queries after repair
- [ ] Backfill with existing successful queries from production

**Expected Impact:** Build foundation for Phase 3

### Phase 3: RAG Integration (Self-Improving)
**Timeline:** 2-3 weeks  
**Effort:** Medium-High

- [ ] Set up Milvus collection for error embeddings
- [ ] Implement semantic search in `ErrorAnalyzer`
- [ ] Add `similar_fixes` to repair guidance
- [ ] Monitor and tune similarity thresholds
- [ ] Add feedback loop to improve embeddings

**Expected Impact:** 40-50% improvement in repair success rate, self-improving over time

## Success Metrics

### Before Enhancement
- SQL repair success rate: ~30% (1 in 3 attempts)
- Average attempts to success: 2.5
- User-facing errors: ~25% of complex queries

### After Phase 1 (Pattern Matching)
- Target repair success rate: 50%
- Target average attempts: 2.0
- Target user-facing errors: 15%

### After Phase 3 (Full RAG)
- Target repair success rate: 70%
- Target average attempts: 1.5
- Target user-facing errors: <10%

## Risks & Mitigations

### Risk 1: Pattern matching too brittle
**Mitigation:** Start with broad patterns, refine based on production data

### Risk 2: RAG returns irrelevant examples
**Mitigation:** Implement similarity threshold, fallback to pattern matching

### Risk 3: Milvus latency impacts repair loop
**Mitigation:** Cache frequent errors, implement timeout fallback

### Risk 4: Query corpus grows too large
**Mitigation:** Implement TTL, deduplicate similar queries, limit to top-k per category

## Future Enhancements

### LLM-Assisted Pattern Discovery
- Analyze failed queries to discover new error patterns
- Auto-generate pattern definitions from clusters of similar errors

### Multi-Step Repair Strategies
- Break complex queries into validated sub-steps
- Progressive enhancement (start simple, add complexity incrementally)

### User Feedback Loop
- Track which repairs user accepts vs. rejects
- Use as signal to improve repair quality

### Cross-Database Learning
- Apply patterns learned from ClickHouse to other databases
- Generalize repair strategies across SQL dialects

## References

- Current code: `apps/fm-app/fm_app/workers/interactive_flow/interactive_query.py`
- db-meta validation: `apps/db-meta/db_meta/tools.py`
- Error patterns: TBD (`apps/db-meta/db_meta/error_patterns.py`)
- Milvus integration: `apps/db-meta/db_meta/milvus_client.py`

## Related Discussions

- Context: Chat session 2025-11-07 discussing query repair failures
- Specific failure: "add previous day balance column" request failing with LAG/row_number errors
