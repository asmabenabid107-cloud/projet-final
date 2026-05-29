"""add admin_note_at to colis

Revision ID: 22033febb300
Revises: 5d6e6e42d44b
Create Date: 2026-04-11 21:56:04.981851

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "22033febb300"
down_revision: Union[str, Sequence[str], None] = "5d6e6e42d44b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("colis", sa.Column("admin_note_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("colis", "admin_note_at")
