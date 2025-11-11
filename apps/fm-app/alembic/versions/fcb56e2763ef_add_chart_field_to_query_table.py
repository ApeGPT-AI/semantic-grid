"""add_chart_field_to_query_table

Revision ID: fcb56e2763ef
Revises: b725927e9e64
Create Date: 2025-11-10 17:24:01.273132

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fcb56e2763ef'
down_revision: Union[str, None] = 'b725927e9e64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE query ADD COLUMN IF NOT EXISTS chart jsonb;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE query DROP COLUMN IF EXISTS chart;
        """
    )
