import { useEffect, useMemo, useState } from "react";

import { api } from "../../api/client.js";
import { isApprovedAdminNote } from "../../constants/adminDecision.js";
import { COLIS_SORT_OPTIONS, sortColisList } from "../../utils/colisSort.js";
import AdminColisHistoryModal from "./AdminColisHistoryModal.jsx";

const STATUS_STYLES = {
  en_attente: { label: "En attente", color: "var(--warning)", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.35)" },
  en_transit: { label: "En transit", color: "var(--accent-soft)", bg: "rgba(110,168,255,0.15)", border: "rgba(110,168,255,0.35)" },
  a_relivrer: { label: "A relivrer", color: "#f97316", bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.35)" },
  livre: { label: "Livre", color: "var(--success)", bg: "rgba(44,203,118,0.15)", border: "rgba(44,203,118,0.35)" },
  annule: { label: "Annule", color: "var(--danger)", bg: "rgba(255,95,95,0.15)", border: "rgba(255,95,95,0.35)" },
  retour: { label: "Retour", color: "var(--violet)", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.35)" },
};
const STATUS_ORDER = ["en_attente", "en_transit", "a_relivrer", "livre", "annule", "retour"];
const COLIS_PAGE_SIZE = 6;
const DEPOT_FILTERS = [
  { key: "all", label: "Tous les dépôts" },
  { key: "sousse", label: "Dépôt Sousse" },
  { key: "kairouan", label: "Dépôt Kairouan" },
];

function statusLabelOf(value) {
  return STATUS_STYLES[value]?.label || value || "Inconnu";
}

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
    color: "rgba(232,238,252,.65)",
    bg: "rgba(255,255,255,.05)",
    border: "rgba(255,255,255,.12)",
  };
}
function formatDimensionNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatDimensions(colis) {
  const longueur = formatDimensionNumber(colis?.longueur);
  const largeur = formatDimensionNumber(colis?.largeur);
  const hauteur = formatDimensionNumber(colis?.hauteur);

  if (!longueur || !largeur || !hauteur) return "Non définies";
  return `${longueur} × ${largeur} × ${hauteur} cm`;
}

export default function ColisConfirmes() {
  const [colisList, setColisList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [depotFilter, setDepotFilter] = useState("all");
  const [sortKey, setSortKey] = useState("recent");
  const [selectedColis, setSelectedColis] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadColis();
  }, []);

  const loadColis = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/colis");
      const all = Array.isArray(data) ? data : data?.items || [];
      setColisList(all.filter((colis) => isApprovedAdminNote(colis.admin_note)));
    } catch {
      console.error("Erreur chargement colis confirmes");
    } finally {
      setLoading(false);
    }
  };

  const statusCounts = useMemo(() => {
    return colisList.reduce((acc, colis) => {
      const key = colis.statut || "inconnu";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [colisList]);

  const statusOptions = useMemo(() => {
    const known = STATUS_ORDER.filter((key) => statusCounts[key]);
    const extra = Object.keys(statusCounts)
      .filter((key) => !STATUS_ORDER.includes(key))
      .sort((a, b) => statusLabelOf(a).localeCompare(statusLabelOf(b)));

    return ["tous", ...known, ...extra];
  }, [statusCounts]);

  useEffect(() => {
    if (!selectedColis) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedColis(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedColis]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    const matched = colisList
      .filter((colis) => {
        const matchStatus = statusFilter === "tous" || colis.statut === statusFilter;
        const matchDepot =
          depotFilter === "all" || normalizeDepot(colis.depot_depart) === depotFilter;

        const matchSearch =
          !query ||
          colis.numero_suivi?.toLowerCase().includes(query) ||
          colis.nom_destinataire?.toLowerCase().includes(query) ||
          colis.adresse_livraison?.toLowerCase().includes(query) ||
          colis.barcode_value?.toLowerCase().includes(query) ||
          depotLabel(colis.depot_depart).toLowerCase().includes(query);

        return matchStatus && matchDepot && matchSearch;
      });

    return sortColisList(matched, sortKey);
  }, [colisList, depotFilter, search, sortKey, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / COLIS_PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * COLIS_PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * COLIS_PAGE_SIZE, filtered.length);
  const paginated = filtered.slice((safePage - 1) * COLIS_PAGE_SIZE, safePage * COLIS_PAGE_SIZE);
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div style={{ padding: "24px 28px", fontFamily: "system-ui, Arial, sans-serif", color: "var(--text-primary)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900 }}>Colis confirmes</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.6, fontSize: "0.85rem" }}>
            {loading ? "Chargement..." : `${colisList.length} colis confirmes`}
          </p>
        </div>
        <button
          onClick={loadColis}
          style={{ background: "rgba(44,203,118,.15)", border: "1px solid var(--success-border)", color: "var(--success)", borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontWeight: 700 }}
        >
          Rafraichir
        </button>
      </div>

      <div style={{ marginBottom: 20, padding: "16px 20px", borderRadius: 14, background: "rgba(44,203,118,.08)", border: "1px solid rgba(44,203,118,.25)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "var(--success)" }}>{colisList.length}</div>
        <div>
          <div style={{ fontWeight: 800, color: "var(--success)" }}>Colis acceptes par l admin</div>
          <div style={{ opacity: 0.6, fontSize: "0.82rem" }}>L admin peut ouvrir chaque colis pour voir ses etats et son historique complet.</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCurrentPage(1);
          }}
          placeholder="Rechercher par numero, nom, adresse..."
          style={{ flex: "1 1 320px", maxWidth: 520, borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface-panel-soft)", color: "var(--text-primary)", padding: "10px 14px", outline: "none", fontSize: "0.9rem", boxSizing: "border-box" }}
        />

        <select
          className="adminColisSelect"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setCurrentPage(1);
          }}
          style={{ minWidth: 220, borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface-panel-soft)", color: "var(--text-primary)", padding: "10px 14px", outline: "none", fontSize: "0.9rem", fontWeight: 700 }}
        >
          {statusOptions.map((statusKey) => (
            <option key={statusKey} value={statusKey}>
              {statusKey === "tous"
                ? `Tous les etats (${colisList.length})`
                : `${statusLabelOf(statusKey)} (${statusCounts[statusKey] || 0})`}
            </option>
          ))}
        </select>

        <select
          className="adminColisSelect"
          value={sortKey}
          onChange={(event) => {
            setSortKey(event.target.value);
            setCurrentPage(1);
          }}
          style={{ minWidth: 220, borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface-panel-soft)", color: "var(--text-primary)", padding: "10px 14px", outline: "none", fontSize: "0.9rem", fontWeight: 700 }}
        >
          {COLIS_SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              Trier: {option.label}
            </option>
          ))}
        </select>

        <div style={{ color: "var(--text-secondary)", fontSize: "0.84rem", fontWeight: 700 }}>
          {loading ? "Chargement..." : `${filtered.length} colis affiches`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
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
          borderRadius: 10,
          cursor: "pointer",
          fontWeight: 800,
          fontSize: "0.82rem",
          background: active ? "var(--success-bg)" : "var(--surface-card)",
          border: active ? "1px solid var(--success-border)" : "1px solid var(--border-soft)",
          color: active ? "var(--success)" : "var(--text-secondary)",
        }}
      >
        {depot.label}
      </button>
    );
  })}
