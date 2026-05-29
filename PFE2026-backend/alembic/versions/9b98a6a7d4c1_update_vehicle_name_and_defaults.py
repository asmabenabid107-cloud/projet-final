"""update vehicle name and defaults

Revision ID: 9b98a6a7d4c1
Revises: 22033febb300
Create Date: 2026-04-11 23:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9b98a6a7d4c1"
down_revision: Union[str, Sequence[str], None] = "22033febb300"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("vehicles", sa.Column("name", sa.String(length=120), nullable=True))
    op.alter_column("vehicles", "min_length", existing_type=sa.Integer(), server_default=sa.text("10"))
    op.alter_column("vehicles", "max_length", existing_type=sa.Integer(), server_default=sa.text("15"))


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("vehicles", "max_length", existing_type=sa.Integer(), server_default=sa.text("40"))
    op.alter_column("vehicles", "min_length", existing_type=sa.Integer(), server_default=sa.text("20"))
    op.drop_column("vehicles", "name")
