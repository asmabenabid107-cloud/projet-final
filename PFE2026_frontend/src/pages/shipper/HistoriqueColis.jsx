import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import colisService from "../../api/colisService";
import ThemeToggleButton from "../../components/ThemeToggleButton.jsx";
import { sanitizeHistoryEvent } from "../../utils/colisHistory.js";

const PAGE_SIZES = [10, 25, 50, 100];
const TONES = {
  created: { label: "Creation", accent: "#2d5bff", bg: "rgba(45,91,255,.10)", glow: "rgba(45,91,255,.18)" },
  pending: { label: "En attente", accent: "#f59e0b", bg: "rgba(245,158,11,.10)", glow: "rgba(245,158,11,.18)" },
  approved: { label: "Valide", accent: "#22c55e", bg: "rgba(34,197,94,.10)", glow: "rgba(34,197,94,.18)" },
  rejected: { label: "Refuse", accent: "#ef4444", bg: "rgba(239,68,68,.10)", glow: "rgba(239,68,68,.18)" },
  pickup: { label: "Prise en charge", accent: "#0ea5e9", bg: "rgba(14,165,233,.10)", glow: "rgba(14,165,233,.18)" },
  warehouse_in: { label: "Au depot", accent: "#6366f1", bg: "rgba(99,102,241,.10)", glow: "rgba(99,102,241,.18)" },
  warehouse_out: { label: "Sorti depot", accent: "#8b5cf6", bg: "rgba(139,92,246,.10)", glow: "rgba(139,92,246,.18)" },
  courier_call: { label: "Appel", accent: "#0891b2", bg: "rgba(8,145,178,.10)", glow: "rgba(8,145,178,.18)" },
  transit: { label: "En transit", accent: "#60a5fa", bg: "rgba(96,165,250,.10)", glow: "rgba(96,165,250,.18)" },
  rescheduled: { label: "A relivrer", accent: "#f97316", bg: "rgba(249,115,22,.10)", glow: "rgba(249,115,22,.18)" },
  delivery_issue: { label: "A relivrer", accent: "#f97316", bg: "rgba(249,115,22,.10)", glow: "rgba(249,115,22,.18)" },
  return_pending: { label: "Retour a confirmer", accent: "#8b5cf6", bg: "rgba(139,92,246,.10)", glow: "rgba(139,92,246,.18)" },
  delivered: { label: "Livre", accent: "#34d399", bg: "rgba(52,211,153,.10)", glow: "rgba(52,211,153,.18)" },
  returned: { label: "Retour expediteur", accent: "#a78bfa", bg: "rgba(167,139,250,.10)", glow: "rgba(167,139,250,.18)" },
  cancelled: { label: "Annule", accent: "#64748b", bg: "rgba(100,116,139,.10)", glow: "rgba(100,116,139,.18)" },
  neutral: { label: "Statut", accent: "#94a3b8", bg: "rgba(148,163,184,.10)", glow: "rgba(148,163,184,.18)" },
};

const gridTemplate = "42px 150px 170px 170px 150px 120px 190px minmax(280px,1fr)";

const keyOf = (value) => {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("attente")) return "pending";
  if (raw.includes("transit")) return "transit";
  if (raw.includes("call") || raw.includes("appel")) return "courier_call";
  if (raw.includes("relivr") || raw.includes("report")) return "rescheduled";
  if (raw.includes("livr")) return "delivered";
  if (raw.includes("retour")) return "returned";
  if (raw.includes("annul")) return "cancelled";
  return "neutral";
};

const toneOf = (value) => TONES[keyOf(value)] || TONES.neutral;

const stageToneOf = (value) => {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("return")) return TONES.returned;
  if (raw === "returned") return TONES.returned;
  if (raw.includes("warehouse") && raw.includes("out")) return TONES.warehouse_out;
  if (raw.includes("warehouse")) return TONES.warehouse_in;
  if (raw.includes("picked")) return TONES.pickup;
  if (raw.includes("deliver")) return TONES.delivered;
  return TONES.pending;
};

const stageLabelOf = (value) => {
  const raw = String(value || "").toLowerCase();
  if (raw === "return_pending") return "Depot retour expediteur";
  if (raw.includes("return")) return "Retour expediteur";
  if (raw === "returned") return "Retour expediteur";
  if (raw.includes("warehouse") && raw.includes("out")) return "Sorti du depot";
  if (raw.includes("warehouse")) return "Au depot";
  if (raw.includes("picked")) return "Pris en charge";
  if (raw.includes("deliver")) return "Arrive a destination";
  return "En attente de prise en charge";
};

const deliveryIssueReason = (value) => String(value || "").trim() || "Non renseigne";

