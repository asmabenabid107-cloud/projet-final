import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import {
  adminNoteLabel,
  isApprovedAdminNote,
  isRejectedAdminNote,
} from "../../constants/adminDecision.js";
import { COLIS_SORT_OPTIONS, sortColisList } from "../../utils/colisSort.js";
import AdminColisHistoryPanel from "./AdminColisHistoryPanel.jsx";

const STATUS_STYLES = {
  en_attente: {
    label: "En attente",
    color: "var(--warning)",
    bg: "rgba(245,158,11,0.15)",
    border: "rgba(245,158,11,0.35)",
  },
  en_transit: {
    label: "En transit",
    color: "var(--accent-soft)",
    bg: "rgba(110,168,255,0.15)",
    border: "rgba(110,168,255,0.35)",
  },
  a_relivrer: {
    label: "À relivrer",
    color: "#f97316",
    bg: "rgba(249,115,22,0.15)",
    border: "rgba(249,115,22,0.35)",
  },
  livre: {
    label: "Livré",
    color: "var(--success)",
    bg: "rgba(44,203,118,0.15)",
    border: "rgba(44,203,118,0.35)",
  },
  livré: {
    label: "Livré",
    color: "var(--success)",
    bg: "rgba(44,203,118,0.15)",
    border: "rgba(44,203,118,0.35)",
  },
  annule: {
    label: "Annulé",
    color: "var(--danger)",
    bg: "rgba(255,95,95,0.15)",
    border: "rgba(255,95,95,0.35)",
  },
  annulé: {
    label: "Annulé",
    color: "var(--danger)",
    bg: "rgba(255,95,95,0.15)",
    border: "rgba(255,95,95,0.35)",
  },
  retour: {
    label: "Retour",
    color: "var(--violet)",
    bg: "rgba(167,139,250,0.15)",
    border: "rgba(167,139,250,0.35)",
  },
};

const TABS = [
  { key: "pending", label: "En attente validation" },
  { key: "confirmes", label: "Confirmés" },
  { key: "refuses", label: "Refusés" },
  { key: "all", label: "Tous" },
];

const DEPOT_FILTERS = [
  { key: "all", label: "Tous les dépôts" },
  { key: "sousse", label: "Dépôt Sousse" },
  { key: "kairouan", label: "Dépôt Kairouan" },
];
const COLIS_PAGE_SIZE = 6;

function normalizeDepot(value) {
  return String(value || "").toLowerCase().trim();
}

function depotLabel(value) {
  const depot = normalizeDepot(value);

  if (depot === "sousse") return "Dépôt Sousse";
  if (depot === "kairouan") return "Dépôt Kairouan";

  return "Dépôt non défini";
}

function depotStyle(value) {
  const depot = normalizeDepot(value);

  if (depot === "sousse") {
    return {
      color: "#38bdf8",
      bg: "rgba(56,189,248,.13)",
      border: "rgba(56,189,248,.35)",
    };
  }

  if (depot === "kairouan") {
    return {
      color: "#f59e0b",
      bg: "rgba(245,158,11,.13)",
      border: "rgba(245,158,11,.35)",
    };
  }

  return {
    color: "rgba(100,116,139,.9)",
    bg: "rgba(148,163,184,.12)",
    border: "rgba(148,163,184,.28)",
  };
}

