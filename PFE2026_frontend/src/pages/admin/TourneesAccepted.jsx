import { useEffect, useMemo, useState } from "react";
import tourneeService from "../../api/tourneeService";

/* ─── Status ─────────────────────────────────────────────── */
const STATUS_META = {
  accepted: {
    label: "Acceptée",
    bg: "rgba(34,197,94,0.12)",
    color: "#22c55e",
    border: "rgba(34,197,94,0.28)",
    dot: "#22c55e",
  },
};

/* ─── Helpers ─────────────────────────────────────────────── */
const formatNumber = (value, digits = 1) => {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
};

const parseParcours = (parcoursText = "") => {
  if (!parcoursText) return [];
  return parcoursText
    .split("->")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const match = item.match(/^(.*?)(\((.*?)\))?$/);
      return {
        id: index + 1,
        adresse: match?.[1]?.trim() || item,
        details: match?.[3]?.trim() || "",
      };
    });
};

const normalizeDepot = (label = "") =>
  label.toLowerCase().trim().replace(/\s+/g, " ");

const extractDepots = (tournees) => {
  const seen = new Set();
  const depots = [];
  for (const t of tournees) {
    const label = t.depot_label || t.depot_depart || "";
    if (label && !seen.has(normalizeDepot(label))) {
      seen.add(normalizeDepot(label));
      depots.push(label);
    }
  }
  return depots.sort();
};