const adminDecision = (note) => {
  const raw = String(note || "").toLowerCase();
  if (raw.includes("accept")) return "approved";
  if (raw.includes("refus")) return "rejected";
  return null;
};

const formatDate = (value) => {
  if (!value) return "Date indisponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  return date.toLocaleDateString("fr-TN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatDateTime = (value) => {
  if (!value) return "Date indisponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  return date.toLocaleString("fr-TN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPrice = (value) => `${Number(value ?? 0).toFixed(2)} DT`;

const designationOf = (produits) => {
  if (!Array.isArray(produits) || produits.length === 0) return "Colis standard";
  const names = produits
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (item && typeof item === "object") return item.designation || item.nom || item.name || item.label || "";
      return "";
    })
    .filter(Boolean);
  if (names.length === 0) return "Colis standard";
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
};

const compact = (value, length = 52) => (!value ? "-" : value.length <= length ? value : `${value.slice(0, length - 3)}...`);

const timeOf = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" });
};

const HIDDEN_HISTORY_TITLES = new Set([
  "Statut actuel: En transit",
  "Statut actuel: Livre",
]);

const shouldHideHistoryEvent = (event) =>
  HIDDEN_HISTORY_TITLES.has(String(event?.title || "").trim());

const historyToneOf = (event) => {
  if (event?.kind && TONES[event.kind]) return TONES[event.kind];
  return toneOf(event?.status || event?.statut);
};

