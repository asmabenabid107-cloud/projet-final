import { adminNoteLabel, isApprovedAdminNote, isRejectedAdminNote } from "../../constants/adminDecision.js";
import { sanitizeHistoryEvent } from "../../utils/colisHistory.js";

// ─── Meta maps ────────────────────────────────────────────────────────────────

const STATUS_META = {
  en_attente: { label: "En attente",  color: "#92400e", bg: "#fef3c7", border: "#fde68a" },
  en_transit: { label: "En transit",  color: "#1e40af", bg: "#dbeafe", border: "#bfdbfe" },
  a_relivrer: { label: "À relivrer", color: "#9a3412", bg: "#ffedd5", border: "#fed7aa" },
  livre:      { label: "Livré",       color: "#14532d", bg: "#dcfce7", border: "#bbf7d0" },
  annule:     { label: "Annulé",      color: "#7f1d1d", bg: "#fee2e2", border: "#fecaca" },
  retour:     { label: "Retour",      color: "#4c1d95", bg: "#ede9fe", border: "#ddd6fe" },
  neutral:    { label: "Inconnu",     color: "#374151", bg: "#f3f4f6", border: "#e5e7eb" },
};

const STAGE_META = {
  pending_pickup:        { label: "En attente de prise en charge" },
  picked_up:             { label: "Pris en charge" },
  at_warehouse:          { label: "Au dépôt" },
  out_for_delivery:      { label: "Sorti du dépôt" },
  delivery_failed:       { label: "Échec de livraison" },
  returned_to_warehouse: { label: "Retour au dépôt" },
  return_pending:        { label: "Dépôt retour expéditeur" },
  returned:              { label: "Retour expéditeur" },
  delivered:             { label: "Livré" },
  neutral:               { label: "Étape inconnue" },
};

