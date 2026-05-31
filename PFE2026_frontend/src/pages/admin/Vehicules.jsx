import { useEffect, useRef, useState } from "react";
import {
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle,
} from "../../api/vehicleService";

// ─── Constants ─────────────────────────────────────────────────────────────

const STATUS_META = {
  actif:       { label: "Actif",       dot: "#22d3ee", bg: "rgba(34,211,238,0.10)",  color: "#22d3ee",  border: "rgba(34,211,238,0.25)" },
  inactif:     { label: "Inactif",     dot: "#f87171", bg: "rgba(248,113,113,0.10)", color: "#f87171",  border: "rgba(248,113,113,0.25)" },
  maintenance: { label: "Maintenance", dot: "#fbbf24", bg: "rgba(251,191,36,0.10)",  color: "#fbbf24",  border: "rgba(251,191,36,0.25)" },
};

const STATUS_OPTIONS = [
  { value: "actif",       label: "Actif",       sub: "Disponible pour livraisons" },
  { value: "inactif",     label: "Inactif",     sub: "Hors service" },
  { value: "maintenance", label: "Maintenance", sub: "En cours de révision" },
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

  longueur: "",
  largeur: "",
  hauteur: "",
};
// ─── Helpers ───────────────────────────────────────────────────────────────

const normalizeText = (v) => v.replace(/\s+/g, " ").trim();
const normalizeMatricule = (v) =>
  normalizeText(v).split(" ").filter(Boolean)
    .map((p) => (/^\d+$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ");

const normalizeSearchValue = (v) =>
  String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const isVehicleAvailable = (v) => v?.status === "actif";

const formatApiError = (err) => {
  const d = err?.response?.data?.detail;
  if (typeof d === "string" && d.trim()) return d;
  if (Array.isArray(d) && d.length > 0)
    return d.map((i) => (typeof i === "string" ? i : i?.msg || i?.message || JSON.stringify(i))).filter(Boolean).join(" ");
  if (d && typeof d === "object") return d.msg || d.message || "Erreur serveur";
  return err?.message || "Erreur serveur";
};

function getPaginationPages(cur, total) {
  const pages = new Set([1, total, cur, cur - 1, cur + 1].filter((p) => p >= 1 && p <= total));
  return Array.from(pages).sort((a, b) => a - b).reduce((acc, p, i, arr) => {
    if (i > 0 && p - arr[i - 1] > 1) acc.push(`gap-${arr[i - 1]}-${p}`);
    acc.push(p);
    return acc;
  }, []);
}

// ─── Styles — uses only the app's existing CSS variables ───────────────────
// Light/dark mode is handled automatically since all colours come from
// the theme tokens already defined in the app's global stylesheet.

const css = `
  .veh-root * { box-sizing: border-box; }
  .veh-root { font-family: inherit; }

  /* ── Cards ── */
  .veh-card {
    background: var(--surface-panel-faint);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    transition: border-color 200ms, box-shadow 200ms, transform 200ms;
  }
  .veh-card:hover {
    border-color: var(--accent-border);
    box-shadow: 0 0 0 1px var(--accent-border), 0 8px 32px rgba(0,0,0,0.12);
    transform: translateY(-2px);
  }

  /* ── Inputs ── */
  .veh-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--border-soft);
    background: var(--input-bg-strong);
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 150ms, box-shadow 150ms;
  }
  .veh-input:focus {
    border-color: var(--accent-border);
    box-shadow: 0 0 0 3px rgba(99,179,237,0.12);
  }
  .veh-input::placeholder { color: var(--text-secondary); opacity: 0.6; }

  /* ── Buttons ── */
  .veh-btn-primary {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 20px; border-radius: 11px; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: inherit;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border: 1px solid rgba(99,179,237,0.35);
    color: #fff;
    box-shadow: 0 2px 12px rgba(59,130,246,0.30);
    transition: box-shadow 150ms, transform 100ms;
  }
  .veh-btn-primary:hover { box-shadow: 0 4px 20px rgba(59,130,246,0.45); transform: translateY(-1px); }
  .veh-btn-primary:active { transform: translateY(0); }
  .veh-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

  .veh-btn-ghost {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 9px; cursor: pointer;
    font-size: 12px; font-weight: 600; font-family: inherit;
    background: var(--surface-panel-faint);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    transition: background 150ms, border-color 150ms;
  }
  .veh-btn-ghost:hover { background: var(--surface-card); border-color: var(--border-soft); }

  .veh-btn-danger {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 9px; cursor: pointer;
    font-size: 12px; font-weight: 600; font-family: inherit;
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger);
    transition: opacity 150ms;
  }
  .veh-btn-danger:hover { opacity: 0.8; }

  /* ── Filter chips ── */
  .veh-filter-chip {
    padding: 7px 14px; border-radius: 999px; cursor: pointer;
    font-size: 12px; font-weight: 600; font-family: inherit;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-secondary);
    transition: all 150ms;
  }
  .veh-filter-chip:hover {
    background: var(--surface-panel-faint);
    color: var(--text-primary);
    border-color: var(--border-soft);
  }
  .veh-filter-chip.active {
    background: var(--accent-bg);
    border-color: var(--accent-border);
    color: var(--text-primary);
    font-weight: 700;
  }

  /* ── Pagination ── */
  .veh-page-btn {
    min-width: 34px; height: 34px; border-radius: 8px; cursor: pointer;
    font-size: 13px; font-weight: 600; font-family: inherit;
    border: 1px solid var(--border-subtle);
    background: var(--surface-panel-faint);
    color: var(--text-secondary);
    transition: all 150ms;
  }
  .veh-page-btn:hover:not(:disabled) {
    background: var(--surface-card);
    color: var(--text-primary);
    border-color: var(--border-soft);
  }
  .veh-page-btn.active {
    background: var(--accent-bg);
    border-color: var(--accent-border);
    color: var(--text-primary);
    font-weight: 700;
  }
  .veh-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  /* ── Modal ── */
  .veh-modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: var(--overlay-bg);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: veh-fade-in 150ms ease;
  }
.veh-modal {
  background: var(--sidebar-bg);
  border: 1px solid var(--border-soft);
  border-radius: 20px;
  padding: 32px;
  width: min(620px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: var(--shadow-strong);
  animation: veh-slide-up 200ms ease;
}
.veh-dim-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}

.veh-dim-grid label {
  min-height: 32px;
  line-height: 1.25;
}

.veh-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 9999;
  border-radius: 12px;
  border: 1px solid var(--border-soft);
  background: var(--auth-panel-bg);
  box-shadow: var(--shadow-strong);
  overflow: hidden;
  max-height: 230px;
  overflow-y: auto;
  backdrop-filter: blur(14px);
}

@media (max-width: 620px) {
  .veh-dim-grid {
    grid-template-columns: 1fr;
  }

  .veh-dim-grid label {
    min-height: auto;
  }
}

  /* ── Stat cards ── */
  .veh-stat-card {
    background: var(--surface-panel-faint);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 16px 20px;
    min-width: 110px;
  }

  /* ── Info grid inside vehicle card ── */
  .veh-info-grid {
    background: var(--surface-card);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 12px 14px;
  }

  /* ── Dropdown menu ── */
  .veh-dropdown {
    position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 20;
    border-radius: 12px;
    border: 1px solid var(--border-soft);
    background: var(--auth-panel-bg);
    box-shadow: var(--shadow-strong);
    overflow: hidden;
    backdrop-filter: blur(14px);
  }
  .veh-dropdown-item {
    width: 100%; border: none; border-radius: 0;
    padding: 12px 16px; text-align: left; cursor: pointer;
    background: var(--surface-card);
    transition: background 120ms;
  }
  .veh-dropdown-item:hover { background: var(--surface-panel-faint); }
  .veh-dropdown-item.active { background: var(--accent-bg); }

  /* ── Plate badge ── */
  .veh-plate {
    font-family: monospace;
    font-size: 14px; font-weight: 500;
    letter-spacing: 0.05em;
    color: var(--text-primary);
    background: var(--surface-card);
    border: 1px solid var(--border-subtle);
    border-radius: 7px;
    padding: 4px 10px;
    display: inline-block;
  }

  /* ── Status dot pulse ── */
  .veh-status-dot {
    width: 7px; height: 7px; border-radius: 50%;
    display: inline-block; flex-shrink: 0;
    animation: veh-pulse 2.5s ease-in-out infinite;
  }
  @keyframes veh-pulse { 0%,100% { opacity:1 } 50% { opacity:0.45 } }

  /* ── Close button ── */
  .veh-close-btn {
    background: var(--surface-card);
    border: 1px solid var(--border-subtle);
    border-radius: 8px; width: 32px; height: 32px;
    cursor: pointer; color: var(--text-secondary);
    font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    transition: background 150ms;
  }
  .veh-close-btn:hover { background: var(--surface-panel-faint); color: var(--text-primary); }

  /* ── Divider ── */
  .veh-divider { height: 1px; background: var(--border-subtle); }

  /* ── Search wrapper ── */
  .veh-search-wrap { position: relative; flex: 1 1 280px; min-width: 220px; }
  .veh-search-icon {
    position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
    font-size: 14px; color: var(--text-secondary); pointer-events: none; opacity: 0.6;
  }
  .veh-search-input { padding-left: 36px !important; }

  /* ── Empty state ── */
  .veh-empty {
    text-align: center; padding: 80px 20px;
    border: 1px dashed var(--border-subtle);
    border-radius: 18px;
    color: var(--text-secondary);
    background: var(--surface-panel-faint);
  }

  @keyframes veh-fade-in  { from { opacity: 0 }                       to { opacity: 1 } }
  @keyframes veh-slide-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
`;

// ─── Sub-components ────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.inactif;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
    }}>
      <span className="veh-status-dot" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

