from sqlalchemy import create_engine, Engine

from dbmeta_app.config import get_settings


def get_db() -> Engine:
    settings = get_settings()
    url = f"{settings.database_wh_driver}://{settings.database_wh_user}:{settings.database_wh_pass}@{settings.database_wh_server_v2}:{settings.database_wh_port_v2}/{settings.database_wh_db_v2}{settings.database_wh_params_v2}"  # noqa: E501
    return create_engine(
        url, pool_size=20, max_overflow=30, pool_pre_ping=True, pool_recycle=360
    )
