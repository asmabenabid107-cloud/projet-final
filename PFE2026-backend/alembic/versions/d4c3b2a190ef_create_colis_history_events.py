"""create colis history events

Revision ID: d4c3b2a190ef
Revises: c6d4d9b0a8f2
Create Date: 2026-04-12 01:35:00.000000

"""

from datetime import timedelta
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4c3b2a190ef"
down_revision: Union[str, Sequence[str], None] = "c6d4d9b0a8f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "colis_history_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("colis_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("event_at", sa.DateTime(), nullable=False),
        sa.Column("is_notification", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["colis_id"], ["colis.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_colis_history_events_id"), "colis_history_events", ["id"], unique=False)
    op.create_index(op.f("ix_colis_history_events_colis_id"), "colis_history_events", ["colis_id"], unique=False)
    op.create_index(op.f("ix_colis_history_events_event_at"), "colis_history_events", ["event_at"], unique=False)

    bind = op.get_bind()
    colis_table = sa.table(
        "colis",
        sa.column("id", sa.Integer()),
        sa.column("created_at", sa.DateTime()),
        sa.column("updated_at", sa.DateTime()),
        sa.column("statut", sa.String()),
        sa.column("admin_note", sa.String()),
        sa.column("admin_note_at", sa.DateTime()),
    )
    history_table = sa.table(
        "colis_history_events",
        sa.column("colis_id", sa.Integer()),
        sa.column("kind", sa.String()),
        sa.column("title", sa.String()),
        sa.column("note", sa.Text()),
        sa.column("event_at", sa.DateTime()),
        sa.column("is_notification", sa.Boolean()),
        sa.column("read_at", sa.DateTime()),
        sa.column("expires_at", sa.DateTime()),
    )

    rows = bind.execute(
        sa.select(
            colis_table.c.id,
            colis_table.c.created_at,
            colis_table.c.updated_at,
            colis_table.c.statut,
            colis_table.c.admin_note,
            colis_table.c.admin_note_at,
        )
    ).mappings().all()

    history_rows = []
    for row in rows:
        created_at = row["created_at"] or row["updated_at"]
        if created_at:
            history_rows.append(
                {
                    "colis_id": row["id"],
                    "kind": "created",
                    "title": "Colis ajoute au systeme",
                    "note": "Bordereau enregistre par l expediteur.",
                    "event_at": created_at,
                    "is_notification": False,
                    "read_at": None,
                    "expires_at": None,
                }
            )

        admin_note = (row["admin_note"] or "").strip().lower()
        admin_note_at = row["admin_note_at"] or row["updated_at"] or created_at
        if admin_note == "accepte" and admin_note_at:
            history_rows.append(
                {
                    "colis_id": row["id"],
                    "kind": "approved",
                    "title": "Validation admin",
                    "note": "Le colis a ete accepte.",
                    "event_at": admin_note_at,
                    "is_notification": True,
                    "read_at": None,
                    "expires_at": admin_note_at + timedelta(hours=48),
                }
            )
        elif admin_note == "refuse" and admin_note_at:
            history_rows.append(
                {
                    "colis_id": row["id"],
                    "kind": "rejected",
                    "title": "Refus admin",
                    "note": "Le colis a ete refuse.",
                    "event_at": admin_note_at,
                    "is_notification": True,
                    "read_at": None,
                    "expires_at": admin_note_at + timedelta(hours=48),
                }
            )

        status_value = (row["statut"] or "").strip().lower()
        status_event_at = row["updated_at"] or admin_note_at or created_at
        if not status_event_at:
            continue

        if "transit" in status_value:
            history_rows.append(
                {
                    "colis_id": row["id"],
                    "kind": "transit",
                    "title": "Statut actuel: En transit",
                    "note": "Le colis est en cours de livraison.",
                    "event_at": status_event_at,
                    "is_notification": False,
                    "read_at": None,
                    "expires_at": None,
                }
            )
        elif "livr" in status_value:
            history_rows.append(
                {
                    "colis_id": row["id"],
                    "kind": "delivered",
                    "title": "Statut actuel: Livre",
                    "note": "Le colis a ete livre au destinataire.",
                    "event_at": status_event_at,
                    "is_notification": False,
                    "read_at": None,
                    "expires_at": None,
                }
            )
        elif "retour" in status_value:
            history_rows.append(
                {
                    "colis_id": row["id"],
                    "kind": "returned",
                    "title": "Statut actuel: Retour",
                    "note": "Le colis est en retour.",
                    "event_at": status_event_at,
                    "is_notification": False,
                    "read_at": None,
                    "expires_at": None,
                }
            )
        elif "annul" in status_value and admin_note != "refuse":
            history_rows.append(
                {
                    "colis_id": row["id"],
                    "kind": "cancelled",
                    "title": "Statut actuel: Annule",
                    "note": "Le colis a ete annule.",
                    "event_at": status_event_at,
                    "is_notification": False,
                    "read_at": None,
                    "expires_at": None,
                }
            )

    if history_rows:
        op.bulk_insert(history_table, history_rows)


def downgrade() -> None:
    op.drop_index(op.f("ix_colis_history_events_event_at"), table_name="colis_history_events")
    op.drop_index(op.f("ix_colis_history_events_colis_id"), table_name="colis_history_events")
    op.drop_index(op.f("ix_colis_history_events_id"), table_name="colis_history_events")
    op.drop_table("colis_history_events")
