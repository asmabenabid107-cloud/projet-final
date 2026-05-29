from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(30), unique=True, nullable=True)
    phone2 = Column(String(30), nullable=True)

    password_hash = Column(String(255), nullable=False)

    role = Column(String(20), nullable=False, default="shipper")
    is_approved = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)

    address = Column(String(255), nullable=True)
    gender = Column(String(20), nullable=True)
    ouvrir_colis_par_defaut = Column(String(10), nullable=False, default="non")

    assigned_region = Column(String(120), nullable=True)
    assigned_depot = Column(String(120), nullable=True)

    courier_status = Column(String(30), nullable=True)
    manual_courier_status = Column(String(30), nullable=True)
    contract_end_date = Column(Date, nullable=True)
    day_off = Column(String(20), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    colis = relationship(
        "Colis",
        back_populates="shipper",
        cascade="all, delete-orphan",
        foreign_keys="Colis.shipper_id",
    )

    leave_requests = relationship(
        "CourierLeaveRequest",
        back_populates="courier",
        cascade="all, delete-orphan",
    )

    @property
    def hashed_password(self) -> str:
        return self.password_hash
