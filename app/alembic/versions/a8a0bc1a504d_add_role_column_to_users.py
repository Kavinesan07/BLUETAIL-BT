
"""add role column to users

Revision ID: a8a0bc1a504d
Revises: b24aaaeaa990
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'a8a0bc1a504d'
down_revision: Union[str, Sequence[str], None] = 'b24aaaeaa990'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'role',
            sa.Integer(),
            nullable=False,
            server_default='0'
        )
    )


def downgrade() -> None:
    op.drop_column('users', 'role')