/* ─── CSS ─────────────────────────────────────────────────── */
const css = `
.ta-page {
  padding: 18px;
  color: var(--text-primary);
}

/* ── Hero ── */
.ta-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding: 20px;
  border-radius: 24px;
  border: 1px solid rgba(34,197,94,0.25);
  background:
    radial-gradient(800px 280px at 88% -35%, rgba(34,197,94,0.22), transparent 60%),
    radial-gradient(600px 260px at -10% 0%, rgba(20,184,166,0.10), transparent 58%),
    linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025));
  box-shadow: 0 18px 50px rgba(15,23,42,0.07);
  margin-bottom: 18px;
}

.ta-hero::after {
  content: "";
  position: absolute;
  right: 38px;
  top: -42px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: rgba(34,197,94,0.10);
  filter: blur(2px);
  pointer-events: none;
}

.ta-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(34,197,94,0.28);
  background: rgba(34,197,94,0.10);
  color: #22c55e;
  font-size: 12px;
  font-weight: 900;
  margin-bottom: 10px;
}

.ta-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 5px rgba(34,197,94,0.12);
}

.ta-title {
  margin: 0;
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.05;
  font-weight: 1000;
  letter-spacing: -0.04em;
}

.ta-subtitle {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.ta-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 1;
}

/* ── Buttons ── */
.ta-ghost-btn,
.ta-success-btn,
.ta-danger-btn {
  border: 0;
  outline: none;
  border-radius: 16px;
  padding: 11px 16px;
  font-weight: 950;
  cursor: pointer;
  transition: transform .15s ease, opacity .15s ease;
  white-space: nowrap;
}

.ta-ghost-btn {
  border: 1px solid var(--border-soft);
  background: var(--surface-panel-faint);
  color: var(--text-primary);
}

.ta-success-btn {
  border: 1px solid rgba(34,197,94,0.32);
  background: rgba(34,197,94,0.13);
  color: #22c55e;
}

.ta-danger-btn {
  border: 1px solid rgba(239,68,68,0.32);
  background: rgba(239,68,68,0.13);
  color: #ef4444;
}

.ta-ghost-btn:hover,
.ta-success-btn:hover,
.ta-danger-btn:hover { transform: translateY(-1px); }

/* ── Stats ── */
.ta-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.ta-stat-card {
  padding: 16px;
  border-radius: 20px;
  border: 1px solid var(--border-soft);
  background:
    radial-gradient(240px 120px at 100% 0%, rgba(34,197,94,0.12), transparent 60%),
    var(--surface-panel-faint);
  box-shadow: 0 12px 36px rgba(15,23,42,0.045);
}

.ta-stat-label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 850;
  margin-bottom: 8px;
}

.ta-stat-value {
  font-size: 26px;
  font-weight: 1000;
  letter-spacing: -0.03em;
}

/* ── Toolbar ── */
.ta-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 20px;
  border: 1px solid var(--border-soft);
  background: var(--surface-panel-soft);
  margin-bottom: 14px;
}

.ta-toolbar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ta-toolbar-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 0 -2px;
}

.ta-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ta-chip {
  border: 1px solid var(--border-subtle);
  background: var(--surface-panel-faint);
  color: var(--text-primary);
  padding: 8px 11px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 850;
  font-size: 12px;
  transition: background .14s, border-color .14s, color .14s;
}

.ta-chip.active {
  border-color: rgba(34,197,94,0.40);
  background: rgba(34,197,94,0.10);
  color: #22c55e;
}

/* Depot chips — teal accent to distinguish from status chips */
.ta-depot-chip {
  border: 1px solid var(--border-subtle);
  background: var(--surface-panel-faint);
  color: var(--text-primary);
  padding: 7px 11px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 850;
  font-size: 12px;
  transition: background .14s, border-color .14s, color .14s;
}

.ta-depot-chip.active {
  border-color: rgba(45,212,191,0.45);
  background: rgba(45,212,191,0.12);
  color: #2dd4bf;
}

.ta-search {
  min-width: min(280px, 100%);
  flex: 1;
  max-width: 420px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-panel-faint);
  color: var(--text-primary);
  border-radius: 999px;
  padding: 10px 14px;
  outline: none;
  font-weight: 750;
}

/* ── Cards grid ── */
.ta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.ta-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  background:
    radial-gradient(280px 150px at 100% 0%, rgba(34,197,94,0.08), transparent 60%),
    var(--surface-panel-faint);
  border-radius: 22px;
  padding: 18px;
  box-shadow: 0 18px 48px rgba(15,23,42,0.07);
  text-align: left;
  cursor: pointer;
  color: var(--text-primary);
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}

.ta-card:hover {
  transform: translateY(-3px);
  border-color: rgba(34,197,94,0.36);
  box-shadow: 0 22px 60px rgba(15,23,42,0.12);
}

.ta-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.ta-code {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--text-secondary);
  font-weight: 850;
}

.ta-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  padding: 6px 11px;
  border-radius: 999px;
  font-weight: 900;
}

.ta-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.ta-card-title {
  font-size: 1rem;
  font-weight: 1000;
  letter-spacing: -0.025em;
  line-height: 1.25;
  margin-bottom: 8px;
}

.ta-card-meta {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 850;
}

/* ── Empty / loading ── */
.ta-empty {
  padding: 30px;
  border-radius: 22px;
  border: 1px dashed var(--border-soft);
  background: var(--surface-panel-soft);
  text-align: center;
  color: var(--text-secondary);
}

.ta-loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.ta-skeleton {
  height: 160px;
  border-radius: 22px;
  border: 1px solid var(--border-subtle);
  background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.12), rgba(255,255,255,0.04));
  background-size: 240% 100%;
  animation: taPulse 1.5s infinite linear;
}

@keyframes taPulse {
  from { background-position: 220% 0; }
  to   { background-position: -20% 0; }
}

/* ── Modal ── */
.ta-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,0.58);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 18px;
}

.ta-modal {
  width: min(820px, 100%);
  max-height: 92vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 28px;
  border: 1px solid var(--border-soft);
  background:
    radial-gradient(800px 320px at 100% -10%, rgba(34,197,94,0.12), transparent 60%),
    var(--sidebar-bg);
  color: var(--text-primary);
  box-shadow: 0 30px 90px rgba(0,0,0,0.28);
}

.ta-modal-header {
  padding: 24px 24px 16px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border-soft);
}

.ta-modal-title {
  margin: 0;
  font-size: clamp(22px, 3vw, 28px);
  line-height: 1.12;
  letter-spacing: -0.04em;
  font-weight: 1000;
}

.ta-modal-desc {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.ta-close-btn {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid var(--border-soft);
  background: var(--surface-panel-faint);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 1000;
  font-size: 20px;
  flex-shrink: 0;
}

.ta-modal-body {
  padding: 18px 24px 24px;
  overflow-y: auto;
}

.ta-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.ta-info-card {
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-panel-faint);
}

.ta-info-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 7px;
  font-weight: 800;
}

.ta-info-value { font-weight: 950; line-height: 1.45; }

.ta-route-section {
  padding: 16px;
  border-radius: 22px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-panel-faint);
}

.ta-route-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  align-items: center;
}

.ta-route-head strong { font-size: 16px; }

.ta-route-count {
  color: var(--text-secondary);
  font-weight: 850;
  font-size: 13px;
}

.ta-route-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 340px;
  overflow-y: auto;
  padding-right: 6px;
}

.ta-step {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 11px;
  align-items: start;
}

.ta-step-no {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(34,197,94,0.14);
  color: #22c55e;
  font-weight: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(34,197,94,0.30);
  flex-shrink: 0;
}

.ta-step-card {
  border-radius: 16px;
  border: 1px solid var(--border-subtle);
  background: rgba(255,255,255,0.045);
  padding: 12px 14px;
}

.ta-step-address { font-weight: 900; line-height: 1.45; }

.ta-step-details {
  margin-top: 7px;
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(34,197,94,0.10);
  color: #22c55e;
  font-size: 12px;
  font-weight: 900;
}

.ta-modal-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .ta-stats    { grid-template-columns: repeat(2, 1fr); }
  .ta-info-grid { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .ta-page { padding: 12px; }
  .ta-stats { grid-template-columns: 1fr; }
  .ta-actions, .ta-ghost-btn { width: 100%; }
}
`;

