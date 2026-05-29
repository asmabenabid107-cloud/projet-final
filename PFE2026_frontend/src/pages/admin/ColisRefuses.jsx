import { useEffect, useState } from "react";

import { api } from "../../api/client.js";
import { isRejectedAdminNote } from "../../constants/adminDecision.js";
import AdminColisHistoryPanel from "./AdminColisHistoryPanel.jsx";

const STATUS_STYLES = {
  en_attente: { label: "En attente", color: "var(--warning)", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.35)" },
  en_transit: { label: "En transit", color: "var(--accent-soft)", bg: "rgba(110,168,255,0.15)", border: "rgba(110,168,255,0.35)" },
  a_relivrer: { label: "A relivrer", color: "#f97316", bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.35)" },
  livre: { label: "Livre", color: "var(--success)", bg: "rgba(44,203,118,0.15)", border: "rgba(44,203,118,0.35)" },
  annule: { label: "Annule", color: "var(--danger)", bg: "rgba(255,95,95,0.15)", border: "rgba(255,95,95,0.35)" },
  retour: { label: "Retour", color: "var(--violet)", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.35)" },
};
const DEPOT_FILTERS = [
  { key: "all", label: "Tous les dépôts" },
  { key: "sousse", label: "Dépôt Sousse" },
  { key: "kairouan", label: "Dépôt Kairouan" },
];

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
export default function ColisRefuses() {
  const [colisList, setColisList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    loadColis();
  }, []);

  const loadColis = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/colis");
      const all = Array.isArray(data) ? data : data?.items || [];
      setColisList(all.filter((colis) => isRejectedAdminNote(colis.admin_note)));
    } catch {
      console.error("Erreur chargement colis refuses");
    } finally {
      setLoading(false);
    }
  };

const filtered = colisList.filter((colis) => {
  const query = search.toLowerCase();

  const matchDepot =
    depotFilter === "all" || normalizeDepot(colis.depot_depart) === depotFilter;

  const matchSearch =
    !query ||
    colis.numero_suivi?.toLowerCase().includes(query) ||
    colis.nom_destinataire?.toLowerCase().includes(query) ||
    colis.adresse_livraison?.toLowerCase().includes(query) ||
    depotLabel(colis.depot_depart).toLowerCase().includes(query);

  return matchDepot && matchSearch;
});

  const toggleExpand = (id) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <div style={{ padding: "24px 28px", fontFamily: "system-ui, Arial, sans-serif", color: "var(--text-primary)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900 }}>Colis refuses</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.6, fontSize: "0.85rem" }}>
            {loading ? "Chargement..." : `${colisList.length} colis refuses`}
          </p>
        </div>
        <button
          onClick={loadColis}
          style={{ background: "rgba(255,95,95,.15)", border: "1px solid var(--danger-border)", color: "var(--danger)", borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontWeight: 700 }}
        >
          Rafraichir
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
  {DEPOT_FILTERS.map((depot) => {
    const active = depotFilter === depot.key;

    return (
      <button
        key={depot.key}
        type="button"
        onClick={() => setDepotFilter(depot.key)}
        style={{
          padding: "8px 16px",
          borderRadius: 10,
          cursor: "pointer",
          fontWeight: 800,
          fontSize: "0.82rem",
          background: active ? "rgba(255,95,95,.14)" : "rgba(255,255,255,.04)",
          border: active ? "1px solid rgba(255,95,95,.45)" : "1px solid rgba(255,255,255,.10)",
          color: active ? "var(--danger)" : "rgba(232,238,252,0.65)",
        }}
      >
        {depot.label}
      </button>
    );
  })}
</div>

      <div style={{ marginBottom: 20, padding: "16px 20px", borderRadius: 14, background: "var(--danger-bg)", border: "1px solid rgba(255,95,95,.25)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "var(--danger)" }}>{colisList.length}</div>
        <div>
          <div style={{ fontWeight: 800, color: "var(--danger)" }}>Colis refuses par l admin</div>
          <div style={{ opacity: 0.6, fontSize: "0.82rem" }}>L admin peut ouvrir chaque colis pour revoir son etat et tout son historique.</div>
        </div>
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Rechercher par numero, nom, adresse..."
        style={{ width: "100%", maxWidth: 500, borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface-panel-soft)", color: "var(--text-primary)", padding: "10px 14px", outline: "none", fontSize: "0.9rem", marginBottom: 20, boxSizing: "border-box" }}
      />

      {loading ? (
        <p style={{ opacity: 0.6, textAlign: "center", paddingTop: 40 }}>Chargement...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 60, opacity: 0.5 }}>
          <p>Aucun colis refuse trouve</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((colis) => {
            const status = STATUS_STYLES[colis.statut] || STATUS_STYLES.annule;
            const isOpen = expanded === colis.id;
            const produits = Array.isArray(colis.produits) ? colis.produits : [];
            const depotMeta = depotStyle(colis.depot_depart);

            return (
              <div key={colis.id} style={{ borderRadius: 14, border: "1px solid rgba(255,95,95,.2)", background: "rgba(255,95,95,.03)", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", flexWrap: "wrap" }}>
                  <button onClick={() => toggleExpand(colis.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "1rem", padding: 0, minWidth: 20 }}>
                    {isOpen ? "v" : ">"}
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
                    <div><span style={{ opacity: 0.5 }}>Prix </span><strong style={{ color: "var(--danger)", textDecoration: "line-through", opacity: 0.7 }}>{colis.prix} DT</strong></div>
                    {produits.length > 0 && <div><span style={{ opacity: 0.5 }}>Produits </span><strong style={{ color: "var(--violet)" }}>{produits.length}</strong></div>}
                  </div>
                  <div style={{ marginLeft: "auto", background: "rgba(255,95,95,.12)", border: "1px solid var(--danger-border)", color: "var(--danger)", padding: "4px 12px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 700 }}>
                    Refuse
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "16px 20px", background: "var(--surface-inset-strong)" }}>
                    <AdminColisHistoryPanel colis={colis} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
