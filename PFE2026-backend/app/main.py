from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, or_, text

from app.api.routes.admin_colis import router as admin_colis_router
from app.api.routes.admin_courier_leaves import router as admin_courier_leaves_router
from app.api.routes.admin_couriers import router as admin_couriers_router
from app.api.routes.admin_settings import router as admin_settings_router
from app.api.routes.admin_shippers import router as admin_shippers_router
from app.api.routes.admin_stats import router as admin_stats_router
from app.api.routes.auth import router as auth_router
from app.api.routes.colis import router as colis_router
from app.api.routes.courier_colis import router as courier_colis_router
from app.api.routes.courier_leaves import router as courier_leaves_router
from app.api.routes.vehicles import router as vehicles_router
from app.core.colis_codes import generate_barcode_value
from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.colis import Colis
from app.models.colis_event import ColisEvent
from app.models.courier_leave_request import CourierLeaveRequest
from app.models.user import User
from app.models.vehicle import Vehicle

from app.api.routes.courier_tracking import router as courier_tracking_router
from app.models.courier_location import CourierLiveLocation, CourierLocationPoint
from app.api.routes import admin_tournees

app = FastAPI(title="MZ Logistic API")


def ensure_user_courier_columns():
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns("users")}

    statements = []
    if "phone2" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN phone2 VARCHAR(30)")
    if "address" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN address VARCHAR(255)")

    if "gender" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN gender VARCHAR(20)")
    if "ouvrir_colis_par_defaut" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN ouvrir_colis_par_defaut VARCHAR(10) NOT NULL DEFAULT 'non'")
    if "assigned_region" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN assigned_region VARCHAR(120)")
    if "assigned_depot" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN assigned_depot VARCHAR(120)")
    if "courier_status" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN courier_status VARCHAR(30)")
    if "manual_courier_status" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN manual_courier_status VARCHAR(30)")
    if "contract_end_date" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN contract_end_date DATE")

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(
            text(
                "UPDATE users "
                "SET manual_courier_status = COALESCE(courier_status, 'active') "
                "WHERE role = 'courier' AND manual_courier_status IS NULL"
            )
        )
        connection.execute(
            text(
                "UPDATE users "
                "SET courier_status = 'active' "
                "WHERE role = 'courier' AND is_approved = true AND courier_status IS NULL"
            )
        )


def ensure_colis_tracking_columns():
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns("colis")}

    statements = []
    if "destination_label" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN destination_label VARCHAR(120)")
    if "barcode_value" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN barcode_value VARCHAR(40)")
    if "tracking_stage" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN tracking_stage VARCHAR(40)")
    if "picked_up_at" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN picked_up_at TIMESTAMP")
    if "picked_up_by_courier_id" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN picked_up_by_courier_id INTEGER")
    if "warehouse_received_at" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN warehouse_received_at TIMESTAMP")
    if "warehouse_received_by_courier_id" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN warehouse_received_by_courier_id INTEGER")
    if "out_for_delivery_at" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN out_for_delivery_at TIMESTAMP")
    if "out_for_delivery_by_courier_id" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN out_for_delivery_by_courier_id INTEGER")
    if "delivery_issue_count" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN delivery_issue_count INTEGER DEFAULT 0")
    if "last_delivery_issue_at" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN last_delivery_issue_at TIMESTAMP")
    if "last_delivery_issue_reason" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN last_delivery_issue_reason VARCHAR(500)")
    if "returned_at" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN returned_at TIMESTAMP")
    if "ouvrir_colis" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN ouvrir_colis VARCHAR(10) NOT NULL DEFAULT 'non'")
    if "delivered_at" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN delivered_at TIMESTAMP")
    if "delivered_by_courier_id" not in existing_columns:
        statements.append("ALTER TABLE colis ADD COLUMN delivered_by_courier_id INTEGER")

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(text("UPDATE colis SET delivery_issue_count = COALESCE(delivery_issue_count, 0)"))
        if "failed_delivery_at" in existing_columns:
            failed_reason_expr = (
                "failed_delivery_reason"
                if "failed_delivery_reason" in existing_columns
                else "last_delivery_issue_reason"
            )
            connection.execute(
                text(
                    "UPDATE colis "
                    "SET last_delivery_issue_at = COALESCE(last_delivery_issue_at, failed_delivery_at), "
                    f"last_delivery_issue_reason = COALESCE(last_delivery_issue_reason, {failed_reason_expr}), "
                    "delivery_issue_count = CASE "
                    "WHEN COALESCE(delivery_issue_count, 0) = 0 AND failed_delivery_at IS NOT NULL THEN 1 "
                    "ELSE COALESCE(delivery_issue_count, 0) "
                    "END "
                    "WHERE failed_delivery_at IS NOT NULL"
                )
            )
        if "returned_to_shipper_at" in existing_columns:
            connection.execute(
                text(
                    "UPDATE colis "
                    "SET returned_at = COALESCE(returned_at, returned_to_shipper_at) "
                    "WHERE returned_to_shipper_at IS NOT NULL"
                )
            )

        returned_conditions = ["returned_at IS NOT NULL", "tracking_stage = 'returned'", "statut = 'retour'"]
        if "returned_to_shipper_at" in existing_columns:
            returned_conditions.insert(0, "returned_to_shipper_at IS NOT NULL")

        warehouse_conditions = ["warehouse_received_at IS NOT NULL"]
        if "failed_delivery_at" in existing_columns:
            warehouse_conditions.append("failed_delivery_at IS NOT NULL")
        warehouse_conditions.extend(
            [
                "tracking_stage = 'delivery_failed'",
                "tracking_stage = 'returned_to_warehouse'",
            ]
        )

        connection.execute(
            text(
                "UPDATE colis "
                "SET tracking_stage = CASE "
                "WHEN tracking_stage = 'return_pending' THEN 'return_pending' "
                f"WHEN {' OR '.join(returned_conditions)} THEN 'returned' "
                "WHEN delivered_at IS NOT NULL OR statut = 'livre' THEN 'delivered' "
                "WHEN tracking_stage = 'out_for_delivery' THEN 'out_for_delivery' "
                f"WHEN {' OR '.join(warehouse_conditions)} THEN 'at_warehouse' "
                "WHEN picked_up_at IS NOT NULL OR tracking_stage = 'in_dispatch' OR statut = 'en_transit' THEN 'picked_up' "
                "ELSE 'pending_pickup' "
                "END"
            )
        )


