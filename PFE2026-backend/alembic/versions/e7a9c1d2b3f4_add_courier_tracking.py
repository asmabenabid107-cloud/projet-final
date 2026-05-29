from alembic import op
import sqlalchemy as sa


revision = "e7a9c1d2b3f4"
down_revision = "d4c3b2a190ef"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "courier_live_locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("courier_id", sa.Integer(), nullable=False),
        sa.Column("tournee_id", sa.Integer(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("speed", sa.Float(), nullable=True),
        sa.Column("heading", sa.Float(), nullable=True),
        sa.Column("is_online", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["courier_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tournee_id"], ["tournees.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("courier_id"),
    )
    op.create_index("ix_courier_live_locations_id", "courier_live_locations", ["id"])
    op.create_index("ix_courier_live_locations_courier_id", "courier_live_locations", ["courier_id"])
    op.create_index("ix_courier_live_locations_tournee_id", "courier_live_locations", ["tournee_id"])

    op.create_table(
        "courier_location_points",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("courier_id", sa.Integer(), nullable=False),
        sa.Column("tournee_id", sa.Integer(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("speed", sa.Float(), nullable=True),
        sa.Column("heading", sa.Float(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["courier_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tournee_id"], ["tournees.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_courier_location_points_id", "courier_location_points", ["id"])
    op.create_index("ix_courier_location_points_courier_id", "courier_location_points", ["courier_id"])
    op.create_index("ix_courier_location_points_tournee_id", "courier_location_points", ["tournee_id"])
    op.create_index(
        "ix_courier_location_points_courier_recorded",
        "courier_location_points",
        ["courier_id", "recorded_at"],
    )


def downgrade():
    op.drop_index("ix_courier_location_points_courier_recorded", table_name="courier_location_points")
    op.drop_index("ix_courier_location_points_tournee_id", table_name="courier_location_points")
    op.drop_index("ix_courier_location_points_courier_id", table_name="courier_location_points")
    op.drop_index("ix_courier_location_points_id", table_name="courier_location_points")
    op.drop_table("courier_location_points")

    op.drop_index("ix_courier_live_locations_tournee_id", table_name="courier_live_locations")
    op.drop_index("ix_courier_live_locations_courier_id", table_name="courier_live_locations")
    op.drop_index("ix_courier_live_locations_id", table_name="courier_live_locations")
    op.drop_table("courier_live_locations")