const EVENT_TONES = {
  created:          { color: "#2563eb", dot: "#3b82f6" },
  pending:          { color: "#d97706", dot: "#f59e0b" },
  approved:         { color: "#16a34a", dot: "#22c55e" },
  rejected:         { color: "#dc2626", dot: "#ef4444" },
  pickup:           { color: "#0284c7", dot: "#0ea5e9" },
  warehouse_in:     { color: "#4f46e5", dot: "#6366f1" },
  warehouse_out:    { color: "#7c3aed", dot: "#8b5cf6" },
  courier_call:     { color: "#0891b2", dot: "#06b6d4" },
  rescheduled:      { color: "#ea580c", dot: "#f97316" },
  delivery_issue:   { color: "#ea580c", dot: "#f97316" },
  delivery_failed:  { color: "#ea580c", dot: "#f97316" },
  return_warehouse: { color: "#6d28d9", dot: "#7c3aed" },
  return_pending:   { color: "#6d28d9", dot: "#7c3aed" },
  delivered:        { color: "#15803d", dot: "#22c55e" },
  returned:         { color: "#7c3aed", dot: "#a855f7" },
  cancelled:        { color: "#dc2626", dot: "#ef4444" },
  neutral:          { color: "#6b7280", dot: "#9ca3af" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("fr-TN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("fr-TN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).replace(",", " ·");
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} DT` : "-";
}

function formatDimensionNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatDimensions(colis) {
  const l = formatDimensionNumber(colis?.longueur);
  const w = formatDimensionNumber(colis?.largeur);
  const h = formatDimensionNumber(colis?.hauteur);
  if (!l || !w || !h) return "Non définies";
  return `${l} × ${w} × ${h} cm`;
}

function adminStateMeta(note) {
  if (isApprovedAdminNote(note)) return { label: "Accepté",  color: "#14532d", bg: "#dcfce7", border: "#bbf7d0" };
  if (isRejectedAdminNote(note)) return { label: "Refusé",   color: "#7f1d1d", bg: "#fee2e2", border: "#fecaca" };
  return                                 { label: "En attente", color: "#92400e", bg: "#fef3c7", border: "#fde68a" };
}

function timelineOf(colis) {
  const historyEvents = Array.isArray(colis.history)
    ? colis.history.map((event, index) => {
        const cleanEvent = sanitizeHistoryEvent(event);
        if (!cleanEvent) return null;
        const kind = String(cleanEvent.kind || "").toLowerCase();
        return {
          id: cleanEvent.id ?? `event-${index}`,
          kind,
          title: cleanEvent.title || "Mise à jour",
          note: cleanEvent.note || "",
          date: cleanEvent.date || cleanEvent.event_at || cleanEvent.created_at || cleanEvent.updated_at,
          tone: toneOfEvent(cleanEvent.kind || cleanEvent.statut || cleanEvent.status),
        };
      }).filter(Boolean)
    : [];

  const historyKinds = new Set(historyEvents.map((e) => e.kind).filter(Boolean));
  const events = [];

  if (colis.created_at && !historyKinds.has("created"))
    events.push({ id: "created", title: "Colis ajouté", note: "Création du colis par l'expéditeur.", date: colis.created_at, tone: EVENT_TONES.created });
  if (isApprovedAdminNote(colis.admin_note) && !historyKinds.has("approved"))
    events.push({ id: "approved", title: "Validation admin", note: "Le colis a été accepté par l'admin.", date: colis.admin_note_at || colis.updated_at, tone: EVENT_TONES.approved });
  if (isRejectedAdminNote(colis.admin_note) && !historyKinds.has("rejected"))
    events.push({ id: "rejected", title: "Refus admin", note: "Le colis a été refusé par l'admin.", date: colis.admin_note_at || colis.updated_at, tone: EVENT_TONES.rejected });
  if (colis.warehouse_received_at && !historyKinds.has("warehouse_in"))
    events.push({ id: "warehouse-in", title: "Colis déposé au dépôt", note: "Le colis est arrivé au dépôt.", date: colis.warehouse_received_at, tone: EVENT_TONES.warehouse_in });
  if (colis.out_for_delivery_at && !historyKinds.has("warehouse_out"))
    events.push({ id: "warehouse-out", title: "Colis sorti du dépôt", note: "Le colis a quitté le dépôt pour la livraison.", date: colis.out_for_delivery_at, tone: EVENT_TONES.warehouse_out });
  if ((colis.last_delivery_issue_at || colis.failed_delivery_at) && !historyKinds.has("delivery_issue")) {
    const reason = colis.last_delivery_issue_reason ? ` Motif : ${colis.last_delivery_issue_reason}.` : "";
    events.push({ id: "delivery-issue", title: "Livraison reportée", note: `Le colis est revenu au dépôt pour une nouvelle tentative.${reason}`, date: colis.last_delivery_issue_at || colis.failed_delivery_at, tone: EVENT_TONES.delivery_issue });
  }
  if (colis.return_warehouse_received_at && !historyKinds.has("return_warehouse"))
    events.push({ id: "return-warehouse", title: "Retour dépôt", note: "Le colis est revenu au dépôt.", date: colis.return_warehouse_received_at, tone: EVENT_TONES.return_warehouse });
  if ((colis.returned_at || colis.returned_to_shipper_at) && !historyKinds.has("returned"))
    events.push({ id: "returned", title: "Retour expéditeur", note: "Le colis a été remis à l'expéditeur.", date: colis.returned_at || colis.returned_to_shipper_at, tone: EVENT_TONES.returned });
  if (colis.delivered_at && !historyKinds.has("delivered"))
    events.push({ id: "delivered", title: "Livraison", note: "Le colis a été livré au destinataire.", date: colis.delivered_at, tone: EVENT_TONES.delivered });

  return [...events, ...historyEvents]
    .filter((e) => e.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Light pill badge */
function Badge({ label, color, bg, border }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 999,
      fontSize: "0.75rem", fontWeight: 600,
      color, background: bg, border: `1px solid ${border}`,
    }}>
      {label}
    </span>
  );
}

/** A single info row: label + value */
function InfoRow({ label, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: "0.82rem", color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: accent ? "#16a34a" : "#0f172a", textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

/** Card wrapper */
function Card({ children, style }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 12,
      padding: "18px 20px",
      ...style,
    }}>
      {children}
    </div>
  );
}

/** Card section title */
function SectionTitle({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
      {icon && <span style={{ fontSize: "0.9rem", opacity: 0.7 }}>{icon}</span>}
      <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#475569" }}>
        {children}
      </span>
    </div>
  );
}

/** Horizontal milestone strip */
const MILESTONES = [
  { key: "admin",    label: "Validation admin",  icon: "🛡", field: "admin_note_at" },
  { key: "pickup",   label: "Prise en charge",   icon: "🚚", field: "picked_up_at" },
  { key: "depot",    label: "Entrée dépôt",      icon: "🏭", field: "warehouse_received_at" },
  { key: "sortie",   label: "Sortie dépôt",      icon: "📦", field: "out_for_delivery_at" },
  { key: "livraison",label: "Livraison",          icon: "✅", field: "delivered_at" },
  { key: "retour",   label: "Retour expéditeur",  icon: "↩", field: "returned_at" },
];




/** Products table */
function ProductTable({ produits }) {
  if (!Array.isArray(produits) || produits.length === 0) return null;

  return (
    <Card>
      <SectionTitle icon="🛍">Produits ({produits.length})</SectionTitle>
      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", background: "#f8fafc", padding: "8px 14px" }}>
          {["Produit", "Taille", "Qté", "Prix/u", "Total"].map((l) => (
            <div key={l} style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, color: "#64748b", letterSpacing: "0.05em" }}>{l}</div>
          ))}
        </div>
        {produits.map((p, i) => (
          <div key={`${p.nom}-${i}`} style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            padding: "10px 14px", borderTop: "1px solid #f1f5f9",
            background: i % 2 === 0 ? "#fff" : "#f8fafc",
          }}>
            <div style={{ fontWeight: 600, color: "#0f172a" }}>{p.nom || "-"}</div>
            <div style={{ color: "#475569" }}>{p.taille || "-"}</div>
            <div style={{ color: "#475569" }}>×{Number(p.quantite) || 0}</div>
            <div style={{ color: "#475569" }}>{formatMoney(p.prix)}</div>
            <div style={{ fontWeight: 700, color: "#16a34a" }}>{formatMoney((Number(p.quantite) || 0) * (Number(p.prix) || 0))}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminColisHistoryPanel({ colis }) {
  const status    = STATUS_META[normalizeStatusKey(colis.statut)] || STATUS_META.neutral;
  const adminState = adminStateMeta(colis.admin_note);
  const produits  = Array.isArray(colis.produits) ? colis.produits : [];
  const timeline  = timelineOf(colis);
  const createdAt = formatDateShort(colis.created_at);

  return (
    <div style={{ display: "grid", gap: 16, fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a" }}>

      {/* ── Header card ── */}
      <Card>
        {/* Tracking number + date */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#2563eb", fontFamily: "monospace" }}>
            #{colis.numero_suivi}
          </div>
          {createdAt && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "#64748b" }}>
              <span>📅</span>
              <span>Créé le {createdAt}</span>
            </div>
          )}
        </div>

        {/* Status badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Badge label={status.label} color={status.color} bg={status.bg} border={status.border} />
          <Badge
            label={`En attente de prise en charge`}
            color="#92400e" bg="#fef3c7" border="#fde68a"
          />
          <Badge
            label={adminNoteLabel(colis.admin_note) || adminState.label}
            color={adminState.color} bg={adminState.bg} border={adminState.border}
          />
        </div>
      </Card>

      {/* ── Destinataire + Informations Colis ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>

        {/* Destinataire */}
        <Card>
          <SectionTitle icon="👤">Destinataire</SectionTitle>
          <InfoRow label="Nom"       value={colis.nom_destinataire || "-"} />
          <InfoRow label="Téléphone" value={colis.telephone_destinataire || "-"} />
          <InfoRow label="Email"     value={colis.email_destinataire || "Non renseigné"} />
          <InfoRow label="Adresse"   value={colis.adresse_livraison || "-"} />
        </Card>

        {/* Informations colis */}
        <Card>
          <SectionTitle icon="📦">Informations colis</SectionTitle>
          <InfoRow label="Poids"               value={colis.poids != null ? `${colis.poids} kg` : "-"} />
          <InfoRow label="Dimensions"          value={formatDimensions(colis)} />
          <InfoRow label="Prix"                value={formatMoney(colis.prix)} accent />
          <InfoRow label="Tentatives reportées" value={String(colis.delivery_issue_count ?? 0)} />
          <InfoRow label="Dernier motif"        value={colis.last_delivery_issue_reason || "Aucun motif"} />
        </Card>
      </div>

     

   

      {/* ── Produits ── */}
      <ProductTable produits={produits} />
    </div>
  );
}