def ensure_tournee_columns():
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns("tournees")}

    statements = []
    if "refuse_reason" not in existing_columns:
        statements.append(
            "ALTER TABLE tournees ADD COLUMN refuse_reason VARCHAR(255)"
        )
    if "execution_date" not in existing_columns:
        statements.append(
            "ALTER TABLE tournees ADD COLUMN execution_date DATE"
        )
    if "vehicle_min_capacity" not in existing_columns:
        statements.append(
            "ALTER TABLE tournees ADD COLUMN vehicle_min_capacity DOUBLE PRECISION DEFAULT 0"
        )

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def backfill_colis_barcodes():
    db = SessionLocal()
    try:
        colis_without_barcode = (
            db.query(Colis)
            .filter(or_(Colis.barcode_value.is_(None), Colis.barcode_value == ""))
            .order_by(Colis.id.asc())
            .all()
        )
        used_codes = {
            value
            for (value,) in db.query(Colis.barcode_value)
            .filter(Colis.barcode_value.isnot(None), Colis.barcode_value != "")
            .all()
        }

        changed = False
        for colis in colis_without_barcode:
            code = generate_barcode_value()
            while code in used_codes:
                code = generate_barcode_value()
            colis.barcode_value = code
            used_codes.add(code)
            changed = True

        if changed:
            db.commit()
    finally:
        db.close()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    ensure_user_courier_columns()
    ensure_colis_tracking_columns()
    ensure_tournee_columns()
    backfill_colis_barcodes()

    if settings.SEED_ADMIN_ENABLED:
        if not settings.SEED_ADMIN_PASSWORD:
            raise RuntimeError("SEED_ADMIN_PASSWORD is required when SEED_ADMIN_ENABLED is true")

        db = SessionLocal()
        try:
            exists = db.query(User).filter(User.email == settings.SEED_ADMIN_EMAIL).first()
            if not exists:
                admin = User(
                    name=settings.SEED_ADMIN_NAME,
                    email=settings.SEED_ADMIN_EMAIL,
                    phone=00000000,
                    password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
                    role="admin",
                    is_approved=True,
                    is_active=True,
                )
                db.add(admin)
                db.commit()
        finally:
            db.close()


app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(admin_settings_router)
app.include_router(admin_shippers_router, prefix="/admin/shippers", tags=["admin-shippers"])
app.include_router(admin_stats_router, prefix="/admin/stats", tags=["admin-stats"])
app.include_router(admin_colis_router, tags=["admin-colis"])
app.include_router(admin_courier_leaves_router, tags=["admin-courier-leaves"])
app.include_router(courier_tracking_router)
app.include_router(colis_router)
app.include_router(courier_colis_router, tags=["courier-colis"])
app.include_router(courier_leaves_router, tags=["courier-leaves"])
app.include_router(admin_couriers_router, prefix="/admin/couriers", tags=["admin-couriers"])
app.include_router(vehicles_router)
app.include_router(admin_tournees.router)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/")
def root():
    return {"message": "MZ Logistic API. Go to /docs"}