function StatCard({ value, label, color }) {
  return (
    <div className="veh-stat-card">
      <div style={{ fontSize: "1.7rem", fontWeight: 900, color: color || "var(--text-primary)", lineHeight: 1, fontFamily: "inherit" }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </div>
    </div>
  );
}

function VehicleCard({ vehicle, onEdit, onDelete }) {
  const dateStr = vehicle.created_at
    ? new Date(vehicle.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <div className="veh-card" style={{ padding: "20px 20px 16px" }}>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>
          VEH-{String(vehicle.id).padStart(3, "0")}
        </span>
        <StatusBadge status={vehicle.status} />
      </div>

      {/* Name */}
      <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 10, lineHeight: 1.2 }}>
        {vehicle.name || "Sans nom"}
      </div>

      {/* Plate */}
      <div style={{ marginBottom: 14 }}>
        <span className="veh-plate">{vehicle.matricule || "—"}</span>
      </div>

      {/* Info grid */}
      <div className="veh-info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 }}>Charge min</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{vehicle.min_length ?? DEFAULT_MIN_WEIGHT} kg</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 }}>Charge max</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{vehicle.max_length ?? DEFAULT_MAX_WEIGHT} kg</div>
        </div>

        <div>
  <div style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 }}>
    Dimensions
  </div>
  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
    {vehicle.longueur && vehicle.largeur && vehicle.hauteur
      ? `${vehicle.longueur} × ${vehicle.largeur} × ${vehicle.hauteur} cm`
      : "Non définies"}
  </div>
