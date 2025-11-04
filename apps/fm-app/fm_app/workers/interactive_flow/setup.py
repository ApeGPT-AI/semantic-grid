"""Setup and initialization for interactive flow."""

import itertools
import pathlib
from dataclasses import dataclass
from datetime import datetime
from typing import Type

import structlog
from celery.utils.log import get_task_logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.session import Session

from fm_app.ai_models.model import AIModel
from fm_app.api.model import WorkerRequest
from fm_app.config import Settings, get_settings
from fm_app.db.db import get_session_by_id
from fm_app.mcp_servers.mcp_async_providers import (
    DbMetaAsyncProvider,
    DbRefAsyncProvider,
)
from fm_app.prompt_assembler.prompt_packs import PromptAssembler
from fm_app.utils import get_cached_warehouse_dialect


@dataclass
class FlowContext:
    """Shared context for all flow handlers."""

    req: WorkerRequest
    ai_model: Type[AIModel]
    db_wh: Session
    db: AsyncSession
    logger: structlog.BoundLogger
    settings: Settings
    warehouse_dialect: str
    assembler: PromptAssembler
    flow_step: itertools.count
    request_session: any
    parent_session: any


async def initialize_flow(
    req: WorkerRequest, ai_model: Type[AIModel], db_wh: Session, db: AsyncSession
) -> FlowContext:
    """Initialize flow context with all required dependencies."""
    logger = structlog.wrap_logger(get_task_logger(__name__))
    flow_step = itertools.count(1)

    settings = get_settings()
    warehouse_dialect = get_cached_warehouse_dialect()

    structlog.contextvars.bind_contextvars(
        request_id=req.request_id, flow_name=ai_model.get_name() + "_interactive"
    )

    # Initialize PromptAssembler
    repo_root = pathlib.Path(settings.packs_resources_dir)
    assembler = PromptAssembler(
        repo_root=repo_root,
        component="fm_app",
        client=settings.client_id,
        env=settings.env,
        system_version=settings.system_version,
    )

    # Register async MCP providers
    assembler.register_async_mcp(DbMetaAsyncProvider(settings, logger))
    assembler.register_async_mcp(DbRefAsyncProvider(settings, logger))

    # Get session data
    request_session = await get_session_by_id(session_id=req.session_id, db=db)
    parent_session = (
        await get_session_by_id(session_id=req.parent_session_id, db=db)
        if req.parent_session_id
        else None
    )

    return FlowContext(
        req=req,
        ai_model=ai_model,
        db_wh=db_wh,
        db=db,
        logger=logger,
        settings=settings,
        warehouse_dialect=warehouse_dialect,
        assembler=assembler,
        flow_step=flow_step,
        request_session=request_session,
        parent_session=parent_session,
    )


def build_prompt_variables(ctx: FlowContext) -> dict:
    """Build common prompt variables from context."""
    req = ctx.req
    request_session = ctx.request_session
    parent_session = ctx.parent_session
    settings = ctx.settings

    query_metadata_instruction = (
        f"Current QueryMetadata: {req.query.model_dump_json()}"
        if req.query is not None
        else (
            f"Current QueryMetadata: {request_session.metadata}"
            if request_session.metadata is not None
            else f"QueryMetadata ID (new): {req.session_id}"
        )
    )

    parent_instruction = (
        f"Parent session UUID: {request_session.parent}"
        if request_session.parent is not None
        else ""
    )

    parent_metadata_instruction = (
        f"Parent QueryMetadata: {parent_session.metadata}"
        if parent_session is not None
        else ""
    )

    column_instruction = (
        f"Selected Column Data [id, ...data values]: {req.refs.cols}"
        if req.refs is not None and req.refs.cols is not None
        else ""
    )

    rows_instruction = (
        f"Selected Row Data [[...headers], ...[...values]]: {req.refs.rows}"
        if req.refs is not None and req.refs.rows is not None
        else ""
    )

    intent_hint = f"Intent Hint: {req.request_type}"

    return {
        "client_id": settings.client_id,
        "intent_hint": intent_hint,
        "query_metadata": query_metadata_instruction,
        "parent_query_metadata": parent_metadata_instruction,
        "parent_session_id": parent_instruction,
        "selected_row_data": rows_instruction,
        "selected_column_data": column_instruction,
        "current_datetime": datetime.now().replace(microsecond=0),
    }