export default function AdminColis() {
  const [colisList, setColisList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState("all");
  const [sortKey, setSortKey] = useState("recent");
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadColis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadColis = async () => {
    setLoading(true);

    try {
      const { data } = await api.get("/admin/colis");
      setColisList(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      console.error(err);
      showToast("Erreur chargement colis", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleApprove = async (id, numero) => {
    setActionLoading(id + "_approve");

    try {
      await api.post(`/admin/colis/${id}/approve`);
      await loadColis();

      // important: ما نبدلوش activeTab
      setExpanded(null);
      showToast(`Colis ${numero} confirmé`);
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la confirmation", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id, numero) => {
    setActionLoading(id + "_reject");

    try {
      await api.post(`/admin/colis/${id}/reject`);
      await loadColis();

      // important: ما نبدلوش activeTab
      setExpanded(null);
      showToast(`Colis ${numero} refusé`, "error");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors du refus", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  const countBy = (key) => {
    if (key === "all") return colisList.length;

    if (key === "pending") {
      return colisList.filter((c) => c.statut === "en_attente" && !c.admin_note)
        .length;
    }

    if (key === "confirmes") {
      return colisList.filter((c) => isApprovedAdminNote(c.admin_note)).length;
    }

    if (key === "refuses") {
      return colisList.filter((c) => isRejectedAdminNote(c.admin_note)).length;
    }

    return 0;
  };

  const pendingCount = countBy("pending");
  const confirmedCount = countBy("confirmes");
  const refusedCount = countBy("refuses");

  const sousseCount = colisList.filter(
    (c) => normalizeDepot(c.depot_depart) === "sousse"
  ).length;

  const kairouanCount = colisList.filter(
    (c) => normalizeDepot(c.depot_depart) === "kairouan"
  ).length;

  const undefinedDepotCount = colisList.filter(
    (c) => !normalizeDepot(c.depot_depart)
  ).length;

  const filtered = useMemo(() => {
    const matched = colisList.filter((c) => {
      let matchTab = false;

      if (activeTab === "all") matchTab = true;
      if (activeTab === "pending") {
        matchTab = c.statut === "en_attente" && !c.admin_note;
      }
      if (activeTab === "confirmes") {
        matchTab = isApprovedAdminNote(c.admin_note);
      }
      if (activeTab === "refuses") {
        matchTab = isRejectedAdminNote(c.admin_note);
      }

      const matchDepot =
        depotFilter === "all" || normalizeDepot(c.depot_depart) === depotFilter;

      const s = search.toLowerCase().trim();

      const matchSearch =
        !s ||
        c.numero_suivi?.toLowerCase().includes(s) ||
        c.nom_destinataire?.toLowerCase().includes(s) ||
        c.telephone_destinataire?.toLowerCase().includes(s) ||
        c.adresse_livraison?.toLowerCase().includes(s) ||
        c.barcode_value?.toLowerCase().includes(s) ||
        depotLabel(c.depot_depart).toLowerCase().includes(s);

      return matchTab && matchDepot && matchSearch;
    });

    return sortColisList(matched, sortKey);
  }, [colisList, activeTab, depotFilter, search, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / COLIS_PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * COLIS_PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * COLIS_PAGE_SIZE, filtered.length);
  const paginated = filtered.slice((safePage - 1) * COLIS_PAGE_SIZE, safePage * COLIS_PAGE_SIZE);
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div
      style={{
        padding: "24px 28px",
        fontFamily: "system-ui, Arial, sans-serif",
        color: "var(--text-primary)",
        minHeight: "100vh",
      }}
    >
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 999,
            background:
              toast.type === "error"
                ? "rgba(255,95,95,.15)"
                : "rgba(44,203,118,.15)",
            border: `1px solid ${
              toast.type === "error"
                ? "rgba(255,95,95,.4)"
                : "rgba(44,203,118,.4)"
            }`,
            color: toast.type === "error" ? "#ff5f5f" : "#2ccb76",
            borderRadius: 14,
            padding: "12px 20px",
            fontWeight: 900,
            boxShadow: "0 12px 30px rgba(15,23,42,0.18)",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          padding: 18,
          borderRadius: 22,
          border: "1px solid var(--border-soft)",
          background:
            "radial-gradient(900px 280px at 85% -30%, rgba(45,91,255,.22), transparent 60%), rgba(255,255,255,.04)",
          marginBottom: 18,
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 950 }}>
            Gestion des colis
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
            }}
          >
            {loading ? "Chargement..." : `${colisList.length} colis au total`}
          </p>
        </div>

        <button
          onClick={loadColis}
          style={{
            background: "var(--accent-bg)",
            border: "1px solid var(--accent-border)",
            color: "var(--text-primary)",
            borderRadius: 14,
            padding: "10px 18px",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Rafraîchir
        </button>
      </div>

      {/* KPI CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <StatCard
          title="En attente"
          value={pendingCount}
          subtitle="À confirmer"
          color="var(--warning)"
          bg="rgba(245,158,11,.10)"
          border="rgba(245,158,11,.30)"
        />

        <StatCard
          title="Confirmés"
          value={confirmedCount}
          subtitle="Validés admin"
          color="var(--success)"
          bg="rgba(44,203,118,.10)"
          border="rgba(44,203,118,.30)"
        />

        <StatCard
          title="Refusés"
          value={refusedCount}
          subtitle="Non acceptés"
          color="var(--danger)"
          bg="rgba(255,95,95,.10)"
          border="rgba(255,95,95,.30)"
        />

        <StatCard
          title="Total colis"
          value={colisList.length}
          subtitle="Tous les colis"
          color="var(--accent-soft)"
          bg="rgba(110,168,255,.10)"
          border="rgba(110,168,255,.30)"
        />
      </div>

      {/* DEPOTS */}
      <div
        style={{
          marginBottom: 18,
          padding: 16,
          borderRadius: 20,
          border: "1px solid var(--border-soft)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.025))",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 950 }}>
              Répartition par dépôt
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginTop: 3,
              }}
            >
              Visualiser les colis selon le dépôt de départ.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <DepotCard
            title="Dépôt Sousse"
            value={sousseCount}
            color="#38bdf8"
            bg="rgba(56,189,248,.10)"
            border="rgba(56,189,248,.30)"
          />

          <DepotCard
            title="Dépôt Kairouan"
            value={kairouanCount}
            color="#f59e0b"
            bg="rgba(245,158,11,.10)"
            border="rgba(245,158,11,.30)"
          />

          <DepotCard
            title="Sans dépôt"
            value={undefinedDepotCount}
            color="rgba(100,116,139,.9)"
            bg="rgba(148,163,184,.10)"
            border="rgba(148,163,184,.25)"
          />
        </div>
      </div>

      {/* FILTERS */}
      <div
        style={{
          padding: 16,
          borderRadius: 20,
          border: "1px solid var(--border-soft)",
          background: "var(--surface-panel-soft)",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          {TABS.map((tab) => {
            const count = countBy(tab.key);
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "9px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: "0.82rem",
                  background: active
                    ? "rgba(110,168,255,.18)"
                    : "rgba(255,255,255,.04)",
                  border: active
                    ? "1px solid rgba(110,168,255,.5)"
                    : "1px solid rgba(255,255,255,.10)",
                  color: active ? "#7aa2ff" : "var(--text-secondary)",
                }}
              >
                {tab.label} <span style={{ opacity: 0.75 }}>({count})</span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          {DEPOT_FILTERS.map((depot) => {
            const active = depotFilter === depot.key;

            return (
              <button
                key={depot.key}
                type="button"
                onClick={() => {
                  setDepotFilter(depot.key);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: "0.82rem",
                  background: active
                    ? "rgba(56,189,248,.14)"
                    : "rgba(255,255,255,.04)",
                  border: active
                    ? "1px solid rgba(56,189,248,.45)"
                    : "1px solid rgba(255,255,255,.10)",
                  color: active ? "#38bdf8" : "var(--text-secondary)",
                }}
              >
                {depot.label}
              </button>
            );
          })}
        </div>

        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Rechercher par numéro, nom, téléphone, adresse ou dépôt..."
          style={{
            width: "100%",
            borderRadius: 14,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-panel-faint)",
            color: "var(--text-primary)",
            padding: "12px 14px",
            outline: "none",
            fontSize: "0.9rem",
            boxSizing: "border-box",
          }}
        />

        <select
          className="adminColisSelect"
          value={sortKey}
          onChange={(event) => {
            setSortKey(event.target.value);
            setCurrentPage(1);
          }}
          style={{
            width: "100%",
            maxWidth: 320,
            marginTop: 12,
            borderRadius: 14,
            border: "1px solid var(--border-strong)",
            background: "var(--surface-panel-faint)",
            color: "var(--text-primary)",
            padding: "12px 14px",
            outline: "none",
            fontSize: "0.9rem",
            fontWeight: 850,
            boxSizing: "border-box",
          }}
        >
          {COLIS_SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              Trier: {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* LIST */}
      {loading ? (
        <div
          style={{
            padding: 28,
            textAlign: "center",
            borderRadius: 18,
            border: "1px solid var(--border-soft)",
            background: "var(--surface-panel-soft)",
            color: "var(--text-secondary)",
          }}
        >
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 28,
            textAlign: "center",
            borderRadius: 18,
            border: "1px solid var(--border-soft)",
            background: "var(--surface-panel-soft)",
            color: "var(--text-secondary)",
          }}
        >
          Aucun colis trouvé.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {paginated.map((colis) => {
            const st = STATUS_STYLES[colis.statut] || STATUS_STYLES.en_attente;
            const canValidate = !colis.admin_note && colis.statut === "en_attente";
            const isOpen = expanded === colis.id;
            const depotMeta = depotStyle(colis.depot_depart);

            return (
              <div
                key={colis.id}
                style={{
                  borderRadius: 18,
                  border: canValidate
                    ? "1px solid rgba(245,158,11,.35)"
                    : "1px solid var(--border-subtle)",
                  background: canValidate
                    ? "rgba(245,158,11,.035)"
                    : "var(--surface-panel-faint)",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "34px minmax(170px, 1.1fr) minmax(180px, 1fr) minmax(260px, 1.4fr) auto",
                    gap: 14,
                    alignItems: "center",
                    padding: "15px 18px",
                  }}
                >
                  <button
                    onClick={() => toggleExpand(colis.id)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 10,
                      background: "rgba(110,168,255,.10)",
                      border: "1px solid rgba(110,168,255,.22)",
                      color: "var(--accent-soft)",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: 900,
                    }}
                  >
                    {isOpen ? "▼" : "▶"}
                  </button>

                  <div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        color: "var(--accent-soft)",
                        fontWeight: 900,
                        fontSize: "0.9rem",
                      }}
                    >
                      #{colis.numero_suivi}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      <Badge meta={st} label={st.label} />
                      <Badge meta={depotMeta} label={depotLabel(colis.depot_depart)} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 950, fontSize: "0.92rem" }}>
                      {colis.nom_destinataire}
                    </div>
                    <div
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.8rem",
                        marginTop: 3,
                      }}
                    >
                      {colis.telephone_destinataire || "-"}
                    </div>
                  </div>

                  <div
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.86rem",
                      lineHeight: 1.45,
                    }}
                  >
                    {colis.adresse_livraison || "-"}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                      alignItems: "center",
                      minWidth: 210,
                    }}
                  >
                    {canValidate ? (
                      <>
                        <button
                          onClick={() => handleApprove(colis.id, colis.numero_suivi)}
                          disabled={actionLoading !== null}
                          style={{
                            padding: "9px 16px",
                            borderRadius: 12,
                            cursor: "pointer",
                            fontWeight: 950,
                            fontSize: "0.84rem",
                            background: "rgba(44,203,118,.15)",
                            border: "1px solid rgba(44,203,118,.4)",
                            color: "var(--success)",
                            opacity:
                              actionLoading === colis.id + "_approve" ? 0.6 : 1,
                          }}
                        >
                          {actionLoading === colis.id + "_approve"
                            ? "..."
                            : "Confirmer"}
                        </button>

                        <button
                          onClick={() => handleReject(colis.id, colis.numero_suivi)}
                          disabled={actionLoading !== null}
                          style={{
                            padding: "9px 16px",
                            borderRadius: 12,
                            cursor: "pointer",
                            fontWeight: 950,
                            fontSize: "0.84rem",
                            background: "rgba(255,95,95,.15)",
                            border: "1px solid rgba(255,95,95,.4)",
                            color: "var(--danger)",
                            opacity:
                              actionLoading === colis.id + "_reject" ? 0.6 : 1,
                          }}
                        >
                          {actionLoading === colis.id + "_reject" ? "..." : "Refuser"}
                        </button>
                      </>
                    ) : colis.admin_note ? (
                      <div
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 950,
                          color: isApprovedAdminNote(colis.admin_note)
                            ? "var(--success)"
                            : "var(--danger)",
                        }}
                      >
                        {adminNoteLabel(colis.admin_note)}
                      </div>
                    ) : (
                      <div
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "0.82rem",
                          fontWeight: 850,
                        }}
                      >
                        -
                      </div>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border-subtle)",
                      padding: "16px 20px",
                      background: "var(--surface-inset-strong)",
                    }}
                  >
                    <AdminColisHistoryPanel colis={colis} />
                  </div>
                )}
              </div>
            );
            })}
          </div>

          {pageCount > 1 && (
            <div className="admPagination" style={{ marginTop: 14 }}>
              <div className="admPaginationInfo">
                Affichage {pageStart}-{pageEnd} sur {filtered.length}
              </div>
              <div className="admPaginationBtns" aria-label="Pagination colis">
                <button
                  type="button"
                  className="admPageBtn"
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                >
                  Precedent
                </button>
                {pages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`admPageBtn ${safePage === page ? "isActive" : ""}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="admPageBtn"
                  onClick={() => setCurrentPage(Math.min(pageCount, safePage + 1))}
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
  );
}

function Badge({ meta, label }) {
  return (
    <span
      style={{
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: "0.7rem",
        fontWeight: 900,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}

function StatCard({ title, value, subtitle, color, bg, border }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        border: `1px solid ${border}`,
        background: bg,
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 30,
          fontWeight: 950,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          marginTop: 8,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function DepotCard({ title, value, color, bg, border }) {
  return (
    <div
      style={{
        padding: 15,
        borderRadius: 16,
        border: `1px solid ${border}`,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            fontWeight: 850,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 26,
            fontWeight: 950,
            color,
            marginTop: 4,
          }}
        >
          {value}
        </div>
      </div>

      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          background: bg,
          border: `1px solid ${border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          fontWeight: 950,
          fontSize: 18,
        }}
      >
        {value}
      </div>
    </div>
  );
}