</div>

<div>
  <div style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 }}>
    Volume
  </div>
  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
    {formatVolume(vehicle.max_volume)}
  </div>
</div>
        <div style={{ gridColumn: "span 2" }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontWeight: 600 }}>Ajouté le</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{dateStr}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="veh-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => onEdit(vehicle)}>
          ✏ Modifier
        </button>
        <button className="veh-btn-danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => onDelete(vehicle.id)}>
          ✕ Supprimer
        </button>
      </div>
    </div>
  );
}

function ModalField({ label, children }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.07em",
        color: "var(--text-secondary)", marginBottom: 7,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

const toNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const calculateVehicleVolume = (longueur, largeur, hauteur) => {
  const l = toNumberOrNull(longueur);
  const w = toNumberOrNull(largeur);
  const h = toNumberOrNull(hauteur);

  if (!l || !w || !h) return null;
  return l * w * h;
};

const formatVolume = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "Non défini";
  return `${n.toLocaleString("fr-FR")} cm³`;
};


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
    try { const res = await getVehicles(); setVehicles(res.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, availabilityFilter]);
  useEffect(() => {
    if (!statusMenuOpen) return undefined;
    const fn = (e) => { if (!statusMenuRef.current?.contains(e.target)) setStatusMenuOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [statusMenuOpen]);

  const openCreate = () => {
    setEditing(null); setForm(EMPTY_FORM); setError(""); setStatusMenuOpen(false); setModal(true);
  };
  const openEdit = (v) => {
    setEditing(v);
setForm({
  name: v.name ?? "",
  matricule: v.matricule ?? "",
  status: v.status ?? "actif",
  min_length: v.min_length ?? DEFAULT_MIN_WEIGHT,
  max_length: v.max_length ?? DEFAULT_MAX_WEIGHT,

  longueur: v.longueur ?? "",
  largeur: v.largeur ?? "",
  hauteur: v.hauteur ?? "",
});    setError(""); setStatusMenuOpen(false); setModal(true);
  };

  const normalizedMatricule = normalizeMatricule(form.matricule);
  const hasMatriculeInput = normalizedMatricule.length > 0;
  const matriculeOk = hasMatriculeInput && MATRICULE_PATTERN.test(normalizedMatricule);
  const normalizedSearch = normalizeSearchValue(search);
  const availableCount = vehicles.filter(isVehicleAvailable).length;
  const maintenanceCount = vehicles.filter((v) => v.status === "maintenance").length;

  const filteredVehicles = vehicles.filter((v) => {
    const matchSearch = !normalizedSearch || [v.name, v.matricule].some((x) => normalizeSearchValue(x).includes(normalizedSearch));
    if (availabilityFilter === "available") return matchSearch && isVehicleAvailable(v);
    if (availabilityFilter === "unavailable") return matchSearch && !isVehicleAvailable(v);
    return matchSearch;
  });

  const pageCount = Math.max(1, Math.ceil(filteredVehicles.length / VEHICLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = filteredVehicles.length === 0 ? 0 : (safePage - 1) * VEHICLE_PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * VEHICLE_PAGE_SIZE, filteredVehicles.length);
  const paginatedVehicles = filteredVehicles.slice((safePage - 1) * VEHICLE_PAGE_SIZE, safePage * VEHICLE_PAGE_SIZE);
  const paginationPages = getPaginationPages(safePage, pageCount);

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const handleSubmit = async () => {
    const minW = Number(form.min_length) || DEFAULT_MIN_WEIGHT;
    const maxW = Number(form.max_length) || DEFAULT_MAX_WEIGHT;
    if (maxW < minW) { setError("Le poids max doit être ≥ au poids min."); return; }
    if (!normalizedMatricule) { setError("Le matricule est obligatoire."); return; }
    if (!matriculeOk) { setError("Format invalide. Ex: 241 Tunis 8542"); return; }
    setSaving(true);
    try {
const longueur = toNumberOrNull(form.longueur);
const largeur = toNumberOrNull(form.largeur);
const hauteur = toNumberOrNull(form.hauteur);
const maxVolume = calculateVehicleVolume(longueur, largeur, hauteur);

const payload = {
  ...form,
  name: form.name.trim() || null,
  matricule: normalizedMatricule,
  min_length: minW,
  max_length: maxW,

  longueur,
  largeur,
  hauteur,
  max_volume: maxVolume,
};

if (editing) await updateVehicle(editing.id, payload);
      else await createVehicle(payload);
      setModal(false);
      await load();
    } catch (e) { setError(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce véhicule ?")) return;
    await deleteVehicle(id);
    await load();
  };

  return (
    <div className="veh-root">
      <style>{css}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>🚛</span>
            <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Parc véhicules
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Gestion du parc automobile · plaques · capacités de charge
          </p>
        </div>
        <button className="veh-btn-primary" onClick={openCreate}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Nouveau véhicule
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard value={vehicles.length}                        label="Total" />
        <StatCard value={availableCount}                         label="Disponibles"  color="#22d3ee" />
        <StatCard value={vehicles.length - availableCount}       label="Non dispo."   color="#f87171" />
        <StatCard value={maintenanceCount}                       label="Maintenance"  color="#fbbf24" />
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <div className="veh-search-wrap">
          <span className="veh-search-icon">🔍</span>
          <input
            className="veh-input veh-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par matricule ou nom…"
          />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["all", "Tous"], ["available", "Disponibles"], ["unavailable", "Non dispo."]].map(([val, lbl]) => (
            <button
              key={val}
              className={`veh-filter-chip${availabilityFilter === val ? " active" : ""}`}
              onClick={() => setAvailabilityFilter(val)}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div style={{
          fontSize: 12, color: "var(--text-secondary)",
          padding: "7px 12px",
          background: "var(--surface-panel-faint)",
          borderRadius: 8, border: "1px solid var(--border-subtle)",
          whiteSpace: "nowrap",
        }}>
          {filteredVehicles.length} résultat{filteredVehicles.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)", padding: "40px 0", textAlign: "center" }}>Chargement…</p>
      ) : vehicles.length === 0 ? (
        <div className="veh-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚛</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Aucun véhicule enregistré</div>
          <div style={{ fontSize: 13 }}>Ajoutez votre premier véhicule pour commencer</div>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="veh-empty">
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 700 }}>Aucun résultat pour cette recherche</div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))", gap: 14 }}>
            {paginatedVehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>

          {filteredVehicles.length > VEHICLE_PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {pageStart}–{pageEnd} sur {filteredVehicles.length}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="veh-page-btn" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                {paginationPages.map((item) =>
                  typeof item === "number" ? (
                    <button key={item} className={`veh-page-btn${safePage === item ? " active" : ""}`} onClick={() => setPage(item)}>{item}</button>
                  ) : (
                    <span key={item} style={{ color: "var(--text-secondary)", padding: "0 2px" }}>…</span>
                  )
                )}
                <button className="veh-page-btn" disabled={safePage === pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>›</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="veh-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="veh-modal">
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", fontWeight: 900, color: "var(--text-primary)" }}>
                  {editing ? "Modifier le véhicule" : "Nouveau véhicule"}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Format matricule :{" "}
                  <span style={{ fontFamily: "monospace", color: "var(--accent-soft, #93c5fd)" }}>
                    241 Tunis 8542
                  </span>
                </p>
              </div>
              <button className="veh-close-btn" onClick={() => setModal(false)}>×</button>
            </div>

            <div className="veh-divider" style={{ marginBottom: 20 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Nom */}
              <ModalField label="Nom du véhicule">
                <input
                  className="veh-input"
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(""); }}
                  placeholder="Ex. Iveco Daily"
                />
              </ModalField>

              {/* ID */}
              <ModalField label="Identifiant (auto-généré)">
                <input
                  className="veh-input"
                  readOnly
                  value={editing ? `VEH-${String(editing.id).padStart(3, "0")}` : "-- auto --"}
                  style={{ opacity: 0.45, cursor: "not-allowed" }}
                />
              </ModalField>

              {/* Poids */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <ModalField label="Charge min (kg)">
                  <input
                    className="veh-input" type="number" min={1}
                    value={form.min_length}
                    onChange={(e) => { setForm((p) => ({ ...p, min_length: e.target.value, max_length: p.max_length === "" ? e.target.value : p.max_length })); setError(""); }}
                  />
                </ModalField>
                <ModalField label="Charge max (kg)">
                  <input
                    className="veh-input" type="number" min={Number(form.min_length) || 1} max={5000}
                    value={form.max_length}
                    onChange={(e) => { setForm((p) => ({ ...p, max_length: e.target.value })); setError(""); }}
                  />
                </ModalField>
              </div>

              {/* Dimensions camion */}

<div className="veh-dim-grid"> 
   <ModalField label="Longueur camion (cm)">
    <input
      className="veh-input"
      type="number"
      min={1}
      value={form.longueur}
      onChange={(e) => {
        setForm((p) => ({ ...p, longueur: e.target.value }));
        setError("");
      }}
      placeholder="Ex. 700"
    />
  </ModalField>

  <ModalField label="Largeur camion (cm)">
    <input
      className="veh-input"
      type="number"
      min={1}
      value={form.largeur}
      onChange={(e) => {
        setForm((p) => ({ ...p, largeur: e.target.value }));
        setError("");
      }}
      placeholder="Ex. 240"
    />
  </ModalField>

  <ModalField label="Hauteur camion (cm)">
    <input
      className="veh-input"
      type="number"
      min={1}
      value={form.hauteur}
      onChange={(e) => {
        setForm((p) => ({ ...p, hauteur: e.target.value }));
        setError("");
      }}
      placeholder="Ex. 240"
    />
  </ModalField>
</div>

<div
  style={{
    padding: "10px 14px",
    borderRadius: 10,
    background: "var(--surface-panel-faint)",
    border: "1px solid var(--border-subtle)",
    fontSize: 12,
    color: "var(--text-secondary)",
    fontWeight: 700,
  }}
>
  Volume calculé :{" "}
  <span style={{ color: "var(--accent-soft)", fontWeight: 900 }}>
    {formatVolume(calculateVehicleVolume(form.longueur, form.largeur, form.hauteur))}
  </span>
</div>

              {/* Matricule */}
              <ModalField label="Matricule">
                <input
                  className="veh-input"
                  value={form.matricule}
                  onChange={(e) => { setForm({ ...form, matricule: e.target.value }); setError(""); }}
                  onBlur={() => setForm((p) => ({ ...p, matricule: normalizeMatricule(p.matricule) }))}
                  placeholder="Ex. 241 Tunis 8542"
                  style={{
                    fontFamily: "monospace", letterSpacing: "0.06em",
                    borderColor: !hasMatriculeInput
                      ? "var(--border-soft)"
                      : matriculeOk
                        ? "var(--success-border)"
                        : "var(--danger-border)",
                  }}
                />
                <div style={{
                  marginTop: 6, fontSize: 11,
                  color: !hasMatriculeInput ? "var(--text-secondary)" : matriculeOk ? "var(--success)" : "var(--danger)",
                }}>
                  {!hasMatriculeInput
                    ? "Format attendu : 123 NomVille 4567"
                    : matriculeOk
                      ? `✓ Valide : ${normalizedMatricule}`
                      : "✕ Format invalide"}
                </div>
              </ModalField>

              {/* Statut */}
              <ModalField label="Statut">
                <div ref={statusMenuRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setStatusMenuOpen((v) => !v)}
                    className="veh-input"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="veh-status-dot" style={{ background: STATUS_META[form.status]?.dot || "var(--text-secondary)", width: 8, height: 8 }} />
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {STATUS_OPTIONS.find((o) => o.value === form.status)?.label}
                      </span>
                    </div>
                    <span style={{
                      color: "var(--text-secondary)", fontSize: 11,
                      transform: statusMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 200ms",
                    }}>▼</span>
                  </button>

                  {statusMenuOpen && (
                    <div className="veh-dropdown">
                      {STATUS_OPTIONS.map((opt, i) => {
                        const active = opt.value === form.status;
                        const meta = STATUS_META[opt.value];
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setForm({ ...form, status: opt.value }); setStatusMenuOpen(false); }}
                            className={`veh-dropdown-item${active ? " active" : ""}`}
                            style={{ borderBottom: i < STATUS_OPTIONS.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.dot, display: "inline-block", flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>
                                  {opt.label}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1, opacity: 0.7 }}>
                                  {opt.sub}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ModalField>

              {/* Error */}
              {error && (
                <div style={{
                  fontSize: 12, padding: "10px 14px", borderRadius: 10,
                  color: "var(--danger)", background: "var(--danger-bg)", border: "1px solid var(--danger-border)",
                }}>
                  ⚠ {error}
                </div>
              )}

              <div className="veh-divider" />

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="veh-btn-ghost" onClick={() => setModal(false)}>Annuler</button>
                <button className="veh-btn-primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer le véhicule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}