const timelineOf = (colis) => {
  const historyEvents = Array.isArray(colis.history)
    ? colis.history
        .map((event, index) => {
          const cleanEvent = sanitizeHistoryEvent(event);
          if (!cleanEvent) return null;
          const tone = historyToneOf(cleanEvent);
          const kind = String(cleanEvent.kind || "").toLowerCase();
          return {
            id: cleanEvent.id ?? `history-${index}`,
            kind,
            title: cleanEvent.title || `Statut: ${tone.label}`,
            note: cleanEvent.note || "Mise a jour enregistree.",
            date: cleanEvent.date || cleanEvent.event_at || cleanEvent.created_at || cleanEvent.updated_at,
            tone,
          };
        })
        .filter(Boolean)
    : [];
  const historyKinds = new Set(historyEvents.map((event) => event.kind).filter(Boolean));
  const events = [];

  if (colis.created_at && !historyKinds.has("created")) {
    events.push({
      id: "created",
      title: "Colis ajoute au systeme",
      note: "Bordereau enregistre par l expediteur.",
      date: colis.created_at,
      tone: TONES.created,
    });
  }

  if (colis.warehouse_received_at && !historyKinds.has("warehouse_in")) {
    events.push({
      id: "warehouse-in-fallback",
      title: "Colis depose au depot",
      note: "Le colis est arrive au depot.",
      date: colis.warehouse_received_at,
      tone: TONES.warehouse_in,
    });
  }

  if (colis.out_for_delivery_at && !historyKinds.has("warehouse_out")) {
    events.push({
      id: "warehouse-out-fallback",
      title: "Colis sorti du depot",
      note: "Le colis a quitte le depot pour la livraison.",
      date: colis.out_for_delivery_at,
      tone: TONES.warehouse_out,
    });
  }
  if (colis.last_delivery_issue_at && !historyKinds.has("delivery_issue")) {
    events.push({
      id: "delivery-issue-fallback",
      title: "Livraison reportee",
      note: `Motif du jour: ${deliveryIssueReason(colis.last_delivery_issue_reason)}.`,
      date: colis.last_delivery_issue_at,
      tone: TONES.delivery_issue,
    });
  }
  if (colis.returned_at && !historyKinds.has("returned")) {
    events.push({
      id: "return-shipper-fallback",
      title: "Colis retourne a l expediteur",
      note: "Retour expediteur apres les tentatives reportees.",
      date: colis.returned_at,
      tone: TONES.returned,
    });
  }

  const decision = adminDecision(colis.admin_note);
  if (decision === "approved" && !historyKinds.has("approved")) {
    events.push({
      id: "approved",
      title: "Validation admin",
      note: "Le colis a ete accepte.",
      date: colis.admin_note_at || colis.updated_at,
      tone: TONES.approved,
    });
  }

  if (decision === "rejected" && !historyKinds.has("rejected")) {
    events.push({
      id: "rejected",
      title: "Refus admin",
      note: "Le colis a ete refuse.",
      date: colis.admin_note_at || colis.updated_at,
      tone: TONES.rejected,
    });
  }

  if (colis.statut) {
    const tone = toneOf(colis.statut);
    const statusEvent = {
      id: `status-${keyOf(colis.statut)}`,
      title: `Statut actuel: ${tone.label}`,
      note: "Dernier etat connu du colis.",
      date: colis.updated_at || colis.admin_note_at || colis.created_at,
      tone,
    };
    if (!shouldHideHistoryEvent(statusEvent)) {
      events.push(statusEvent);
    }
  }

  return [...events, ...historyEvents]
    .filter((event) => event.date)
    .filter((event) => !shouldHideHistoryEvent(event))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export default function HistoriqueColis() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let active = true;

    colisService.getAll()
      .then((data) => active && setList(Array.isArray(data) ? data : []))
      .catch((error) => console.error("Erreur historique colis:", error))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!detail) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setDetail(null);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [detail]);

  useEffect(() => {
    if (!detail || !panelRef.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("show");
        });
      },
      { root: panelRef.current, threshold: 0.16 },
    );

    panelRef.current.querySelectorAll(".historyReveal").forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [detail]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list;

    return list.filter((colis) => {
      const fields = [
        colis.numero_suivi,
        colis.nom_destinataire,
        colis.telephone_destinataire,
        colis.adresse_livraison,
        designationOf(colis.produits),
      ].map((value) => String(value || "").toLowerCase());

      return fields.some((field) => field.includes(query));
    });
  }, [list, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  const selectedTone = detail ? toneOf(detail.statut) : null;
  const timeline = detail ? timelineOf(detail) : [];

  return (
    <div className="historyPageShell">
      <div className="historyReveal show historyTableShell">
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: ".22em", opacity: 0.58, textTransform: "uppercase" }}>Historique</div>
            <h1 style={{ margin: "8px 0 0", fontSize: "1.45rem", fontWeight: 900 }}>Historique des colis</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <ThemeToggleButton compact />
            <button type="button" onClick={() => navigate("/expediteur/dashboard")} style={ghostBtn}>Retour</button>
          </div>
        </div>

        <div style={toolbarStyle}>
          <div style={{ color: "var(--text-secondary)", fontSize: ".9rem" }}>{loading ? "Chargement..." : `${filtered.length} colis disponibles`}</div>

          <label style={{ position: "relative", width: "min(460px,100%)", display: "block" }}>
            <span style={searchTagStyle}>Recherche</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par bordereau, client, telephone, designation..."
              style={searchInputStyle}
            />
          </label>
        </div>

        {loading ? (
          <div style={emptyStyle}>Chargement de l historique...</div>
        ) : filtered.length === 0 ? (
          <div style={emptyStyle}>Aucun colis trouve.</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 1320 }}>
                <div style={{ display: "grid", gridTemplateColumns: gridTemplate, borderBottom: "1px solid var(--border-subtle)" }}>
                  {["", "Date d'ajout", "Bordereaux", "Client", "Telephone", "Prix", "Designation", "Adresse"].map((label, index) => (
                    <div
                      key={label || index}
                      style={{
                        padding: "16px 18px",
                        fontSize: ".83rem",
                        fontWeight: 800,
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: index === 0 ? "center" : "flex-start",
                      }}
                    >
                      {index === 0 ? <div style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid var(--border-strong)" }} /> : label}
                    </div>
                  ))}
                </div>

                {rows.map((colis, index) => {
                  const active = selectedId === colis.id;
                  const tone = toneOf(colis.statut);
                  const selectedStyle = active
                    ? { background: "var(--accent-bg)", boxShadow: "inset 0 0 0 1px rgba(110,168,255,.22)" }
                    : { background: "transparent", boxShadow: "none" };

                  const cells = [
                    formatDate(colis.created_at),
                    colis.numero_suivi,
                    colis.nom_destinataire,
                    colis.telephone_destinataire,
                    formatPrice(colis.prix),
                    designationOf(colis.produits),
                    compact(colis.adresse_livraison),
                  ];

                  return (
                    <div
                      key={colis.id}
                      onClick={() => {
                        setSelectedId(colis.id);
                        setDetail(colis);
                      }}
                      style={{ display: "grid", gridTemplateColumns: gridTemplate, cursor: "pointer" }}
                    >
                      <div style={{ ...cellBase, ...selectedStyle, justifyContent: "center", animation: `historyRowIn .3s ease ${index * 28}ms both` }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid var(--border-strong)", background: active ? "rgba(110,168,255,.28)" : "transparent" }} />
                      </div>

                      {cells.map((cell, cellIndex) => (
                        <div
                          key={`${colis.id}-${cellIndex}`}
                          style={{
                            ...cellBase,
                            ...selectedStyle,
                            color: cellIndex === 1 ? "var(--accent-soft)" : "var(--text-primary)",
                            fontWeight: cellIndex === 1 ? 800 : 600,
                            animation: `historyRowIn .3s ease ${index * 28}ms both`,
                          }}
                        >
                          {cellIndex === 2 ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <span style={{ width: 9, height: 9, borderRadius: "50%", background: tone.accent, boxShadow: `0 0 0 5px ${tone.glow}`, flexShrink: 0 }} />
                              <span style={truncate}>{cell}</span>
                            </div>
                          ) : (
                            <span style={truncate}>{cell}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={footerStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Lignes par page :</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  style={selectStyle}
                >
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </div>

              <span>{filtered.length === 0 ? 0 : start + 1}-{Math.min(start + pageSize, filtered.length)} of {filtered.length}</span>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} style={{ ...pageBtn, opacity: currentPage === 1 ? 0.45 : 1 }}>&lt;</button>
                <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} style={{ ...pageBtn, opacity: currentPage === pageCount ? 0.45 : 1 }}>&gt;</button>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && selectedTone && (
        <>
          <div onClick={() => setDetail(null)} style={backdropStyle} />

          <div style={modalWrapStyle}>
            <div ref={panelRef} className="historyDetailPanel">
              <div className="historyReveal show historyDetailHero">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: ".78rem", color: "var(--text-secondary)", letterSpacing: ".16em", textTransform: "uppercase" }}>Detail historique</div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <h2 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 950 }}>{detail.nom_destinataire}</h2>
                      <span style={codePillStyle}>#{detail.numero_suivi}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ background: selectedTone.bg, border: `1px solid ${selectedTone.accent}`, color: selectedTone.accent, padding: "6px 12px", borderRadius: 999, fontSize: ".84rem", fontWeight: 800 }}>{selectedTone.label}</span>
                      <span style={{ background: `${stageToneOf(detail.tracking_stage).bg}`, border: `1px solid ${stageToneOf(detail.tracking_stage).accent}`, color: stageToneOf(detail.tracking_stage).accent, padding: "6px 12px", borderRadius: 999, fontSize: ".84rem", fontWeight: 800 }}>{stageLabelOf(detail.tracking_stage)}</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: ".92rem" }}>Ajoute le {formatDateTime(detail.created_at)}</span>
                    </div>
                  </div>

                  <button type="button" onClick={() => setDetail(null)} style={closeBtnStyle}>X</button>
                </div>
              </div>

              <div style={{ padding: "30px 38px 42px" }}>
                <section className="historyReveal" style={{ marginBottom: 30 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
                    <div>
                      <div style={{ color: "var(--text-secondary)", fontSize: ".78rem", letterSpacing: ".14em", textTransform: "uppercase" }}>Timeline</div>
                      <div style={{ marginTop: 6, fontSize: "1.05rem", fontWeight: 900 }}>Historique detaille</div>
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: ".88rem" }}>La frise alterne a gauche et a droite avec le rouge reserve aux refus.</div>
                  </div>

                  <div className="historyTimeline">
                    {timeline.map((event, index) => (
                      <div key={`${event.id}-${index}`} className={`historyReveal historyTimelineRow ${index % 2 === 0 ? "left" : "right"}`}>
                        <div className="historyTimelineDate" style={{ color: event.tone.accent }}>
                          <div style={{ fontSize: ".78rem", fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>{formatDate(event.date)}</div>
                          <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: ".78rem" }}>{timeOf(event.date)}</div>
                        </div>

                        <div className="historyTimelineDotWrap">
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: event.tone.accent,
                              boxShadow: `0 0 0 8px ${event.tone.glow}`,
                              border: "2px solid var(--surface-card)",
                              zIndex: 1,
                            }}
                          />
                        </div>

                        <div
                          className="historyTimelineCard"
                          style={{
                            borderRadius: 22,
                            border: `1px solid ${event.tone.accent}33`,
                            background: `linear-gradient(180deg, ${event.tone.bg}, var(--surface-panel-faint))`,
                            boxShadow: `0 22px 42px ${event.tone.glow}`,
                            padding: "18px 20px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ fontSize: "1rem", fontWeight: 900 }}>{event.title}</div>
                            <span style={{ color: event.tone.accent, fontSize: ".78rem", fontWeight: 800, background: `${event.tone.accent}18`, padding: "4px 10px", borderRadius: 999 }}>{event.tone.label}</span>
                          </div>

                          <div style={{ marginTop: 10, color: "var(--text-secondary)", fontSize: ".92rem", lineHeight: 1.65 }}>{event.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="historyReveal">
                  <div style={{ color: "var(--text-secondary)", fontSize: ".78rem", letterSpacing: ".14em", textTransform: "uppercase" }}>Details colis</div>
                  <div style={{ marginTop: 8, fontSize: "1.05rem", fontWeight: 900 }}>Informations complementaires</div>

                  <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                    {[
                      ["Client", detail.nom_destinataire],
                      ["Telephone", detail.telephone_destinataire],
                      ["Prix", formatPrice(detail.prix)],
                      ["Designation", designationOf(detail.produits)],
                      ["Adresse", detail.adresse_livraison],
                      ["Email", detail.email_destinataire || "Non renseigne"],
                      ["Poids", `${detail.poids} kg`],
                      ["Etape actuelle", stageLabelOf(detail.tracking_stage)],
                      ["Prise en charge", detail.picked_up_at ? formatDateTime(detail.picked_up_at) : "Pas encore"],
                      ["Entre au depot", detail.warehouse_received_at ? formatDateTime(detail.warehouse_received_at) : "Pas encore"],
                      ["Sorti du depot", detail.out_for_delivery_at ? formatDateTime(detail.out_for_delivery_at) : "Pas encore"],
                      ["Tentatives reportees", Number(detail.delivery_issue_count ?? 0)],
                      ["Dernier motif", deliveryIssueReason(detail.last_delivery_issue_reason)],
                      ["Dernier report", detail.last_delivery_issue_at ? formatDateTime(detail.last_delivery_issue_at) : "Pas encore"],
                      ["Retour expediteur", detail.returned_at ? formatDateTime(detail.returned_at) : "Pas encore"],
                      ["Livre au client", detail.delivered_at ? formatDateTime(detail.delivered_at) : "Pas encore"],
                      ["Admin note", detail.admin_note || "Aucune note"],
                    ].map(([label, value], index) => (
                      <div key={label} className="historyReveal" style={{ borderRadius: 18, border: "1px solid var(--border-subtle)", background: "var(--surface-panel-faint)", padding: "16px 18px", animationDelay: `${index * 50}ms` }}>
                        <div style={{ color: "var(--text-secondary)", fontSize: ".78rem", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
                        <div style={{ fontSize: ".96rem", lineHeight: 1.6, fontWeight: 700, wordBreak: "break-word" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: "18px 22px",
  borderBottom: "1px solid var(--border-subtle)",
  background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01))",
  flexWrap: "wrap",
};

const toolbarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: "16px 20px",
  borderBottom: "1px solid var(--border-subtle)",
  background: "var(--surface-panel-faint)",
  flexWrap: "wrap",
};

const searchTagStyle = {
  position: "absolute",
  right: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--text-secondary)",
  fontSize: ".7rem",
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
};

const searchInputStyle = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid var(--border-soft)",
  background: "var(--input-bg-strong)",
  color: "var(--text-primary)",
  padding: "12px 98px 12px 14px",
  fontSize: ".92rem",
  outline: "none",
};

const footerStyle = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 18,
  padding: "14px 20px 16px",
  color: "var(--text-secondary)",
  fontSize: ".84rem",
  flexWrap: "wrap",
};

const selectStyle = {
  border: "1px solid var(--border-soft)",
  borderRadius: 10,
  background: "var(--input-bg-strong)",
  color: "var(--text-primary)",
  padding: "6px 10px",
};

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "var(--overlay-bg)",
  backdropFilter: "blur(10px)",
  zIndex: 70,
  animation: "historyFadeIn .22s ease",
};

const modalWrapStyle = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 20,
  zIndex: 80,
  pointerEvents: "none",
};

const codePillStyle = {
  fontFamily: "monospace",
  fontSize: ".92rem",
  padding: "6px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,.05)",
  border: "1px solid var(--border-soft)",
  color: "var(--accent-soft)",
};

const closeBtnStyle = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border: "1px solid var(--border-soft)",
  background: "var(--surface-panel-faint)",
  color: "var(--text-primary)",
  fontSize: "1rem",
  pointerEvents: "auto",
};

const ghostBtn = {
  borderRadius: 14,
  border: "1px solid var(--border-soft)",
  background: "var(--surface-panel-faint)",
  color: "var(--text-primary)",
  fontWeight: 700,
  padding: "11px 16px",
};

const emptyStyle = {
  padding: "56px 20px",
  textAlign: "center",
  color: "var(--text-secondary)",
};

const cellBase = {
  padding: "13px 18px",
  borderBottom: "1px solid var(--border-subtle)",
  display: "flex",
  alignItems: "center",
  minWidth: 0,
};

const truncate = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const pageBtn = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid var(--border-soft)",
  background: "var(--surface-panel-faint)",
  color: "var(--text-primary)",
};
