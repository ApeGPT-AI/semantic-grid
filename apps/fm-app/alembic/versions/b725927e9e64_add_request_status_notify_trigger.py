"""add_request_status_notify_trigger

Adds PostgreSQL NOTIFY trigger for real-time SSE updates when request status changes.

When a request row is updated, the trigger sends a notification on the 'request_update'
channel with JSON payload containing request_id, session_id, status, and updated_at.

This enables Server-Sent Events (SSE) endpoint to push real-time updates to connected
web clients without polling.

Revision ID: b725927e9e64
Revises: a0686b6349c6
Create Date: 2025-10-27 20:55:46.545435

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b725927e9e64'
down_revision: Union[str, None] = 'a0686b6349c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Create PostgreSQL trigger function and trigger for request status notifications.

    The function emits a pg_notify event whenever a request row is updated.
    Payload includes: request_id, session_id, status, updated_at.
    """
    op.execute("""
        -- Create trigger function to send notifications on request updates
        CREATE OR REPLACE FUNCTION notify_request_status_update()
        RETURNS trigger AS $$
        BEGIN
            -- Only notify if status has actually changed or this is an INSERT
            IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status)
               OR (OLD.response IS DISTINCT FROM NEW.response)
               OR (OLD.err IS DISTINCT FROM NEW.err) THEN

                -- Send notification to 'request_update' channel
                PERFORM pg_notify(
                    'request_update',
                    json_build_object(
                        'request_id', NEW.request_id::text,
                        'session_id', NEW.session_id::text,
                        'status', NEW.status::text,
                        'updated_at', EXTRACT(EPOCH FROM NEW.updated_at),
                        'has_response', (NEW.response IS NOT NULL),
                        'has_error', (NEW.err IS NOT NULL),
                        'sequence_number', NEW.sequence_number
                    )::text
                );
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger on request table
        CREATE TRIGGER request_status_update_trigger
        AFTER INSERT OR UPDATE ON request
        FOR EACH ROW
        EXECUTE FUNCTION notify_request_status_update();

        -- Create index on session_id + updated_at for efficient SSE queries
        CREATE INDEX IF NOT EXISTS idx_request_session_updated
        ON request(session_id, updated_at DESC);
    """)


def downgrade() -> None:
    """
    Remove the trigger, trigger function, and index.
    """
    op.execute("""
        -- Drop trigger
        DROP TRIGGER IF EXISTS request_status_update_trigger ON request;

        -- Drop trigger function
        DROP FUNCTION IF EXISTS notify_request_status_update();

        -- Drop index
        DROP INDEX IF EXISTS idx_request_session_updated;
    """)
