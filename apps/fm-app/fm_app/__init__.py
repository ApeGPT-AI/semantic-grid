import logging.config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fm_app.api.db_session import engine
from fm_app.api.routes import api_router
from fm_app.logs import LOGGING_CONFIG

logging.config.dictConfig(LOGGING_CONFIG)
LOGGER = logging.getLogger("fm_app")

app = FastAPI(
    version="v1",
    docs_url="/swagger",
    redoc_url="/redocs",
)

app.include_router(api_router, prefix="/api/v1")

# Add the CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def on_shutdown():
    await engine.dispose()
