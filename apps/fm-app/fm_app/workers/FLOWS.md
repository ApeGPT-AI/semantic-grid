# Flow Manager Flows

This document provides an overview of all supported flows in the Flow Manager (fm-app). Each flow represents a different strategy for processing user requests, generating SQL, and returning results.

## Directory Structure

The flows are organized into three categories:

- **`interactive_flow/`** - Production-ready interactive query flow (default)
- **`legacy/`** - Simple, production-ready flows for basic use cases
- **`experimental/`** - Research and advanced flow implementations

```
fm_app/workers/
├── interactive_flow/       # Interactive query with validation loops
│   ├── interactive_query.py
│   ├── intent_analyzer.py
│   ├── data_analysis.py
│   └── ...
├── legacy/                 # Legacy production flows
│   ├── simple_flow.py
│   ├── data_only_flow.py
│   └── multistep_flow.py
└── experimental/           # Experimental flows
    ├── flex_flow.py
    ├── mcp_flow.py
    ├── mcp_flow_new.py
    ├── langgraph_flow.py
    └── agent.py           # Shared by MCP flows
```

## Table of Contents

- [Production Flows](#production-flows)
  - [Interactive Query Flow](#interactive-query-flow)
  - [Multistep Flow](#multistep-flow)
  - [Simple Flow](#simple-flow)
  - [Data Only Flow](#data-only-flow)
  - [Flex Flow](#flex-flow)
- [Experimental Flows](#experimental-flows)
  - [MCP Flow](#mcp-flow)
  - [MCP Flow New](#mcp-flow-new)
  - [LangGraph Flow](#langgraph-flow)
- [Flow Comparison](#flow-comparison)
- [Choosing the Right Flow](#choosing-the-right-flow)

---

## Production Flows

### Interactive Query Flow

**File**: `interactive_flow/interactive_query.py` (production)

**Purpose**: Structured SQL generation with validation and repair loop for interactive data exploration.

**Key Features**:
- Structured output with QueryMetadata (summary, description, SQL, columns, result)
- Validation loop (up to 3 attempts) for both metadata and SQL errors
- Query lineage tracking via parent_id relationships
- Session continuity with conversation history
- Rich metadata storage (columns, explanations, row counts)
- Validates that metadata columns exactly match SQL result columns

**Process**:
1. Assembles prompt using "interactive_query" slot with MCP context
2. Includes session history for conversational continuity
3. Generates structured QueryMetadata response
4. Validates metadata consistency and SQL via db-meta MCP server
5. On errors: adds feedback to conversation and retries
6. Stores validated query with metadata and lineage
7. Returns structured response with intent, description, SQL, and metadata

**Best For**:
- Interactive data exploration with iterative refinement
- Building on previous queries in a session
- Scenarios requiring query metadata and lineage
- Production use cases needing robust validation

---

### Multistep Flow

**File**: `legacy/multistep_flow.py`

**Purpose**: Iterative investigation with conversational refinement and visualization capabilities.

**Key Features**:
- Multi-step iterative reasoning (up to max_steps)
- Built-in chart generation (plotly code execution + auto-generated Bar/Pie charts)
- Assumption tracking and surfacing to users
- Full conversation history (including responses)
- Three possible outcomes per step: SQL execution, clarification request, or final response
- Error recovery with contextual feedback

**Process**:
1. Intent analysis with session history context (multistep_intent slot)
2. Investigation loop with InvestigationStep structured output
3. SQL generation and validation with retry on errors
4. Detects chart requests (keywords: chart, graph, diagram, pie)
5. Routes to appropriate response slot (chart/response/response_plain)
6. Generates charts via plotly code or auto-generated HTML
7. Assembles response with intro, outro, assumptions, SQL, CSV

**Configuration**:
- `max_steps`: Iteration limit
- Chart detection: Keyword-based
- Chart types: Bar (default), Pie (keyword-triggered)

**Best For**:
- Complex exploratory data analysis requiring multiple steps
- Investigations where the path isn't clear from initial request
- Scenarios requiring data visualization
- Cases where surfacing LLM assumptions adds value
- Investigations that may need user clarification mid-flow

---

### Simple Flow

**File**: `legacy/simple_flow.py`

**Purpose**: Basic SQL generation with natural language response for straightforward queries.

**Key Features**:
- Single-pass SQL generation (no retry loop)
- Query analysis via db-meta MCP server
- Natural language response formatting
- CSV cleanup for better user experience
- Syntax validation with sqlglot
- No query storage or lineage tracking

**Process**:
1. Builds prompt using "legacy_simple_request" slot with MCP context
2. LLM generates SQL query (single attempt)
3. Analyzes query via db-meta MCP server for cost/complexity
4. Validates SQL syntax using sqlglot
5. Executes SQL against warehouse
6. Asks LLM to format results naturally (legacy_simple_response slot)
7. Removes embedded CSV from natural language response

**Best For**:
- Simple data queries needing conversational responses
- One-off questions that don't require follow-up
- Quick exploratory queries in conversational context
- When natural language formatting adds value over raw CSV

---

### Data Only Flow

**File**: `legacy/data_only_flow.py`

**Purpose**: Simplified SQL generation and execution for raw data extraction without conversational responses.

**Key Features**:
- Streamlined single-attempt SQL generation
- No retry/repair loop
- No query metadata, explanations, or column definitions
- No natural language response generation
- No query storage or lineage tracking
- Minimal error handling (fails fast)

**Process**:
1. Builds prompt using "legacy_data_only" slot with MCP context
2. LLM generates SQL query (single attempt)
3. Extracts SQL from response
4. Validates SQL syntax using sqlglot (logs errors but continues)
5. Runs SQL against warehouse database
6. Returns raw CSV data in structured response

**Best For**:
- API-driven data extraction where clients handle their own error handling
- Simple, well-defined queries that don't need iterative refinement
- Batch data exports where speed is more important than validation
- Programmatic integrations that work directly with CSV output

---

### Flex Flow

**File**: `experimental/flex_flow.py`

**Purpose**: Adaptive SQL query generation and execution pipeline that adjusts strategy based on query complexity.

**Key Features**:
- Adaptive execution strategy based on query complexity thresholds
- Multi-stage pipeline decomposition for expensive queries
- DuckDB integration for intermediate processing
- Query cost analysis via db-meta MCP server (explain_analyze)
- Natural language response generation

**Process**:
1. Converts user request to SQL using LLM (legacy_flex_flow slot)
2. Analyzes query complexity/cost via db-meta MCP server
3. **For expensive queries** (high rows/marks/parts):
   - LLM generates JSON pipeline with intermediate DuckDB processing steps
   - Executes stages: warehouse → DuckDB → warehouse → DuckDB → final
   - Uses DuckDB for aggregations/transformations to reduce warehouse load
4. **For simple queries**: Executes directly against warehouse
5. Formats results as CSV and asks LLM for natural language response
6. Returns both structured data (SQL, CSV) and conversational response

**Thresholds**:
- `MAX_ROWS_SAFE`: 50,000,000 rows
- `MAX_MARKS_SAFE`: 100,000 marks
- `MAX_PARTS_SAFE`: 3 parts

**Best For**:
- Queries with unpredictable complexity
- Scenarios where cost optimization is critical
- Complex analytical queries requiring intermediate processing
- When warehouse load reduction is important

---

## Experimental Flows

### MCP Flow

**File**: `experimental/mcp_flow.py`

**Purpose**: Agent-based SQL generation using Anthropic Agents framework with dual MCP server integration.

**Key Features**:
- Anthropic Agents framework (vs raw LLM API calls)
- Dual MCP server architecture (SSE + FastMCP)
- Structured output with type validation
- Parallel tool calling for performance
- Direct MCP tool execution for queries

**Process**:
1. Builds instructions from expertise prefix, DB-ref prompts, MCP instructions, and ClickHouse guidance
2. Sets up dual MCP servers:
   - DB Meta MCP Server (SSE): Schema metadata and validation tools
   - Solana DB MCP Server (FastMCP): Query execution via fetch_data tool
3. Creates Anthropic Agent with structured output (StructuredResponse)
4. Agent generates SQL using MCP tools for schema context
5. Executes SQL via solana_db.py MCP server
6. Returns CSV results

**Configuration**:
- Agent: "ApeGPT Solana Agent"
- Temperature: 0
- Parallel tool calls: Enabled

**Best For**:
- Demonstrating MCP server integration patterns
- Agent-based query workflows
- Scenarios requiring multiple MCP servers in coordination
- Prototyping agentic SQL generation approaches

---

### MCP Flow New

**File**: `experimental/mcp_flow_new.py`

**Purpose**: Optimized version of MCP Flow with persistent MCP connections and agent reuse for better performance.

**Key Differences from MCP Flow**:
- **Agent Reuse**: Singleton pattern vs per-request creation
- **Persistent MCP Connection**: Cached connection vs new connection each time
- **Simplified Prompts**: Removed inline expertise_prefix and instruction_clickhouse
- **Message-Based Interface**: Uses EasyInputMessageParam format
- **Runtime Model Config**: RunConfig separation allows flexible model selection
- **Single MCP Server**: Only DB Meta in the flow (vs dual server setup)
- **Performance**: Faster due to connection reuse and tool list caching

**Process**:
1. Uses init_agent() for singleton agent pattern with cached connection
2. Builds simplified instructions (DB-ref prompts + model-specific guidance)
3. Creates OpenAI-style message format (system + user)
4. Configures Runner with temperature=0, parallel_tool_calls=True
5. Agent generates SQL using persistent MCP connection
6. Executes SQL via solana_db.py MCP server (same as mcp_flow)

**Trade-offs**:
- ✅ Better performance through connection/agent reuse
- ✅ Cleaner separation of concerns (agent init vs flow logic)
- ❌ Less flexible prompt composition per request
- ❌ Shared agent state across requests (potential concurrency issues)
- ❌ Hardcoded MCP server URL in init_agent

**Best For**:
- High-throughput scenarios where agent reuse matters
- Production deployments with stable MCP endpoints
- Scenarios where connection overhead is significant
- When tool list caching provides measurable benefits

---

### LangGraph Flow

**File**: `experimental/langgraph_flow.py`

**Purpose**: Multi-step query decomposition with dynamic execution graphs using LangGraph orchestration.

**Key Features**:
- Content-addressable intermediate tables (hash-based naming for caching)
- Dependency-aware execution ordering
- MCP server integration for query execution (solana_db.py)
- YAML-configurable graph structure (pipeline.yml)
- Deterministic pipeline IDs enable result caching and reproducibility

**Process**:
1. Loads YAML-based node/edge configuration (pipeline.yml)
2. LLM decomposes query into ExecutionPipeline using "legacy_langchain" slot
3. Builds dynamic LangGraph subgraph from the plan
4. Resolves logical table references (`<step_X_id>`) to physical temp tables
5. Computes deterministic table names using SHA-256 content hashing
6. Executes steps sequentially or in parallel based on dependencies
7. Materializes intermediate results as temp tables
8. Collects final output from designated output_step_id

**Graph Nodes**:
- `process_input_node`: Clarifies user input (currently passthrough)
- `generate_execution_plan_node`: Creates multi-step execution plan
- `format_response_node`: Formats final results

**Best For**:
- Complex analytical queries requiring multiple intermediate steps
- Queries benefiting from result caching between steps
- Advanced optimization scenarios with explicit dependency graphs
- Experimental/research use cases

---

## Flow Comparison

| Feature | Interactive Query | Multistep | Simple | Data Only | Flex | MCP | MCP New | LangGraph |
|---------|------------------|-----------|--------|-----------|------|-----|---------|-----------|
| **Retry Loop** | ✅ (3 attempts) | ✅ (max_steps) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Metadata Storage** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Query Lineage** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Natural Language Response** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Session History** | ✅ | ✅ (full) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Chart Generation** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cost Analysis** | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Adaptive Execution** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Multi-step Reasoning** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Agent-based** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Structured Output** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Production Ready** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Choosing the Right Flow

### Use Interactive Query Flow when you need:
- Robust validation and error recovery
- Query metadata and lineage tracking
- Building on previous queries in a session
- Production-grade reliability
- Query storage and reuse

### Use Multistep Flow when you need:
- Complex investigations requiring multiple reasoning steps
- Data visualizations (charts/graphs)
- Assumption tracking and transparency
- Conversational refinement with follow-ups
- User clarification requests mid-flow

### Use Simple Flow when you need:
- Quick one-off queries with conversational responses
- Query cost analysis without retry complexity
- Natural language formatting of results
- Balance between simplicity and user-friendliness

### Use Data Only Flow when you need:
- Raw data extraction for APIs
- Maximum speed and simplicity
- Programmatic integrations
- Client-side error handling
- Batch data exports

### Use Flex Flow when you need:
- Automatic optimization for complex queries
- Warehouse load reduction
- Adaptive strategy based on query complexity
- DuckDB intermediate processing
- Cost-aware execution

### Use MCP Flow (Experimental) when you need:
- To demonstrate MCP integration patterns
- Agent-based workflows
- Dual MCP server coordination
- Prototyping agentic approaches

### Use MCP Flow New (Experimental) when you need:
- High-throughput with agent reuse
- Performance optimization through persistent connections
- Production MCP deployments
- Tool list caching benefits

### Use LangGraph Flow (Experimental) when you need:
- Multi-step query decomposition
- Result caching between steps
- Explicit dependency graphs
- Advanced optimization research

---

## Implementation Notes

### Common Components

All flows share these common components:
- **Prompt Assembler**: Slot-based template composition with client overlays
- **MCP Providers**: DbMetaAsyncProvider and DbRefAsyncProvider for schema/reference data
- **Warehouse Dialect**: Cached dialect for SQL parsing (typically ClickHouse)
- **Request Status Tracking**: Updates status throughout execution
- **Structured Logging**: Comprehensive logging with flow stages and step numbers

### Prompt Slots

Production flows use these prompt slots:
- **interactive_query**: Interactive query generation with metadata
- **multistep_intent**: Intent analysis for multistep flow
- **multistep_request**: SQL generation for multistep flow
- **multistep_chart**: Chart generation instructions
- **multistep_response**: Data response formatting
- **multistep_response_plain**: Simple response formatting
- **legacy_simple_request**: Simple flow SQL generation
- **legacy_simple_response**: Simple flow response formatting
- **legacy_data_only**: Data-only flow SQL generation
- **legacy_flex_flow**: Flex flow SQL generation
- **legacy_sql_planner**: Flex flow pipeline planning
- **legacy_langchain**: LangGraph flow pipeline decomposition

### Error Handling Patterns

Different flows use different error handling strategies:
- **Interactive Query**: 3-attempt retry loop with validation feedback
- **Multistep**: Configurable max_steps with error context in conversation
- **Simple/Data Only**: Fail fast on errors (no retry)
- **Flex**: Adaptive strategy avoids errors through cost analysis
- **MCP**: Agent handles tool interactions (no explicit retry)
- **LangGraph**: Dependency-aware execution with intermediate materialization

---

## Future Directions

Potential enhancements and new flows:
- **Hybrid Flow**: Combine interactive query's validation with multistep's reasoning
- **Streaming Flow**: Real-time result streaming for long-running queries
- **Collaborative Flow**: Multi-agent collaboration for complex analysis
- **Learning Flow**: Incorporates user feedback to improve over time
- **RAG Flow**: Enhanced with retrieval-augmented generation for examples
- **Tool-Augmented Flow**: Integrates external tools (calculators, APIs, etc.)

---

## Contributing

When adding a new flow:
1. Create a comprehensive docstring explaining purpose, process, and use cases
2. Add entry to this FLOWS.md document
3. Update the flow comparison table
4. Add tests for the new flow
5. Document any new prompt slots or MCP servers
6. Update CLAUDE.md if architecture patterns change
