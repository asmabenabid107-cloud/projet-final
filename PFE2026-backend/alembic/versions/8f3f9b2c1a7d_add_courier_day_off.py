"""add courier day off

Revision ID: 8f3f9b2c1a7d
Revises: d4c3b2a190ef
Create Date: 2026-05-17 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f3f9b2c1a7d"
down_revision: Union[str, Sequence[str], None] = "d4c3b2a190ef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    if not context.is_offline_mode():
        columns = {
            column["name"]
            for column in sa.inspect(op.get_bind()).get_columns("users")
        }
        if "day_off" in columns:
            return

    op.add_column("users", sa.Column("day_off", sa.String(length=20), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    if not context.is_offline_mode():
        columns = {
            column["name"]
            for column in sa.inspect(op.get_bind()).get_columns("users")
        }
        if "day_off" not in columns:
            return

    op.drop_column("users", "day_off")
