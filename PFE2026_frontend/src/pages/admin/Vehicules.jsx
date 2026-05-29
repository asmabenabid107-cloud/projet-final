import { useEffect, useRef, useState } from "react";

import {
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle,
} from "../../api/vehicleService";

const STATUS_META = {
  actif: { label: "Actif", bg: "var(--success-bg)", color: "var(--success)" },
  inactif: { label: "Inactif", bg: "var(--danger-bg)", color: "var(--danger)" },
  maintenance: {
    label: "En maintenance",
    bg: "var(--warning-bg)",
    color: "var(--warning)",
  },
};

const STATUS_OPTIONS = [
  { value: "actif", label: "Actif - disponible" },
  { value: "inactif", label: "Inactif - hors service" },
  { value: "maintenance", label: "En maintenance" },
];

const DEFAULT_MIN_WEIGHT = 20;
const DEFAULT_MAX_WEIGHT = 40;
const VEHICLE_PAGE_SIZE = 9;
const MATRICULE_PATTERN = /^\d{1,3}\s+[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2}\s+\d{3,4}$/i;

const EMPTY_FORM = {
  name: "",
  matricule: "",
  status: "actif",
  min_length: "20",
  max_length: "40",
};

const normalizeText = (value) => value.replace(/\s+/g, " ").trim();

