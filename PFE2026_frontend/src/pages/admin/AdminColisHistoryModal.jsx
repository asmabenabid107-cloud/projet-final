import { createElement } from "react";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  MapPin,
  PackageCheck,
  Phone,
  PhoneCall,
  Route,
  Truck,
  Undo2,
  UserRound,
  Warehouse,
  WalletCards,
  X,
} from "lucide-react";

import { sanitizeHistoryEvent } from "../../utils/colisHistory.js";

const EVENT_TONES = {
  created: { label: "Creation", accent: "oklch(56% 0.18 255)", bg: "rgba(37,99,235,0.12)", icon: PackageCheck },
  pending: { label: "En attente", accent: "oklch(71% 0.18 78)", bg: "rgba(245,158,11,0.14)", icon: Clock3 },
  approved: { label: "Valide", accent: "oklch(63% 0.18 151)", bg: "rgba(22,163,74,0.14)", icon: CheckCircle2 },
  rejected: { label: "Refuse", accent: "oklch(58% 0.22 27)", bg: "rgba(220,38,38,0.14)", icon: AlertTriangle },
  pickup: { label: "Enlevement", accent: "oklch(61% 0.17 245)", bg: "rgba(37,99,235,0.12)", icon: Truck },
  warehouse_in: { label: "Depot", accent: "oklch(56% 0.19 286)", bg: "rgba(79,70,229,0.12)", icon: Warehouse },
  warehouse_out: { label: "Sortie depot", accent: "oklch(54% 0.11 184)", bg: "rgba(15,118,110,0.12)", icon: Route },
  courier_call: { label: "Appel", accent: "oklch(58% 0.12 217)", bg: "rgba(8,145,178,0.12)", icon: PhoneCall },
  delivery_issue: { label: "A relivrer", accent: "oklch(66% 0.19 47)", bg: "rgba(249,115,22,0.12)", icon: AlertTriangle },
  delivered: { label: "Livre", accent: "oklch(58% 0.16 154)", bg: "rgba(5,150,105,0.12)", icon: CheckCircle2 },
  returned: { label: "Retour", accent: "oklch(57% 0.2 302)", bg: "rgba(124,58,237,0.12)", icon: Undo2 },
  cancelled: { label: "Annule", accent: "oklch(55% 0.04 255)", bg: "rgba(100,116,139,0.12)", icon: AlertTriangle },
  neutral: { label: "Evenement", accent: "oklch(62% 0.04 255)", bg: "rgba(148,163,184,0.12)", icon: CircleDot },
};

