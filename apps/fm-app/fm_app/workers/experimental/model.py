from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class Timeframe(BaseModel):
    type: Literal["range", "interval", "all"]
    from_: Optional[str] = Field(None, alias="from")
    to: Optional[str] = None


class QueryMetadata(BaseModel):
    table: str
    operation: str
    token: Optional[str] = None
    wallet: Optional[str] = None
    timeframe: Optional[Timeframe] = None
    aggregation: Optional[str] = None


class Step(BaseModel):
    id: str
    label: Optional[str] = None
    description: Optional[str] = None
    depends_on: Optional[List[str]] = None
    type: Literal[
        "sql",
        "filter",
        "aggregate",
        "join",
        "api_call",
        "materialize",
        "explain",
        "lookup",
    ]
    parameters: Optional[Dict[str, Any]] = None
    sql: Optional[str] = None
    output_table: Optional[str] = None
    metadata: Optional[QueryMetadata] = None
    error: Optional[str] = None


class ExecutionPipeline(BaseModel):
    query_id: str
    user_question: str
    steps: List[Step]
    step_map: Dict[str, Step]  # Map of step ID to step object
    output_step_id: str  # ID of the step whose result is final

    # Final result after execution
    result: Optional[
        List[Dict[str, Any]]  # Final output as list of records (best for formatting)
    ] = None


# print(ExecutionPipeline.model_json_schema())
