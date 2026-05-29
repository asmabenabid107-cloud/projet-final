import { adminNoteLabel, isApprovedAdminNote, isRejectedAdminNote } from "../../constants/adminDecision.js";
import { sanitizeHistoryEvent } from "../../utils/colisHistory.js";

const STATUS_META = {
  en_attente: { label: "En attente", color: "var(--warning)", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)" },
  en_transit: { label: "En transit", color: "var(--accent-soft)", bg: "rgba(110,168,255,0.12)", border: "rgba(110,168,255,0.30)" },
  a_relivrer: { label: "A relivrer", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.30)" },
  livre: { label: "Livre", color: "var(--success)", bg: "rgba(44,203,118,0.12)", border: "rgba(44,203,118,0.30)" },
  annule: { label: "Annule", color: "var(--danger)", bg: "rgba(255,95,95,0.12)", border: "rgba(255,95,95,0.30)" },
  retour: { label: "Retour", color: "var(--violet)", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.30)" },
  neutral: { label: "Statut inconnu", color: "var(--text-secondary)", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)" },
};

const STAGE_META = {
  pending_pickup: { label: "En attente de prise en charge", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)" },
  picked_up: { label: "Pris en charge", color: "#0ea5e9", bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.30)" },
  at_warehouse: { label: "Au depot", color: "#6366f1", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.30)" },
  out_for_delivery: { label: "Sorti du depot", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.30)" },
  delivery_failed: { label: "Echec de livraison", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.30)" },
  returned_to_warehouse: { label: "Retour au depot", color: "#7c3aed", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.30)" },
  return_pending: { label: "Depot retour expediteur", color: "#7c3aed", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.30)" },
  returned: { label: "Retour expediteur", color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.30)" },
  delivered: { label: "Livre", color: "#16a34a", bg: "rgba(22,163,74,0.12)", border: "rgba(22,163,74,0.30)" },
  neutral: { label: "Etape inconnue", color: "var(--text-secondary)", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)" },
};

const EVENT_TONES = {
  created: { label: "Creation", color: "#2563eb", bg: "rgba(37,99,235,0.12)", border: "rgba(37,99,235,0.30)" },
  pending: { label: "En attente", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)" },
  approved: { label: "Accepte", color: "#16a34a", bg: "rgba(22,163,74,0.12)", border: "rgba(22,163,74,0.30)" },
  rejected: { label: "Refuse", color: "#dc2626", bg: "rgba(220,38,38,0.12)", border: "rgba(220,38,38,0.30)" },
  pickup: { label: "Prise en charge", color: "#0ea5e9", bg: "rgba(14,165,233,0.12)", border: "rgba(14,165,233,0.30)" },
  warehouse_in: { label: "Depot", color: "#6366f1", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.30)" },
  warehouse_out: { label: "Sortie depot", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.30)" },
  courier_call: { label: "Appel", color: "#0891b2", bg: "rgba(8,145,178,0.12)", border: "rgba(8,145,178,0.30)" },
  rescheduled: { label: "A relivrer", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.30)" },
  delivery_issue: { label: "A relivrer", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.30)" },
  delivery_failed: { label: "Echec", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.30)" },
  return_warehouse: { label: "Retour depot", color: "#7c3aed", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.30)" },
  return_pending: { label: "Retour a confirmer", color: "#7c3aed", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.30)" },
  delivered: { label: "Livre", color: "#16a34a", bg: "rgba(22,163,74,0.12)", border: "rgba(22,163,74,0.30)" },
  returned: { label: "Retour", color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.30)" },
  cancelled: { label: "Annule", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.30)" },
  neutral: { label: "Evenement", color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)" },
};

function normalizeStatusKey(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("attente")) return "en_attente";
  if (raw.includes("transit")) return "en_transit";
  if (raw.includes("relivr") || raw.includes("report")) return "a_relivrer";
  if (raw.includes("livr")) return "livre";
  if (raw.includes("annul")) return "annule";
  if (raw.includes("retour")) return "retour";
  return "neutral";
}

