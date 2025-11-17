from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from fm_app.config import get_settings

settings = get_settings()
DATABASE_URL = f"postgresql+asyncpg://{settings.database_user}:{settings.database_pass}@{settings.database_server}:{settings.database_port}/{settings.database_db}"

engine = create_async_engine(
    DATABASE_URL, pool_size=5, max_overflow=10, pool_pre_ping=True, pool_recycle=360
)

SESSION = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SESSION() as session:
        yield session
