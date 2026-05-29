from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class CourierLeaveRequest(Base):
    __tablename__ = "courier_leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    courier_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    denial_reason = Column(String(255), nullable=True)
    description_conge = Column(Text, nullable=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    courier = relationship("User", back_populates="leave_requests")
