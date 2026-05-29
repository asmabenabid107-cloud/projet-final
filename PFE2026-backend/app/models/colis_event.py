from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class ColisEvent(Base):
    __tablename__ = "colis_history_events"

    id = Column(Integer, primary_key=True, index=True)
    colis_id = Column(Integer, ForeignKey("colis.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)
    title = Column(String(180), nullable=False)
    note = Column(Text, nullable=True)
    event_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    is_notification = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)

    colis = relationship("Colis", back_populates="history")

    @property
    def date(self):
        return self.event_at

    @property
    def is_read(self):
        return self.read_at is not None
