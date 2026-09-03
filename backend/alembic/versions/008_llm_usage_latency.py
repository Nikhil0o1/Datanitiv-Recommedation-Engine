"""Add latency_ms and success to llm_usage_events."""

from typing import Sequence, Union

from alembic import op

revision: str = "008_llm_usage_latency"
down_revision: Union[str, None] = "007_llm_usage"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE llm_usage_events ADD COLUMN IF NOT EXISTS latency_ms DOUBLE PRECISION")
    op.execute(
        "ALTER TABLE llm_usage_events ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT TRUE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE llm_usage_events DROP COLUMN IF EXISTS success")
    op.execute("ALTER TABLE llm_usage_events DROP COLUMN IF EXISTS latency_ms")
