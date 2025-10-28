FROM python:3.13-bookworm AS builder

# Copy uv from uv image
COPY --from=ghcr.io/astral-sh/uv:0.8.22 /uv /uvx /bin/

# UV settings https://docs.astral.sh/uv/reference/settings/#link-mode
# UV_LINK_MODE=copy Copy packages from the wheel into the site-packages directory
# UV_COMPILE_BYTECODE If set, uv will compile Python source files to bytecode after installation.
# UV_PYTHON_DOWNLOADS Whether uv should allow Python downloads.
# UV_NO_DEV If set, uv will exclude development dependencies.
ENV UV_LINK_MODE=copy \
 UV_COMPILE_BYTECODE=0 \
 UV_PYTHON_DOWNLOADS=0 \
 UV_NO_DEV=1

ARG PROJECT_DIR=apps/fm-app

# Change the working directory to the `app` directory
WORKDIR /app

# Install dependencies with uv cache
RUN --mount=type=cache,target=/root/.cache/uv \
 --mount=type=bind,source=${PROJECT_DIR}/uv.lock,target=uv.lock \
 --mount=type=bind,source=${PROJECT_DIR}/pyproject.toml,target=pyproject.toml \
 uv sync --frozen --no-install-project

# Copy the project into the image
COPY ${PROJECT_DIR}/pyproject.toml ${PROJECT_DIR}/uv.lock /app/
COPY ${PROJECT_DIR}/fm_app /app/fm_app
COPY ${PROJECT_DIR}/alembic.ini /app/alembic.ini
COPY ${PROJECT_DIR}/alembic /app/alembic
COPY ${PROJECT_DIR}/celery_run.sh /app/celery_run.sh
COPY ${PROJECT_DIR}/run.sh /app/run.sh

# Sync the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

FROM python:3.13-slim-bookworm

ARG PROJECT_DIR=''

COPY --from=builder --chown=nobody:nogroup /app /app

ENV PACKS_RESOURCES_DIR=/app/packages
COPY --chown=nobody:nogroup ${PROJECT_DIR}/packages/resources/ /app/packages/resources/
COPY --chown=nobody:nogroup ${PROJECT_DIR}/packages/client-configs/ /app/packages/client-configs/

EXPOSE 8080

ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app

USER nobody

# CMD ["db-meta"]
