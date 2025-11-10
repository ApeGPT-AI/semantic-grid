import asyncio
import logging.config
from typing import Any

from fastmcp import Client, FastMCP

from dbmeta_app.api.routes import mcp
from dbmeta_app.config import get_settings
from dbmeta_app.logs import LOGGING_CONFIG

logging.config.dictConfig(LOGGING_CONFIG)

settings = get_settings()


async def check_mcp(mcp_server: FastMCP):
    # List the components that were created
    tools = await mcp_server.get_tools()
    resources = await mcp_server.get_resources()
    templates = await mcp_server.get_resource_templates()
    print(f"{len(tools)} Tool(s): {', '.join([t.name for t in tools.values()])}")
    print(
        f"""
        {len(resources)} Resource(s):
        {", ".join([r.name for r in resources.values()])}
        """
    )
    print(
        f"""
        {len(templates)} Resource Template(s):
        {", ".join([t.name for t in templates.values()])}
        """
    )

    # client = Client(f"ws://localhost:{settings.port}")
    client = Client(mcp_server)
    async with client:
        try:
            prompts: Any = await client.call_tool(
                "prompt_items",
                {
                    "req": {
                        "user_request": "Count all trades in the warehouse",
                        "db": "wh_v2",
                    }
                },
            )
            print("prompts", prompts[0].text)
            preflight: Any = await client.call_tool(
                "preflight_query",
                {
                    "req": {
                        "sql": "select count(*) from trades;",
                        "db": "wh_v2",
                    }
                },
            )
            print("preflight", preflight[0].text)

        except Exception as e:
            print(f"Error reading resource: {e}")

    return mcp_server


def main():
    """
    Console entry point for `db-meta`. Must be a sync callable.
    """
    # Optional: skip this on production boots if it slows startup; gate via env
    # if settings.check_mcp_on_start:
    asyncio.run(check_mcp(mcp))

    # Start the FastMCP (FastAPI/uvicorn) server; this is typically blocking.
    mcp.run(transport="sse", host="0.0.0.0", port=settings.port)


if __name__ == "__main__":
    main()