/* ─── Component ───────────────────────────────────────────── */
export default function TourneesAccepted() {
  const [tournees, setTournees]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selectedTournee, setSelectedTournee] = useState(null);
  const [query, setQuery]                   = useState("");
  const [depotFilter, setDepotFilter]       = useState("all");  // ← NEW

  const parcoursSteps = useMemo(
    () => parseParcours(selectedTournee?.parcours_text || ""),
    [selectedTournee]
  );

  /* ── Unique depot list ── */
  const depotList = useMemo(() => extractDepots(tournees), [tournees]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total:      tournees.length,
    totalColis: tournees.reduce((s, t) => s + (Number(t.nombre_colis) || 0), 0),
    totalPoids: tournees.reduce((s, t) => s + (Number(t.poids_total)  || 0), 0),
    totalDist:  tournees.reduce((s, t) => s + (Number(t.distance_km)  || 0), 0),
  }), [tournees]);

  /* ── Search + depot filter ── */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tournees.filter((t) => {
      const matchDepot =
        depotFilter === "all" ||
        normalizeDepot(t.depot_label || t.depot_depart || "") ===
          normalizeDepot(depotFilter);                           // ← NEW

      const matchSearch =
        !q ||
        [t.nom, t.livreur_name, t.region, t.depot_label, `TOUR-${String(t.id).padStart(3, "0")}`]
          .filter(Boolean).join(" ").toLowerCase().includes(q);

      return matchDepot && matchSearch;
    });
  }, [tournees, query, depotFilter]);

  /* ── Load ── */
  const loadTournees = async () => {
    try {
      setLoading(true);
      const data = await tourneeService.getAccepted();
      setTournees(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTournees(); }, []);

  const s = STATUS_META.accepted;

  return (
    <div className="ta-page">
      <style>{css}</style>

      {/* ── Hero ── */}
      <section className="ta-hero">
        <div>
          <div className="ta-eyebrow">
            <span className="ta-dot" />
            Tournées validées
          </div>
          <h1 className="ta-title">Tournées acceptées</h1>
          <p className="ta-subtitle">
            Liste des tournées validées par l'administrateur — prêtes pour la livraison.
          </p>
        </div>
        <div className="ta-actions">
          <button className="ta-ghost-btn" type="button" onClick={loadTournees}>
            Rafraîchir
          </button>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="ta-stats">
        <StatCard label="Tournées acceptées"  value={stats.total} />
        <StatCard label="Colis planifiés"     value={stats.totalColis} />
        <StatCard label="Poids total"         value={`${formatNumber(stats.totalPoids)} kg`} />
        <StatCard label="Distance totale"     value={`${formatNumber(stats.totalDist, 0)} km`} />
      </section>

      {/* ── Toolbar ── */}
      <section className="ta-toolbar">

        {/* Row 1 : "Toutes" chip (placeholder for future status filters) + search */}
        <div className="ta-toolbar-row">
          <div className="ta-filters">
            <button type="button" className="ta-chip active">
              Toutes
            </button>
          </div>
          <input
            className="ta-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une tournée, livreur, région..."
          />
        </div>

        {/* Divider */}
        <div className="ta-toolbar-divider" />

        {/* Row 2 : depot chips */}
        <div className="ta-filters">
          <button
            type="button"
            className={`ta-depot-chip ${depotFilter === "all" ? "active" : ""}`}
            onClick={() => setDepotFilter("all")}
          >
            Tous les dépôts
          </button>
          {depotList.map((depot) => (
            <button
              key={depot}
              type="button"
              className={`ta-depot-chip ${
                normalizeDepot(depotFilter) === normalizeDepot(depot) ? "active" : ""
              }`}
              onClick={() => setDepotFilter(depot)}
            >
              {depot}
            </button>
          ))}
        </div>

      </section>

      {/* ── Content ── */}
      {loading ? (
        <div className="ta-loading-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ta-skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ta-empty">
          <strong>Aucune tournée acceptée.</strong>
          <div style={{ marginTop: 6 }}>
            {query || depotFilter !== "all"
              ? "Modifiez les filtres de recherche."
              : "Aucune tournée validée pour le moment."}
          </div>
        </div>
      ) : (
        <div className="ta-grid">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              className="ta-card"
              onClick={() => setSelectedTournee(t)}
            >
              <div className="ta-card-top">
                <span className="ta-code">TOUR-{String(t.id).padStart(3, "0")}</span>
                <span
                  className="ta-status"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                >
                  <span className="ta-status-dot" style={{ background: s.dot }} />
                  {s.label}
                </span>
              </div>
              <div className="ta-card-title">{t.nom}</div>
              <div className="ta-card-meta">
                {t.nombre_colis} colis &bull; {formatNumber(t.poids_total)} kg &bull; {formatNumber(t.distance_km, 0)} km
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {selectedTournee && (
        <div className="ta-overlay" onClick={() => setSelectedTournee(null)}>
          <div className="ta-modal" onClick={(e) => e.stopPropagation()}>

            <div className="ta-modal-header">
              <div>
                <span
                  className="ta-status"
                  style={{
                    background: s.bg, color: s.color,
                    border: `1px solid ${s.border}`,
                    marginBottom: 10, display: "inline-flex",
                  }}
                >
                  <span className="ta-status-dot" style={{ background: s.dot }} />
                  {s.label}
                </span>
                <h2 className="ta-modal-title">{selectedTournee.nom}</h2>
                <p className="ta-modal-desc">Détails de la tournée validée.</p>
              </div>
              <button className="ta-close-btn" type="button" onClick={() => setSelectedTournee(null)}>
                ×
              </button>
            </div>

            <div className="ta-modal-body">
              <div className="ta-info-grid">
                <Info label="Livreur"            value={selectedTournee.livreur_name} />
                <Info label="Véhicule"            value={`${selectedTournee.vehicle_name || "-"} | Capacité: ${selectedTournee.vehicle_capacity || "-"} kg`} />
                <Info label="Nombre colis"        value={selectedTournee.nombre_colis} />
                <Info label="Poids total"         value={`${formatNumber(selectedTournee.poids_total)} kg`} />
                <Info label="Distance estimée"    value={`${formatNumber(selectedTournee.distance_km, 0)} km`} />
                <Info label="Dépôt départ / arrivée"
                  value={`${selectedTournee.depot_label || selectedTournee.depot_depart || "-"}${
                    selectedTournee.depot_adresse ? ` — ${selectedTournee.depot_adresse}` : ""
                  }`}
                />
              </div>

              <div className="ta-route-section">
                <div className="ta-route-head">
                  <strong>Parcours</strong>
                  <span className="ta-route-count">{parcoursSteps.length} étapes</span>
                </div>

                {parcoursSteps.length > 0 ? (
                  <div className="ta-route-list">
                    {parcoursSteps.map((step) => (
                      <div key={step.id} className="ta-step">
                        <div className="ta-step-no">{step.id}</div>
                        <div className="ta-step-card">
                          <div className="ta-step-address">{step.adresse}</div>
                          {step.details && (
                            <div className="ta-step-details">{step.details}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "var(--text-secondary)", fontWeight: 800 }}>
                    Aucun parcours disponible.
                  </div>
                )}
              </div>

              <div className="ta-modal-actions">
                <button type="button" className="ta-ghost-btn" onClick={() => setSelectedTournee(null)}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */
function StatCard({ label, value }) {
  return (
    <div className="ta-stat-card">
      <div className="ta-stat-label">{label}</div>
      <div className="ta-stat-value">{value}</div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="ta-info-card">
      <div className="ta-info-label">{label}</div>
      <div className="ta-info-value">{value || "-"}</div>
    </div>
  );
}
