"""update vehicle weight defaults

Revision ID: c6d4d9b0a8f2
Revises: 9b98a6a7d4c1
Create Date: 2026-04-12 00:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c6d4d9b0a8f2"
down_revision: Union[str, Sequence[str], None] = "9b98a6a7d4c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column("vehicles", "min_length", existing_type=sa.Integer(), server_default=sa.text("20"))
    op.alter_column("vehicles", "max_length", existing_type=sa.Integer(), server_default=sa.text("40"))


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("vehicles", "min_length", existing_type=sa.Integer(), server_default=sa.text("10"))
    op.alter_column("vehicles", "max_length", existing_type=sa.Integer(), server_default=sa.text("15"))
