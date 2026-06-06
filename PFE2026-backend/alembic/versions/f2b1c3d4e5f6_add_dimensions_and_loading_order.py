from alembic import op
import sqlalchemy as sa


revision = "f2b1c3d4e5f6"
down_revision = "e7a9c1d2b3f4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("colis", sa.Column("longueur", sa.Float(), nullable=True))
    op.add_column("colis", sa.Column("largeur", sa.Float(), nullable=True))
    op.add_column("colis", sa.Column("hauteur", sa.Float(), nullable=True))

    op.add_column("tournee_colis", sa.Column("ordre_chargement", sa.Integer(), nullable=True))

    op.add_column("vehicles", sa.Column("longueur", sa.Float(), nullable=True))
    op.add_column("vehicles", sa.Column("largeur", sa.Float(), nullable=True))
    op.add_column("vehicles", sa.Column("hauteur", sa.Float(), nullable=True))
    op.add_column("vehicles", sa.Column("max_volume", sa.Float(), nullable=True))


def downgrade():
    op.drop_column("vehicles", "max_volume")
    op.drop_column("vehicles", "hauteur")
    op.drop_column("vehicles", "largeur")
    op.drop_column("vehicles", "longueur")

    op.drop_column("tournee_colis", "ordre_chargement")

    op.drop_column("colis", "hauteur")
    op.drop_column("colis", "largeur")
    op.drop_column("colis", "longueur")