function normalizeStageKey(value) {
  const raw = String(value || "").toLowerCase();
  if (STAGE_META[raw]) return raw;
  if (raw.includes("picked")) return "picked_up";
  if (raw.includes("warehouse") && raw.includes("out")) return "out_for_delivery";
  if (raw.includes("warehouse")) return "at_warehouse";
  if (raw.includes("deliver") && raw.includes("failed")) return "delivery_failed";
  if (raw.includes("deliver")) return "delivered";
  if (raw.includes("return") && raw.includes("warehouse")) return "returned_to_warehouse";
  if (raw.includes("return")) return "returned";
  return "pending_pickup";
}

function toneOfEvent(kind) {
  const raw = String(kind || "").toLowerCase();
  if (EVENT_TONES[raw]) return EVENT_TONES[raw];
  if (raw.includes("call") || raw.includes("appel")) return EVENT_TONES.courier_call;
  if (raw.includes("issue") || raw.includes("relivr") || raw.includes("report")) return EVENT_TONES.delivery_issue;
  if (raw.includes("retour")) return EVENT_TONES.returned;
  if (raw.includes("livr")) return EVENT_TONES.delivered;
  if (raw.includes("attente")) return EVENT_TONES.pending;
  return EVENT_TONES.neutral;
}

function formatDateTime(value) {
  if (!value) return "Non renseigne";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigne";
  return date.toLocaleString("fr-TN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} DT` : "-";
}

function adminStateMeta(note) {
  if (isApprovedAdminNote(note)) {
    return { label: "Accepte", color: "var(--success)", bg: "rgba(44,203,118,0.12)", border: "rgba(44,203,118,0.30)" };
  }
  if (isRejectedAdminNote(note)) {
    return { label: "Refuse", color: "var(--danger)", bg: "rgba(255,95,95,0.12)", border: "rgba(255,95,95,0.30)" };
  }
  return { label: "En attente", color: "var(--warning)", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.30)" };
}

function timelineOf(colis) {
  const historyEvents = Array.isArray(colis.history)
    ? colis.history
        .map((event, index) => {
          const cleanEvent = sanitizeHistoryEvent(event);
          if (!cleanEvent) return null;
          const kind = String(cleanEvent.kind || "").toLowerCase();
          return {
            id: cleanEvent.id ?? `event-${index}`,
            kind,
            title: cleanEvent.title || "Mise a jour",
            note: cleanEvent.note || "",
            date: cleanEvent.date || cleanEvent.event_at || cleanEvent.created_at || cleanEvent.updated_at,
            tone: toneOfEvent(cleanEvent.kind || cleanEvent.statut || cleanEvent.status),
          };
        })
        .filter(Boolean)
    : [];
  const historyKinds = new Set(historyEvents.map((event) => event.kind).filter(Boolean));
  const events = [];
  if (colis.created_at && !historyKinds.has("created")) {
    events.push({ id: "created", title: "Colis ajoute", note: "Creation du colis par l expediteur.", date: colis.created_at, tone: EVENT_TONES.created });
  }
  if (isApprovedAdminNote(colis.admin_note) && !historyKinds.has("approved")) {
    events.push({ id: "approved", title: "Validation admin", note: "Le colis a ete accepte par l admin.", date: colis.admin_note_at || colis.updated_at, tone: EVENT_TONES.approved });
  }
  if (isRejectedAdminNote(colis.admin_note) && !historyKinds.has("rejected")) {
    events.push({ id: "rejected", title: "Refus admin", note: "Le colis a ete refuse par l admin.", date: colis.admin_note_at || colis.updated_at, tone: EVENT_TONES.rejected });
  }
  if (colis.warehouse_received_at && !historyKinds.has("warehouse_in")) {
    events.push({ id: "warehouse-in", title: "Colis depose au depot", note: "Le colis est arrive au depot.", date: colis.warehouse_received_at, tone: EVENT_TONES.warehouse_in });
  }
  if (colis.out_for_delivery_at && !historyKinds.has("warehouse_out")) {
    events.push({ id: "warehouse-out", title: "Colis sorti du depot", note: "Le colis a quitte le depot pour la livraison.", date: colis.out_for_delivery_at, tone: EVENT_TONES.warehouse_out });
  }
  if ((colis.last_delivery_issue_at || colis.failed_delivery_at) && !historyKinds.has("delivery_issue")) {
    const reason = colis.last_delivery_issue_reason ? ` Motif: ${colis.last_delivery_issue_reason}.` : "";
    events.push({ id: "delivery-issue", title: "Livraison reportee", note: `Le colis est revenu au depot pour une nouvelle tentative.${reason}`, date: colis.last_delivery_issue_at || colis.failed_delivery_at, tone: EVENT_TONES.delivery_issue });
  }
  if (colis.return_warehouse_received_at && !historyKinds.has("return_warehouse")) {
    events.push({ id: "return-warehouse", title: "Retour depot", note: "Le colis est revenu au depot.", date: colis.return_warehouse_received_at, tone: EVENT_TONES.return_warehouse });
  }
  if ((colis.returned_at || colis.returned_to_shipper_at) && !historyKinds.has("returned")) {
    events.push({ id: "returned", title: "Retour expediteur", note: "Le colis a ete remis a l expediteur.", date: colis.returned_at || colis.returned_to_shipper_at, tone: EVENT_TONES.returned });
  }
  if (colis.delivered_at && !historyKinds.has("delivered")) {
    events.push({ id: "delivered", title: "Livraison", note: "Le colis a ete livre au destinataire.", date: colis.delivered_at, tone: EVENT_TONES.delivered });
  }
  return [...events, ...historyEvents]
    .filter((event) => event.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function ProductTable({ produits }) {
  if (!Array.isArray(produits) || produits.length === 0) {
    return null;
  }

  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: "0.82rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
        Produits ({produits.length})
      </div>
      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", background: "var(--surface-card)", padding: "8px 14px" }}>
          {["Produit", "Taille", "Qte", "Prix/u", "Total"].map((label) => (
            <div key={label} style={{ fontSize: "0.7rem", opacity: 0.55, textTransform: "uppercase", fontWeight: 700 }}>
              {label}
            </div>
          ))}
        </div>
        {produits.map((product, index) => (
          <div
            key={`${product.nom || "produit"}-${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              padding: "10px 14px",
              borderTop: "1px solid rgba(255,255,255,.06)",
              background: index % 2 === 0 ? "transparent" : "rgba(255,255,255,.02)",
            }}
          >
            <div style={{ fontWeight: 700 }}>{product.nom || "-"}</div>
            <div style={{ opacity: 0.85 }}>{product.taille || "-"}</div>
            <div style={{ opacity: 0.85 }}>x{Number(product.quantite) || 0}</div>
            <div style={{ opacity: 0.85 }}>{formatMoney(product.prix)}</div>
            <div style={{ fontWeight: 800, color: "var(--accent-soft)" }}>
              {formatMoney((Number(product.quantite) || 0) * (Number(product.prix) || 0))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminColisHistoryPanel({ colis }) {
  const status = STATUS_META[normalizeStatusKey(colis.statut)] || STATUS_META.neutral;
  const stage = STAGE_META[normalizeStageKey(colis.tracking_stage)] || STAGE_META.neutral;
  const adminState = adminStateMeta(colis.admin_note);
  const produits = Array.isArray(colis.produits) ? colis.produits : [];
  const timeline = timelineOf(colis);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={{ borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--surface-panel-soft)", padding: "14px 16px" }}>
          <div style={{ fontSize: "0.75rem", opacity: 0.6, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Statut colis</div>
          <span style={{ background: status.bg, border: `1px solid ${status.border}`, color: status.color, padding: "5px 12px", borderRadius: 999, fontSize: "0.8rem", fontWeight: 800 }}>
            {status.label}
          </span>
        </div>
        <div style={{ borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--surface-panel-soft)", padding: "14px 16px" }}>
          <div style={{ fontSize: "0.75rem", opacity: 0.6, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Etat tracking</div>
          <span style={{ background: stage.bg, border: `1px solid ${stage.border}`, color: stage.color, padding: "5px 12px", borderRadius: 999, fontSize: "0.8rem", fontWeight: 800 }}>
            {stage.label}
          </span>
        </div>
        <div style={{ borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--surface-panel-soft)", padding: "14px 16px" }}>
          <div style={{ fontSize: "0.75rem", opacity: 0.6, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Decision admin</div>
          <span style={{ background: adminState.bg, border: `1px solid ${adminState.border}`, color: adminState.color, padding: "5px 12px", borderRadius: 999, fontSize: "0.8rem", fontWeight: 800 }}>
            {adminNoteLabel(colis.admin_note) || adminState.label}
          </span>
        </div>
        <div style={{ borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--surface-panel-soft)", padding: "14px 16px" }}>
          <div style={{ fontSize: "0.75rem", opacity: 0.6, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Numero de suivi</div>
          <div style={{ fontFamily: "monospace", fontWeight: 800, color: "var(--accent-soft)" }}>#{colis.numero_suivi}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {[
          ["Destinataire", colis.nom_destinataire || "-"],
          ["Telephone", colis.telephone_destinataire || "-"],
          ["Adresse", colis.adresse_livraison || "-"],
          ["Email", colis.email_destinataire || "Non renseigne"],
          ["Poids", `${colis.poids ?? "-"} kg`],
          ["Prix", formatMoney(colis.prix)],
          ["Cree le", formatDateTime(colis.created_at)],
          ["Validation admin", formatDateTime(colis.admin_note_at)],
          ["Prise en charge", formatDateTime(colis.picked_up_at)],
          ["Entre au depot", formatDateTime(colis.warehouse_received_at)],
          ["Sorti du depot", formatDateTime(colis.out_for_delivery_at)],
          ["Tentatives reportees", colis.delivery_issue_count ?? 0],
          ["Dernier motif", colis.last_delivery_issue_reason || "Aucun motif"],
          ["Dernier report", formatDateTime(colis.last_delivery_issue_at)],
          ["Livre le", formatDateTime(colis.delivered_at)],
          ["Retour depot", formatDateTime(colis.return_warehouse_received_at)],
          ["Retour expediteur", formatDateTime(colis.returned_at || colis.returned_to_shipper_at)],
        ].map(([label, value]) => (
          <div key={label} style={{ borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--surface-panel-soft)", padding: "14px 16px" }}>
            <div style={{ fontSize: "0.75rem", opacity: 0.6, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
            <div style={{ fontWeight: 700, lineHeight: 1.5, wordBreak: "break-word" }}>{value}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontWeight: 800, fontSize: "0.82rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Historique et changements d etat
        </div>
        {timeline.length === 0 ? (
          <div style={{ borderRadius: 12, border: "1px dashed var(--border-subtle)", background: "var(--surface-panel-soft)", padding: "16px 18px", opacity: 0.7 }}>
            Aucun historique disponible pour ce colis.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {timeline.map((event) => (
              <div key={event.id} style={{ borderRadius: 12, border: `1px solid ${event.tone.border}`, background: event.tone.bg, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, color: event.tone.color }}>{event.title}</div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, opacity: 0.85 }}>{formatDateTime(event.date)}</span>
                </div>
                <div style={{ marginTop: 8, lineHeight: 1.5, opacity: 0.88 }}>{event.note || "Mise a jour enregistree."}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductTable produits={produits} />
    </div>
  );
}