const normalizeMatricule = (value) =>
  normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? part : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`))
    .join(" ");

const formatApiError = (requestError) => {
  const detail = requestError?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") return item.msg || item.message || JSON.stringify(item);
        return null;
      })
      .filter(Boolean)
      .join(" ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || "Erreur serveur";
  }

  return requestError?.message || "Erreur serveur";
};

const fieldStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border-soft)",
  background: "var(--input-bg-strong)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isVehicleAvailable(vehicle) {
  return vehicle?.status === "actif";
}

function getPaginationPages(currentPage, pageCount) {
  const pages = new Set([1, pageCount, currentPage]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= pageCount) {
      pages.add(page);
    }
  }

  return Array.from(pages)
    .sort((a, b) => a - b)
    .reduce((items, page, index, sortedPages) => {
      if (index > 0 && page - sortedPages[index - 1] > 1) {
        items.push(`gap-${sortedPages[index - 1]}-${page}`);
      }
      items.push(page);
      return items;
    }, []);
}

export default function Vehicules() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getVehicles();
      setVehicles(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, availabilityFilter]);

  useEffect(() => {
    if (!statusMenuOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!statusMenuRef.current?.contains(event.target)) {
        setStatusMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [statusMenuOpen]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setStatusMenuOpen(false);
    setModal(true);
  };

  const openEdit = (vehicle) => {
    setEditing(vehicle);
    setForm({
      name: vehicle.name ?? "",
      matricule: vehicle.matricule ?? "",
      status: vehicle.status ?? "actif",
      min_length: vehicle.min_length ?? DEFAULT_MIN_WEIGHT,
      max_length: vehicle.max_length ?? DEFAULT_MAX_WEIGHT,
    });
    setError("");
    setStatusMenuOpen(false);
    setModal(true);
  };

  const normalizedMatricule = normalizeMatricule(form.matricule);
  const hasMatriculeInput = normalizedMatricule.length > 0;
  const matriculeOk = hasMatriculeInput && MATRICULE_PATTERN.test(normalizedMatricule);
  const normalizedSearch = normalizeSearchValue(search);
  const availableCount = vehicles.filter(isVehicleAvailable).length;
  const unavailableCount = vehicles.length - availableCount;
  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      !normalizedSearch ||
      [vehicle.name, vehicle.matricule].some((value) =>
        normalizeSearchValue(value).includes(normalizedSearch),
      );

    if (availabilityFilter === "available") return matchesSearch && isVehicleAvailable(vehicle);
    if (availabilityFilter === "unavailable") return matchesSearch && !isVehicleAvailable(vehicle);
    return matchesSearch;
  });
  const pageCount = Math.max(1, Math.ceil(filteredVehicles.length / VEHICLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = filteredVehicles.length === 0 ? 0 : (safePage - 1) * VEHICLE_PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * VEHICLE_PAGE_SIZE, filteredVehicles.length);
  const paginatedVehicles = filteredVehicles.slice(
    (safePage - 1) * VEHICLE_PAGE_SIZE,
    safePage * VEHICLE_PAGE_SIZE,
  );
  const paginationPages = getPaginationPages(safePage, pageCount);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const handleSubmit = async () => {
  const minWeight = Number(form.min_length) || DEFAULT_MIN_WEIGHT;
  const maxWeight = Number(form.max_length) || DEFAULT_MAX_WEIGHT;

  if (maxWeight < minWeight) {
    setError("Le poids max doit etre superieur ou egal au poids min.");
    return;
  }

  if (!normalizedMatricule) {
    setError("Le matricule est obligatoire.");
    return;
  }

  if (!matriculeOk) {
    setError("Le matricule doit suivre le format 123 Tunis 4567.");
    return;
  }

  setSaving(true);

  try {
    const payload = {
      ...form,
      name: form.name.trim() || null,
      matricule: normalizedMatricule,
      min_length: minWeight,
      max_length: maxWeight,
    };

    if (editing) {
      await updateVehicle(editing.id, payload);
    } else {
      await createVehicle(payload);
    }

    setModal(false);
    await load();
  } catch (requestError) {
    setError(formatApiError(requestError));
  } finally {
    setSaving(false);
  }
};

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce vehicule ?")) return;
    await deleteVehicle(id);
    await load();
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.4rem",
              fontWeight: 900,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Vehicules
          </h1>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              margin: "4px 0 0",
            }}
          >
            Gestion du parc automobile, des plaques et des capacites de charge
          </p>
        </div>

        <button
          onClick={openCreate}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            background: "var(--accent-bg)",
            color: "var(--text-primary)",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "0.9rem",
            border: "1px solid var(--accent-border)",
          }}
        >
          + Nouveau vehicule
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher par matricule ou nom..."
          style={{ ...fieldStyle, flex: "1 1 280px", minWidth: 220 }}
        />

        <select
          className="vehicleSelect"
          value={availabilityFilter}
          onChange={(event) => setAvailabilityFilter(event.target.value)}
          style={{ ...fieldStyle, width: 220 }}
        >
          <option value="all">Tous les vehicules</option>
          <option value="available">Disponibles</option>
          <option value="unavailable">Non disponibles</option>
        </select>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border-soft)",
            background: "var(--surface-panel-faint)",
            color: "var(--text-secondary)",
            fontSize: 12,
            minWidth: 220,
          }}
        >
          {filteredVehicles.length} resultat(s) • {availableCount} disponibles • {unavailableCount} non disponibles
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Chargement...</p>
      ) : vehicles.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            border: "1px dashed var(--border-subtle)",
            borderRadius: 16,
            color: "var(--text-secondary)",
            background: "var(--surface-panel-faint)",
          }}
        >
          Aucun vehicule enregistre
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            border: "1px dashed var(--border-subtle)",
            borderRadius: 16,
            color: "var(--text-secondary)",
            background: "var(--surface-panel-faint)",
          }}
        >
          Aucun vehicule ne correspond a cette recherche
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {paginatedVehicles.map((vehicle) => {
            const statusMeta = STATUS_META[vehicle.status] || STATUS_META.inactif;

            return (
              <div
                key={vehicle.id}
                style={{
                  background: "var(--surface-panel-faint)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 16,
                  padding: 18,
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "var(--text-secondary)",
                    }}
                  >
                    VEH-{String(vehicle.id).padStart(3, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: statusMeta.bg,
                      color: statusMeta.color,
                      fontWeight: 700,
                    }}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    marginBottom: 4,
                  }}
                >
                  {vehicle.name || "Vehicule sans nom"}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginBottom: 10,
                    wordBreak: "break-word",
                  }}
                >
                  {vehicle.matricule}
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    Nom du vehicule:{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {vehicle.name || "-"}
                    </strong>
                  </div>
                  <div>
                    Capacite:{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {vehicle.min_length ?? DEFAULT_MIN_WEIGHT} kg
                    </strong>{" "}
                    a{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {vehicle.max_length ?? DEFAULT_MAX_WEIGHT} kg
                    </strong>
                  </div>
                  <div>
                    Ajoute le{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {new Date(vehicle.created_at).toLocaleDateString("fr-FR")}
                    </strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => openEdit(vehicle)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      fontSize: 12,
                      borderRadius: 10,
                      border: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      background: "var(--surface-panel-faint)",
                      color: "var(--text-primary)",
                      fontWeight: 700,
                    }}
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(vehicle.id)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      fontSize: 12,
                      borderRadius: 10,
                      border: "1px solid var(--danger-border)",
                      cursor: "pointer",
                      background: "var(--danger-bg)",
                      color: "var(--danger)",
                      fontWeight: 700,
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
            })}
          </div>

          {filteredVehicles.length > VEHICLE_PAGE_SIZE && (
            <div className="admPagination vehiclePagination">
              <div className="admPaginationInfo">
                Affichage {pageStart}-{pageEnd} sur {filteredVehicles.length}
              </div>
              <div className="admPaginationBtns" aria-label="Pagination vehicules">
                <button
                  className="admPageBtn vehiclePageButton"
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Prec.
                </button>
                {paginationPages.map((item) =>
                  typeof item === "number" ? (
                    <button
                      key={item}
                      className={`admPageBtn vehiclePageButton ${safePage === item ? "isActive" : ""}`}
                      type="button"
                      aria-current={safePage === item ? "page" : undefined}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  ) : (
                    <span className="vehiclePaginationGap" key={item} aria-hidden="true">
                      ...
                    </span>
                  ),
                )}
                <button
                  className="admPageBtn vehiclePageButton"
                  type="button"
                  disabled={safePage === pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  Suiv.
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {modal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 18,
          }}
        >
          <div
            style={{
              background: "var(--sidebar-bg)",
              borderRadius: 22,
              padding: 28,
              width: "min(520px, 100%)",
              border: "1px solid var(--border-soft)",
              boxShadow: "var(--shadow-strong)",
              backdropFilter: "blur(18px)",
            }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 900,
                margin: "0 0 6px",
                color: "var(--text-primary)",
              }}
            >
              {editing ? "Modifier le vehicule" : "Nouveau vehicule"}
            </h2>
            <p
              style={{
                margin: "0 0 20px",
                color: "var(--text-secondary)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Exemple de matricule: 241 Tunis 8542. Les champs de poids indiquent la charge minimale et maximale supportee.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Nom du vehicule
                </label>
                <input
                  className="vehicleInput"
                  value={form.name}
                  onChange={(event) => {
                    setForm({ ...form, name: event.target.value });
                    setError("");
                  }}
                  placeholder="Ex. Iveco Daily"
                  style={fieldStyle}
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  ID (auto-genere)
                </label>
                <input
                  readOnly
                  value={editing ? `VEH-${String(editing.id).padStart(3, "0")}` : "-- auto --"}
                  style={{
                    ...fieldStyle,
                    color: "var(--text-secondary)",
                    cursor: "not-allowed",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Poids min (kg)
                  </label>
                 <input
  className="vehicleInput"
  type="number"
  min={1}
  value={form.min_length}
  onChange={(event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      min_length: value,
      max_length: prev.max_length === "" ? value : prev.max_length,
    }));
    setError("");
  }}
  style={fieldStyle}
/>
                </div>

                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Poids max (kg)
                  </label>
                 <input
  className="vehicleInput"
  type="number"
  min={Number(form.min_length) || 1}
  max={5000}
  value={form.max_length}
  onChange={(event) => {
    setForm((prev) => ({
      ...prev,
      max_length: event.target.value,
    }));
    setError("");
  }}
  style={fieldStyle}
/>
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Matricule
                </label>
                <input
                  className="vehicleInput"
                  value={form.matricule}
                  onChange={(event) => {
                    setForm({ ...form, matricule: event.target.value });
                    setError("");
                  }}
                  onBlur={() => {
                    setForm((current) => ({ ...current, matricule: normalizeMatricule(current.matricule) }));
                  }}
                  placeholder="Ex. 241 Tunis 8542"
                  style={{
                    ...fieldStyle,
                    borderColor:
                      !hasMatriculeInput
                        ? "var(--border-soft)"
                        : matriculeOk
                          ? "var(--success-border)"
                          : "var(--danger-border)",
                  }}
                />
                <div
                  style={{
                    fontSize: 11,
                    marginTop: 6,
                    color:
                      !hasMatriculeInput
                        ? "var(--text-secondary)"
                        : matriculeOk
                          ? "var(--success)"
                          : "var(--danger)",
                  }}
                >
                  {!hasMatriculeInput
                    ? "Format attendu: 123 Tunis 4567"
                    : matriculeOk
                      ? `Format valide: ${normalizedMatricule}`
                      : "Format invalide. Exemple: 123 Tunis 4567"}
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Statut
                </label>
                <div
                  ref={statusMenuRef}
                  style={{ position: "relative" }}
                >
                  <button
                    type="button"
                    onClick={() => setStatusMenuOpen((value) => !value)}
                    className="vehicleInput"
                    style={{
                      ...fieldStyle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      textAlign: "left",
                      fontWeight: 500,
                    }}
                  >
                    <span>
                      {STATUS_OPTIONS.find((option) => option.value === form.status)?.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        transform: statusMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 180ms ease",
                      }}
                    >
                      ▼
                    </span>
                  </button>

                  {statusMenuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        borderRadius: 12,
                        border: "1px solid var(--border-soft)",
                        background: "var(--auth-panel-bg)",
                        boxShadow: "var(--shadow-strong)",
                        overflow: "hidden",
                        backdropFilter: "blur(14px)",
                      }}
                    >
                      {STATUS_OPTIONS.map((option) => {
                        const isActive = option.value === form.status;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setForm({ ...form, status: option.value });
                              setStatusMenuOpen(false);
                            }}
                            style={{
                              width: "100%",
                              border: "none",
                              borderRadius: 0,
                              padding: "12px 14px",
                              textAlign: "left",
                              background: isActive
                                ? "var(--accent-bg)"
                                : "var(--surface-card)",
                              color: isActive
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                              borderBottom:
                                option.value === STATUS_OPTIONS[STATUS_OPTIONS.length - 1].value
                                  ? "none"
                                  : "1px solid var(--border-subtle)",
                              fontWeight: isActive ? 700 : 500,
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--danger)",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "var(--danger-bg)",
                    border: "1px solid var(--danger-border)",
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => setModal(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    border: "1px solid var(--border-soft)",
                    background: "var(--surface-panel-faint)",
                    color: "var(--text-primary)",
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    border: "1px solid var(--accent-border)",
                    background: "var(--accent-bg)",
                    color: "var(--text-primary)",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "..." : editing ? "Enregistrer" : "Creer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