</div>
      {loading ? (
        <p style={{ opacity: 0.6, textAlign: "center", paddingTop: 40 }}>Chargement...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 60, opacity: 0.5 }}>
          <p>Aucun colis confirme trouve</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {paginated.map((colis) => {
            const status = STATUS_STYLES[colis.statut] || STATUS_STYLES.en_attente;
            const produits = Array.isArray(colis.produits) ? colis.produits : [];
            const depotMeta = depotStyle(colis.depot_depart);

            return (
              <div
                key={colis.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedColis(colis)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedColis(colis);
                  }
                }}
                style={{ borderRadius: 14, border: "1px solid rgba(44,203,118,.2)", background: "rgba(44,203,118,.03)", overflow: "hidden", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedColis(colis);
                    }}
                    style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", fontSize: "1rem", padding: 0, minWidth: 20, fontWeight: 900 }}
                  >
                    &gt;
                  </button>
                  <div style={{ minWidth: 170 }}>
                    <div style={{ fontFamily: "monospace", color: "var(--accent-soft)", fontWeight: 800, fontSize: "0.88rem" }}>#{colis.numero_suivi}</div>
                    <span style={{ background: status.bg, border: `1px solid ${status.border}`, color: status.color, padding: "2px 9px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700, marginTop: 4, display: "inline-block" }}>
                      {status.label}
                    </span>
                  </div>
                  <span
  style={{
    background: depotMeta.bg,
    border: `1px solid ${depotMeta.border}`,
    color: depotMeta.color,
    padding: "2px 9px",
    borderRadius: 20,
    fontSize: "0.7rem",
    fontWeight: 800,
    marginTop: 6,
    display: "inline-block",
  }}
>
  {depotLabel(colis.depot_depart)}
</span>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{colis.nom_destinataire}</div>
                    <div style={{ opacity: 0.6, fontSize: "0.78rem" }}>{colis.telephone_destinataire}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 130, opacity: 0.75, fontSize: "0.83rem" }}>{colis.adresse_livraison}</div>
                  <div style={{ display: "flex", gap: 14, fontSize: "0.83rem" }}>
                    <div><span style={{ opacity: 0.5 }}>Poids </span><strong>{colis.poids} kg</strong></div>
                    <div><span style={{ opacity: 0.5 }}>Dimensions </span><strong style={{ color: "var(--accent-soft)" }}>{formatDimensions(colis)}</strong></div>
                    <div><span style={{ opacity: 0.5 }}>Prix </span><strong style={{ color: "var(--success)" }}>{colis.prix} DT</strong></div>
                    {produits.length > 0 && <div><span style={{ opacity: 0.5 }}>Produits </span><strong style={{ color: "var(--violet)" }}>{produits.length}</strong></div>}
                  </div>
                  <div style={{ marginLeft: "auto", background: "var(--success-bg)", border: "1px solid var(--success-border)", color: "var(--success)", padding: "4px 12px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 700 }}>
                    Confirme
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {pageCount > 1 && (
            <div className="admPagination" style={{ marginTop: 14 }}>
              <div className="admPaginationInfo">
                Affichage {pageStart}-{pageEnd} sur {filtered.length}
              </div>
              <div className="admPaginationBtns" aria-label="Pagination colis confirmes">
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
      {selectedColis ? (
        <AdminColisHistoryModal
          colis={selectedColis}
          onClose={() => setSelectedColis(null)}
        />
      ) : null}
    </div>
  );
}