const STAGE_LABELS = {
  pending_pickup: "En attente de prise en charge",
  picked_up: "Pris en charge",
  at_warehouse: "Au depot",
  out_for_delivery: "Sorti du depot",
  return_pending: "Depot retour expediteur",
  returned: "Retour expediteur",
  delivered: "Livre",
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toneOf(value) {
  const raw = normalizeText(value);
  if (EVENT_TONES[raw]) return EVENT_TONES[raw];
  if (raw.includes("attente")) return EVENT_TONES.pending;
  if (raw.includes("accept") || raw.includes("valid")) return EVENT_TONES.approved;
  if (raw.includes("refus")) return EVENT_TONES.rejected;
  if (raw.includes("pickup") || raw.includes("picked") || raw.includes("enlev") || raw.includes("pris")) return EVENT_TONES.pickup;
  if (raw.includes("call") || raw.includes("appel")) return EVENT_TONES.courier_call;
  if (raw.includes("warehouse_out") || raw.includes("sortie")) return EVENT_TONES.warehouse_out;
  if (raw.includes("warehouse_in") || raw.includes("depot") || raw.includes("transit")) return EVENT_TONES.warehouse_in;
  if (raw.includes("issue") || raw.includes("relivr") || raw.includes("report") || raw.includes("failed")) return EVENT_TONES.delivery_issue;
  if (raw.includes("livr") || raw.includes("deliver")) return EVENT_TONES.delivered;
  if (raw.includes("annul")) return EVENT_TONES.cancelled;
  if (raw.includes("retour") || raw.includes("return")) return EVENT_TONES.returned;
  return EVENT_TONES.neutral;
}

function adminDecision(note) {
  const raw = normalizeText(note);
  if (raw.includes("accept")) return "approved";
  if (raw.includes("refus")) return "rejected";
  return null;
}

function formatDate(value) {
  if (!value) return "Date indisponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  return date.toLocaleDateString("fr-TN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "Non renseigne";
  return `${formatDate(value)} ${formatTime(value)}`;
}

function dateTimeAttribute(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} DT` : "-";
}

function designationOf(produits) {
  if (!Array.isArray(produits) || produits.length === 0) return "Colis standard";
  const names = produits
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (item && typeof item === "object") return item.designation || item.nom || item.name || item.label || "";
      return "";
    })
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "Colis standard";
}

function itemCountOf(produits) {
  if (!Array.isArray(produits) || produits.length === 0) return 1;
  return produits.reduce((total, item) => total + (Number(item?.quantite) || 1), 0);
}

function deriveAddressLabel(address, fallback = "Origine") {
  const raw = String(address || "").trim();
  if (!raw) return fallback;
  const segments = raw.split(/[,/-]/).map((part) => part.trim()).filter(Boolean);
  return segments[0] || raw;
}

function deriveDestinationLabel(colis) {
  return (colis?.destination_label || "").trim() || deriveAddressLabel(colis?.adresse_livraison, "Destination");
}

function deriveDepotLabel(colis) {
  const raw =
    colis?.depot_label ||
    colis?.depot_depart ||
    colis?.depot ||
    colis?.depot_adresse ||
    "";
  const text = String(raw).trim();
  const depot = normalizeText(text);

  if (depot.includes("kairouan")) return "Depot Kairouan";
  if (depot.includes("sous")) return "Depot Sousse";
  if (!text) return "Depot non defini";
  if (depot.startsWith("depot")) return text;
  return `Depot ${text}`;
}

function compact(value, length = 96) {
  const text = String(value || "");
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
}

function currentStageLabel(colis) {
  const stage = String(colis?.tracking_stage || "").trim();
  if (STAGE_LABELS[stage]) return STAGE_LABELS[stage];
  return toneOf(colis?.statut).label;
}

function timelineOf(colis) {
  if (!colis) return [];

  const historyEvents = Array.isArray(colis.history)
    ? colis.history
        .map((event, index) => {
          const cleanEvent = sanitizeHistoryEvent(event);
          if (!cleanEvent) return null;
          const kind = String(cleanEvent.kind || "").toLowerCase();
          return {
            id: cleanEvent.id ?? `history-${index}`,
            kind,
            title: cleanEvent.title || "Mise a jour",
            note: cleanEvent.note || "",
            date: cleanEvent.date || cleanEvent.event_at || cleanEvent.created_at || cleanEvent.updated_at,
            tone: toneOf(cleanEvent.kind || cleanEvent.status || cleanEvent.statut),
          };
        })
        .filter(Boolean)
    : [];
  const historyKinds = new Set(historyEvents.map((event) => event.kind).filter(Boolean));
  const events = [];

  if (colis.created_at && !historyKinds.has("created")) {
    events.push({
      id: "created",
      title: "Demande d'enlevement",
      note: "Bordereau enregistre par l'expediteur.",
      date: colis.created_at,
      tone: EVENT_TONES.created,
      kind: "created",
    });
  }

  const decision = adminDecision(colis.admin_note);
  if (decision === "approved" && !historyKinds.has("approved")) {
    events.push({
      id: "approved",
      title: "Demande validee",
      note: "Le colis a ete accepte par l'admin.",
      date: colis.admin_note_at || colis.updated_at,
      tone: EVENT_TONES.approved,
      kind: "approved",
    });
  }
  if (decision === "rejected" && !historyKinds.has("rejected")) {
    events.push({
      id: "rejected",
      title: "Demande refusee",
      note: "Le colis a ete refuse par l'admin.",
      date: colis.admin_note_at || colis.updated_at,
      tone: EVENT_TONES.rejected,
      kind: "rejected",
    });
  }
  if (colis.warehouse_received_at && !historyKinds.has("warehouse_in")) {
    events.push({
      id: "warehouse-in",
      title: "Colis depose au depot",
      note: "Le colis est arrive au depot.",
      date: colis.warehouse_received_at,
      tone: EVENT_TONES.warehouse_in,
      kind: "warehouse_in",
    });
  }
  if (colis.out_for_delivery_at && !historyKinds.has("warehouse_out")) {
    events.push({
      id: "warehouse-out",
      title: "Colis sorti du depot",
      note: "Le colis a quitte le depot pour la livraison.",
      date: colis.out_for_delivery_at,
      tone: EVENT_TONES.warehouse_out,
      kind: "warehouse_out",
    });
  }
  if ((colis.last_delivery_issue_at || colis.failed_delivery_at) && !historyKinds.has("delivery_issue")) {
    const reason = colis.last_delivery_issue_reason ? ` Motif: ${colis.last_delivery_issue_reason}.` : "";
    events.push({
      id: "delivery-issue",
      title: "Livraison reportee",
      note: `Le colis revient au depot pour une nouvelle tentative.${reason}`,
      date: colis.last_delivery_issue_at || colis.failed_delivery_at,
      tone: EVENT_TONES.delivery_issue,
      kind: "delivery_issue",
    });
  }
  if ((colis.returned_at || colis.returned_to_shipper_at) && !historyKinds.has("returned")) {
    events.push({
      id: "returned-shipper",
      title: "Retour expediteur",
      note: "Le colis a ete remis a l expediteur.",
      date: colis.returned_at || colis.returned_to_shipper_at,
      tone: EVENT_TONES.returned,
      kind: "returned",
    });
  }
  if (colis.delivered_at && !historyKinds.has("delivered")) {
    events.push({
      id: "delivered",
      title: "Livraison",
      note: "Le colis a atteint sa destination finale.",
      date: colis.delivered_at,
      tone: EVENT_TONES.delivered,
      kind: "delivered",
    });
  } else if (colis.statut) {
    const tone = toneOf(colis.statut);
    events.push({
      id: "status",
      title: `Statut: ${tone.label}`,
      note: "Dernier etat connu du colis.",
      date: colis.updated_at || colis.created_at,
      tone,
      kind: "status",
    });
  }

  return [...events, ...historyEvents]
    .filter((event) => event.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

function InfoTile({ icon, label, value, wide = false }) {
  return (
    <div className={`admHistoryInfoTile ${wide ? "isWide" : ""}`}>
      <div className="admHistoryInfoIcon">
        {createElement(icon, { size: 16, strokeWidth: 1.8 })}
      </div>
      <div className="admHistoryInfoText">
        <span>{label}</span>
        <strong title={String(value || "")}>{compact(value || "Non renseigne")}</strong>
      </div>
    </div>
  );
}

function StatChip({ icon, label, value, tone = EVENT_TONES.neutral }) {
  return (
    <div
      className="admHistoryStatChip"
      style={{ "--chip-accent": tone.accent, "--chip-bg": tone.bg }}
    >
      {createElement(icon, { size: 16, strokeWidth: 1.9 })}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RoutePanel({ depotLabel, destinationLabel }) {
  return (
    <section className="admHistoryRoutePanel" aria-label="Trajet colis">
      <div className="admHistoryRoutePoint">
        <Warehouse size={17} strokeWidth={1.9} />
        <span>Depart</span>
        <strong>{depotLabel}</strong>
      </div>
      <div className="admHistoryRouteLine" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="admHistoryRoutePoint">
        <MapPin size={17} strokeWidth={1.9} />
        <span>Destination</span>
        <strong>{destinationLabel}</strong>
      </div>
    </section>
  );
}

function TimelineEvent({ event, index, isLatest = false }) {
  const Icon = event.tone.icon || CircleDot;

  return (
    <article
      className={`admHistoryEvent ${isLatest ? "isLatest" : ""}`}
      style={{
        "--event-accent": event.tone.accent,
        "--event-bg": event.tone.bg,
        "--event-delay": `${Math.min(index * 28, 180)}ms`,
      }}
    >
      <div className="admHistoryEventMarker" aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="admHistoryEventBody">
        <div className="admHistoryEventTop">
          <span className="admHistoryEventBadge">{event.tone.label}</span>
          <time dateTime={dateTimeAttribute(event.date)}>
            {formatDate(event.date)} a {formatTime(event.date)}
          </time>
        </div>
        <h3>{event.title}</h3>
        {event.note ? <p>{event.note}</p> : null}
      </div>
    </article>
  );
}

export default function AdminColisHistoryModal({ colis, onClose }) {
  const timeline = timelineOf(colis);
  const latest = timeline[timeline.length - 1];
  const depotLabel = deriveDepotLabel(colis);
  const destinationLabel = deriveDestinationLabel(colis);
  const comment = colis?.admin_note || "Aucune remarque";
  const callCount = timeline.filter((event) => event.kind === "courier_call").length;
  const issueCount = Number(colis?.delivery_issue_count ?? 0);
  const currentTone = toneOf(colis?.tracking_stage || colis?.statut || colis?.admin_note);

  return (
    <div className="admHistoryOverlay" role="presentation" onMouseDown={onClose}>
      <section
        aria-label={`Historique ${colis.numero_suivi}`}
        aria-modal="true"
        className="admHistoryModal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="admHistoryHeader">
          <div className="admHistoryTitleGroup">
            <span className="admHistoryEyebrow">Historique colis</span>
            <h2>{colis.numero_suivi}</h2>
            <p>{colis.nom_destinataire || "Destinataire non renseigne"}</p>
          </div>

          <div className="admHistoryHeaderActions">
            <span
              className="admHistoryStatusBadge"
              style={{ "--status-accent": currentTone.accent, "--status-bg": currentTone.bg }}
            >
              {currentStageLabel(colis)}
            </span>
            <button
              aria-label="Fermer l historique"
              className="admHistoryClose"
              onClick={onClose}
              type="button"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="admHistoryScroll">
          <div className="admHistoryHero">
            <div>
              <div className="admHistoryHeroLabel">Dernier mouvement</div>
              <strong>{latest?.title || "Aucun mouvement date"}</strong>
              <span>{latest ? formatDateTime(latest.date) : "Non renseigne"}</span>
            </div>
            <StatChip icon={CalendarClock} label="Evenements" value={timeline.length} tone={EVENT_TONES.created} />
            <StatChip icon={PhoneCall} label="Appels" value={callCount} tone={EVENT_TONES.courier_call} />
            <StatChip icon={AlertTriangle} label="Reports" value={issueCount} tone={EVENT_TONES.delivery_issue} />
          </div>

          <RoutePanel depotLabel={depotLabel} destinationLabel={destinationLabel} />

          <div className="admHistoryLayout">
            <aside className="admHistorySide">
              <section className="admHistoryPanel">
                <div className="admHistoryPanelHeader">
                  <UserRound size={17} strokeWidth={1.9} />
                  <h3>Identite colis</h3>
                </div>
                <div className="admHistoryInfoGrid">
                  <InfoTile icon={UserRound} label="Client" value={colis.nom_destinataire} />
                  <InfoTile icon={Phone} label="Telephone" value={colis.telephone_destinataire} />
                  <InfoTile icon={MapPin} label="Adresse" value={colis.adresse_livraison} wide />
                  <InfoTile icon={WalletCards} label="Montant" value={formatMoney(colis.prix)} />
                  <InfoTile icon={Boxes} label="Articles" value={`${itemCountOf(colis.produits)} article(s)`} />
                  <InfoTile icon={Boxes} label="Dimensions" value={formatDimensions(colis)} />
                  <InfoTile icon={Barcode} label="Code barre" value={colis.barcode_value || "Non genere"} wide />
                </div>
              </section>

              <section className="admHistoryPanel">
                <div className="admHistoryPanelHeader">
                  <FileText size={17} strokeWidth={1.9} />
                  <h3>Contenu</h3>
                </div>
                <div className="admHistoryNote">
                  <span>Designation</span>
                  <strong>{designationOf(colis.produits)}</strong>
                </div>
                <div className="admHistoryNote">
                  <span>Commentaire admin</span>
                  <strong>{comment}</strong>
                </div>
              </section>
            </aside>

            <main className="admHistoryTimelinePanel">
              <div className="admHistoryTimelineHead">
                <div>
                  <span>Journal operationnel</span>
                  <h3>Chronologie complete</h3>
                </div>
                <div className="admHistoryTimelineCount">
                  {timeline.length} ligne{timeline.length > 1 ? "s" : ""}
                </div>
              </div>

              {timeline.length === 0 ? (
                <div className="admHistoryEmpty">
                  <CircleDot size={22} strokeWidth={1.8} />
                  Aucun historique disponible pour ce colis.
                </div>
              ) : (
                <div className="admHistoryTimeline">
                  {timeline.map((event, index) => (
                    <TimelineEvent
                      event={event}
                      index={index}
                      isLatest={index === timeline.length - 1}
                      key={`${event.id}-${index}`}
                    />
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>
      </section>
    </div>
  );
}
