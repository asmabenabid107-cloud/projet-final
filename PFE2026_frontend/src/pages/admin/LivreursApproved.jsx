import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../api/client.js";
import {
  COURIER_STATUS_OPTIONS,
  DAY_OFF_OPTIONS,
  DEPOT_OPTIONS,
  REGION_OPTIONS,
  getCourierStatusMeta,
  getDayOffLabel,
} from "../../constants/courierOptions.js";

const fieldStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border-soft)",
  background: "var(--surface-card)",
  color: "var(--text-primary)",
  padding: "12px 14px",
  outline: "none",
};

const dropdownOptionStyle = {
  background: "var(--auth-panel-bg)",
  color: "var(--text-primary)",
};

const APPROVED_COURIERS_PAGE_SIZE = 8;

function formatContractDate(value) {
  if (!value) return "Non définie";

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("fr-TN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getErrorMessage(err, fallback = "Erreur serveur.") {
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || JSON.stringify(item))
      .join(" | ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || JSON.stringify(detail);
  }

  return err?.message || fallback;
}

function getLocalDateInputValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeContractDate(value) {
  const date = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function isContractEndReached(value) {
  const contractDate = normalizeContractDate(value);
  return Boolean(contractDate && contractDate <= getLocalDateInputValue());
}

function isFutureContractDate(value) {
  const contractDate = normalizeContractDate(value);
  return Boolean(contractDate && contractDate > getLocalDateInputValue());
}

function getEffectiveCourierStatus(courier) {
  if (isContractEndReached(courier.contract_end_date)) {
    return "contract_ended";
  }

  return courier.courier_status || courier.manual_courier_status || "active";
}

function getEditableCourierStatus(courier) {
  if (isContractEndReached(courier.contract_end_date)) {
    return "contract_ended";
  }

  const status = courier.manual_courier_status || courier.courier_status || "active";
  return status === "day_off" ? "active" : status;
}

function needsRenewalContractDate(courier, nextStatus) {
  return Boolean(
    courier &&
      nextStatus !== "contract_ended" &&
      getEffectiveCourierStatus(courier) === "contract_ended"
  );
}

function isCourierAvailable(courier) {
  return (
    getEffectiveCourierStatus(courier) === "active" &&
    courier.is_active !== false
  );
}

function depotDisplayLabel(depot) {
  if (depot === "kairouan") return "Dépôt Kairouan";
  if (depot === "sousse") return "Dépôt Sousse";
  return depot || "Non assigné";
}

export default function LivreursApproved() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [editTarget, setEditTarget] = useState(null);
  const [editMode, setEditMode] = useState(null);

  const [editForm, setEditForm] = useState({
    assigned_region: REGION_OPTIONS[0],
    assigned_depot: DEPOT_OPTIONS[0],
    courier_status: "active",
    contract_end_date: "",
    new_contract_end_date: "",
    day_off: DAY_OFF_OPTIONS[0].value,
  });

  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setMsg("");
    setLoading(true);

    try {
      const res = await api.get("/admin/couriers/approved");
      setItems(res.data || []);
    } catch (err) {
      const status = err?.response?.status;

      if (status === 401) {
        setMsg("Session expirée. Reconnecte-toi en admin.");
      } else if (status === 403) {
        setMsg("Accès refusé : tu n'es pas admin.");
      } else {
        setMsg(getErrorMessage(err, "Erreur chargement des livreurs approuvés."));
      }
    } finally {
      setLoading(false);
    }
  }

  function openRegionModal(courier) {
    setEditTarget(courier);
    setEditMode("region");
    setEditError("");

    setEditForm({
      assigned_region: courier.assigned_region || REGION_OPTIONS[0],
      assigned_depot: courier.assigned_depot || DEPOT_OPTIONS[0],
      courier_status: getEditableCourierStatus(courier),
      contract_end_date: courier.contract_end_date || "",
      new_contract_end_date: "",
      day_off: courier.day_off || DAY_OFF_OPTIONS[0].value,
    });
  }

  function openStatusModal(courier) {
    setEditTarget(courier);
    setEditMode("status");
    setEditError("");

    setEditForm({
      assigned_region: courier.assigned_region || REGION_OPTIONS[0],
      assigned_depot: courier.assigned_depot || DEPOT_OPTIONS[0],
      courier_status: getEditableCourierStatus(courier),
      contract_end_date: courier.contract_end_date || "",
      new_contract_end_date: "",
      day_off: courier.day_off || DAY_OFF_OPTIONS[0].value,
    });
  }

  function closeEditModal() {
    if (savingEdit) return;

    setEditTarget(null);
    setEditMode(null);
    setEditError("");
  }

  async function saveCourierChanges() {
    if (!editTarget || !editMode) return;

    const mustRenewContract =
      editMode === "status" &&
      needsRenewalContractDate(editTarget, editForm.courier_status);

    if (mustRenewContract && !isFutureContractDate(editForm.new_contract_end_date)) {
      setEditError(
        "Choisis une nouvelle date de fin de contrat future avant d'enregistrer."
      );
      return;
    }

    setSavingEdit(true);
    setMsg("");
    setEditError("");

    try {
      const payload =
        editMode === "region"
          ? {
              assigned_region: editForm.assigned_region,
              assigned_depot: editForm.assigned_depot,
              day_off: editForm.day_off,
            }
          : {
              courier_status: editForm.courier_status,
              ...(mustRenewContract
                ? { contract_end_date: editForm.new_contract_end_date }
                : {}),
            };

      await api.patch(`/admin/couriers/${editTarget.id}`, {
        ...payload,
      });

      setEditTarget(null);
      setEditMode(null);

      await load();
    } catch (err) {
      setEditError(getErrorMessage(err, "Erreur mise à jour."));
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove(id) {
    if (!confirm("Supprimer ce livreur ?")) return;

    setMsg("");

    try {
      await api.delete(`/admin/couriers/${id}`);
      await load();
    } catch (err) {
      setMsg(getErrorMessage(err, "Erreur suppression."));
    }
  }

  function handleSearchChange(event) {
    setSearch(event.target.value);
    setCurrentPage(1);
  }

  function handleAvailabilityFilterChange(event) {
    setAvailabilityFilter(event.target.value);
    setCurrentPage(1);
  }

  useEffect(() => {
    load();
  }, []);

  const normalizedSearch = normalizeSearchValue(search);
  const renewalMinDate = getLocalDateInputValue(1);

  const availableCount = items.filter(isCourierAvailable).length;
  const unavailableCount = items.length - availableCount;

  const filteredItems = items.filter((courier) => {
    const matchesSearch =
      !normalizedSearch ||
      [courier.name, courier.email, courier.phone].some((value) =>
        normalizeSearchValue(value).includes(normalizedSearch)
      ) ||
      [courier.assigned_region, courier.assigned_depot].some((value) =>
        normalizeSearchValue(value).includes(normalizedSearch)
      ) ||
      normalizeSearchValue(getDayOffLabel(courier.day_off)).includes(
        normalizedSearch
      );

    if (availabilityFilter === "available") {
      return matchesSearch && isCourierAvailable(courier);
    }

    if (availabilityFilter === "unavailable") {
      return matchesSearch && !isCourierAvailable(courier);
    }

    return matchesSearch;
  });

  const pageCount = Math.max(
    1,
    Math.ceil(filteredItems.length / APPROVED_COURIERS_PAGE_SIZE)
  );
  const safePage = Math.min(currentPage, pageCount);
  const pageStart =
    filteredItems.length === 0
      ? 0
      : (safePage - 1) * APPROVED_COURIERS_PAGE_SIZE + 1;
  const pageEnd = Math.min(
    safePage * APPROVED_COURIERS_PAGE_SIZE,
    filteredItems.length
  );
  const paginatedItems = filteredItems.slice(
    (safePage - 1) * APPROVED_COURIERS_PAGE_SIZE,
    safePage * APPROVED_COURIERS_PAGE_SIZE
  );
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div style={{ padding: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          padding: 14,
          borderRadius: 18,
          border: "1px solid var(--border-soft)",
          background:
            "radial-gradient(900px 280px at 85% -30%, rgba(44,203,118,.20), transparent 60%), rgba(255,255,255,.04)",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: 0.2 }}>
            Livreurs approuvés
          </div>

          <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4 }}>
            Gère la région, le dépôt, le jour de repos et le statut des livreurs approuvés.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="courierApprovedButton courierApprovedButtonNeutral"
            onClick={() => navigate("/admin/livreurs")}
            type="button"
            style={{
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 900,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-card)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            Retour demandes
          </button>

          <button
            className="courierApprovedButton courierApprovedButtonNeutral"
            onClick={load}
            disabled={loading}
            type="button"
            style={{
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 900,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-card)",
              color: "var(--text-primary)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Chargement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          className="courierApprovedField"
          value={search}
          onChange={handleSearchChange}
          placeholder="Rechercher par email, numéro, région ou dépôt..."
          aria-label="Rechercher un livreur approuve"
          style={{ ...fieldStyle, flex: "1 1 280px", minWidth: 220 }}
        />

        <select
          className="courierApprovedField courierApprovedSelect"
          value={availabilityFilter}
          onChange={handleAvailabilityFilterChange}
          aria-label="Filtrer les livreurs approuves"
          style={{ ...fieldStyle, width: 220 }}
        >
          <option value="all" style={dropdownOptionStyle}>
            Tous les livreurs
          </option>
          <option value="available" style={dropdownOptionStyle}>
            Disponibles
          </option>
          <option value="unavailable" style={dropdownOptionStyle}>
            Non disponibles
          </option>
        </select>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--border-soft)",
            background: "var(--surface-card)",
            color: "var(--text-secondary)",
            fontSize: 12,
            minWidth: 220,
          }}
        >
          {filteredItems.length} résultat(s) • {availableCount} disponibles •{" "}
          {unavailableCount} non disponibles
        </div>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 16,
            border: "1px solid var(--danger-border)",
            background: "var(--danger-bg)",
          }}
        >
          <div style={{ fontWeight: 800 }}>{msg}</div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div style={{ opacity: 0.85 }}>Chargement...</div>
        ) : items.length === 0 ? (
          <EmptyBox text="Aucun livreur approuvé." />
        ) : filteredItems.length === 0 ? (
          <EmptyBox text="Aucun livreur ne correspond à cette recherche." />
        ) : (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              {paginatedItems.map((u) => {
              const effectiveStatus = getEffectiveCourierStatus(u);
              const statusMeta = getCourierStatusMeta(effectiveStatus);

              const accessLabel = isCourierAvailable(u)
                ? "Disponible"
                : effectiveStatus === "temporary_leave"
                ? "Non disponible - en pause"
                : effectiveStatus === "day_off"
                ? "Non disponible - jour de repos"
                : effectiveStatus === "contract_ended"
                ? "Non disponible - contrat termine"
                : "Non disponible - compte bloque";

              return (
                <div
                  className="courierApprovedCard"
                  key={u.id}
                  style={{
                    borderRadius: 18,
                    border: "1px solid var(--border-soft)",
                    background:
                      "linear-gradient(180deg, var(--surface-card), var(--surface-inset))",
                    padding: 14,
                    boxShadow: "var(--shadow-soft)",
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: 950, fontSize: 16 }}>
                        {u.name}
                      </div>

                      <Badge
                        label={statusMeta.label}
                        color={statusMeta.color}
                        bg={statusMeta.bg}
                        border={statusMeta.border}
                      />

                      <Badge
                        label={u.assigned_region || "Région non assignée"}
                        color="#9bc0ff"
                        bg="var(--accent-bg)"
                        border="var(--accent-border)"
                      />

                      <Badge
                        label={`Dépôt: ${depotDisplayLabel(u.assigned_depot)}`}
                        color="#4ecdc4"
                        bg="rgba(78,205,196,.12)"
                        border="rgba(78,205,196,.35)"
                      />

                      <Badge
                        label={`Repos: ${getDayOffLabel(u.day_off)}`}
                        color="#f59e0b"
                        bg="rgba(245,158,11,.12)"
                        border="rgba(245,158,11,.35)"
                      />
                    </div>

                    <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>
                        {u.email}
                      </div>

                      <div style={{ opacity: 0.85, fontSize: 13 }}>
                        {u.phone || "-"}
                      </div>

                      <div style={{ opacity: 0.72, fontSize: 12 }}>
                        Fin de contrat: {formatContractDate(u.contract_end_date)}
                      </div>

                      <div style={{ opacity: 0.72, fontSize: 12 }}>
                        Jour de repos: {getDayOffLabel(u.day_off)}
                      </div>

                      <div style={{ opacity: 0.64, fontSize: 12 }}>
                        {accessLabel}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      className="courierApprovedButton courierApprovedButtonTeal"
                      type="button"
                      onClick={() => openRegionModal(u)}
                      style={{
                        borderRadius: 14,
                        border: "1px solid rgba(78,205,196,.35)",
                        background: "rgba(78,205,196,.12)",
                        color: "var(--text-primary)",
                        padding: "10px 14px",
                        fontWeight: 950,
                        cursor: "pointer",
                        minWidth: 150,
                      }}
                    >
                      Modifier affectation
                    </button>

                    <button
                      className="courierApprovedButton courierApprovedButtonAccent"
                      type="button"
                      onClick={() => openStatusModal(u)}
                      style={{
                        borderRadius: 14,
                        border: "1px solid var(--accent-border)",
                        background: "var(--accent-bg)",
                        color: "var(--text-primary)",
                        padding: "10px 14px",
                        fontWeight: 950,
                        cursor: "pointer",
                        minWidth: 150,
                      }}
                    >
                      Modifier statut
                    </button>

                    <button
                      className="courierApprovedButton courierApprovedButtonDanger"
                      type="button"
                      onClick={() => remove(u.id)}
                      style={{
                        borderRadius: 14,
                        border: "1px solid var(--danger-border)",
                        background: "rgba(255,95,95,.12)",
                        color: "var(--text-primary)",
                        padding: "10px 14px",
                        fontWeight: 950,
                        cursor: "pointer",
                        minWidth: 120,
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
              })}
            </div>

            {pageCount > 1 && (
              <div className="admPagination courierApprovedPagination">
                <div className="admPaginationInfo">
                  Affichage {pageStart}-{pageEnd} sur {filteredItems.length}
                </div>

                <div
                  className="admPaginationBtns"
                  aria-label="Pagination livreurs approuves"
                >
                  <button
                    type="button"
                    className="admPageBtn courierApprovedPageButton"
                    onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                  >
                    Precedent
                  </button>

                  {pages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={`admPageBtn courierApprovedPageButton ${
                        safePage === page ? "isActive" : ""
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="admPageBtn courierApprovedPageButton"
                    onClick={() =>
                      setCurrentPage(Math.min(pageCount, safePage + 1))
                    }
                    disabled={safePage === pageCount}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editTarget && (
        <div
          className="courierApprovedModalBackdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            zIndex: 100,
          }}
        >
          <div
            className="courierApprovedModalPanel"
            style={{
              width: "min(560px, 92vw)",
              background: "var(--auth-panel-bg)",
              border: "1px solid var(--border-soft)",
              borderRadius: 18,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900 }}>
              {editMode === "region"
                ? "Modifier l'affectation"
                : "Modifier le statut"}
            </div>

            <div style={{ marginTop: 6, opacity: 0.74, fontSize: 13 }}>
              {editMode === "region" ? (
                <>
                  Mets à jour la région, le dépôt et le jour de repos de{" "}
                  <strong>{editTarget.name}</strong>.
                </>
              ) : (
                <>
                  Mets à jour le statut de <strong>{editTarget.name}</strong>.
                  La date de fin de contrat reste fixe.
                </>
              )}
            </div>

            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              {editError && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--danger-border)",
                    background: "var(--danger-bg)",
                    fontWeight: 800,
                  }}
                >
                  {editError}
                </div>
              )}

              {editMode === "region" ? (
                <>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        marginBottom: 6,
                      }}
                    >
                      Région assignée
                    </div>

                    <select
                      className="courierApprovedField courierApprovedSelect"
                      value={editForm.assigned_region}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          assigned_region: e.target.value,
                        }))
                      }
                      style={fieldStyle}
                    >
                      {REGION_OPTIONS.map((region) => (
                        <option
                          key={region}
                          value={region}
                          style={dropdownOptionStyle}
                        >
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        marginBottom: 6,
                      }}
                    >
                      Dépôt de travail
                    </div>

                    <select
                      className="courierApprovedField courierApprovedSelect"
                      value={editForm.assigned_depot}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          assigned_depot: e.target.value,
                        }))
                      }
                      style={fieldStyle}
                    >
                      {DEPOT_OPTIONS.map((depot) => (
                        <option
                          key={depot}
                          value={depot}
                          style={dropdownOptionStyle}
                        >
                          {depotDisplayLabel(depot)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        marginBottom: 6,
                      }}
                    >
                      Jour de repos
                    </div>

                    <select
                      className="courierApprovedField courierApprovedSelect"
                      value={editForm.day_off}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          day_off: e.target.value,
                        }))
                      }
                      style={fieldStyle}
                    >
                      {DAY_OFF_OPTIONS.map((day) => (
                        <option
                          key={day.value}
                          value={day.value}
                          style={dropdownOptionStyle}
                        >
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        marginBottom: 6,
                      }}
                    >
                      Statut du livreur
                    </div>

                    <select
                      className="courierApprovedField courierApprovedSelect"
                      value={editForm.courier_status}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          courier_status: e.target.value,
                          new_contract_end_date:
                            e.target.value === "contract_ended"
                              ? ""
                              : prev.new_contract_end_date,
                        }))
                      }
                      style={fieldStyle}
                    >
                      {COURIER_STATUS_OPTIONS.map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                          style={dropdownOptionStyle}
                        >
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--border-soft)",
                      background: "var(--surface-card)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.75,
                        marginBottom: 6,
                      }}
                    >
                      Fin de contrat fixée
                    </div>

                    <div
                      style={{
                        fontWeight: 800,
                        color: "var(--text-primary)",
                      }}
                    >
                      {formatContractDate(editTarget.contract_end_date)}
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                      À cette date, le statut passera automatiquement à Contrat
                      terminé.
                    </div>
                  </div>

                  {needsRenewalContractDate(
                    editTarget,
                    editForm.courier_status
                  ) && (
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.75,
                          marginBottom: 6,
                        }}
                      >
                        Nouvelle fin de contrat
                      </div>

                      <input
                        className="courierApprovedField"
                        type="date"
                        value={editForm.new_contract_end_date}
                        min={renewalMinDate}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            new_contract_end_date: e.target.value,
                          }))
                        }
                        style={fieldStyle}
                      />

                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
                        Requis pour renouveler le contrat et sortir de Contrat
                        terminé.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 18,
                justifyContent: "flex-end",
              }}
            >
              <button
                className="courierApprovedButton courierApprovedButtonNeutral"
                type="button"
                onClick={closeEditModal}
                style={{
                  borderRadius: 12,
                  padding: "10px 14px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-card)",
                  color: "var(--text-primary)",
                  cursor: savingEdit ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  opacity: savingEdit ? 0.6 : 1,
                }}
              >
                Annuler
              </button>

              <button
                className="courierApprovedButton courierApprovedButtonAccent"
                type="button"
                disabled={savingEdit}
                onClick={saveCourierChanges}
                style={{
                  borderRadius: 12,
                  padding: "10px 14px",
                  border: "1px solid var(--accent-border)",
                  background: "var(--accent-bg)",
                  color: "var(--text-primary)",
                  cursor: savingEdit ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  opacity: savingEdit ? 0.7 : 1,
                }}
              >
                {savingEdit ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ label, color, bg, border }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 900,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  );
}

function EmptyBox({ text }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        border: "1px solid var(--border-soft)",
        background: "var(--surface-panel-soft)",
        opacity: 0.9,
      }}
    >
      {text}
    </div>
  );
}
