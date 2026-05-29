"""create vehicles table

Revision ID: 5d6e6e42d44b
Revises: 7d5df18aff59
Create Date: 2026-04-11 22:30:00.000000

"""

from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5d6e6e42d44b"
down_revision: Union[str, Sequence[str], None] = "7d5df18aff59"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


vehicle_status_enum = sa.Enum(
    "actif",
    "inactif",
    "maintenance",
    name="vehiclestatus",
)


def upgrade() -> None:
    """Upgrade schema."""
    if context.is_offline_mode():
        _create_vehicles_table()
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("vehicles"):
        return

    _create_vehicles_table()


def downgrade() -> None:
    """Downgrade schema."""
    if context.is_offline_mode():
        op.drop_index(op.f("ix_vehicles_id"), table_name="vehicles")
        op.drop_table("vehicles")
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("vehicles"):
        index_names = {index["name"] for index in inspector.get_indexes("vehicles")}
        if op.f("ix_vehicles_id") in index_names:
            op.drop_index(op.f("ix_vehicles_id"), table_name="vehicles")
        op.drop_table("vehicles")

    vehicle_status_enum.drop(bind, checkfirst=True)


def _create_vehicles_table() -> None:
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("matricule", sa.String(length=40), nullable=False),
        sa.Column("status", vehicle_status_enum, nullable=False),
        sa.Column("min_length", sa.Integer(), nullable=False, server_default=sa.text("20")),
        sa.Column("max_length", sa.Integer(), nullable=False, server_default=sa.text("40")),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=True,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("matricule"),
    )
    op.create_index(op.f("ix_vehicles_id"), "vehicles", ["id"], unique=False)
