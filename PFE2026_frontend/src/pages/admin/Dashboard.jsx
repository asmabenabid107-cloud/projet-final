import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  RefreshCw,
  Scale,
  Truck,
  UsersRound,
  Warehouse,
  XCircle,
} from "lucide-react";
import { api } from "../../api/client.js";

const DAILY_WINDOW = 7;

const FILTER_META = {
  all: {
    label: "Tous",
    title: "Total colis",
    hint: "Tous les colis suivis",
    color: "#2563eb",
    bg: "#eff6ff",
  },
  pending: {
    label: "En attente",
    title: "En attente",
    hint: "Avant depot",
    color: "#f59e0b",
    bg: "#fffbeb",
  },
  warehouse: {
    label: "En transit",
    title: "En transit",
    hint: "Depot ou livraison",
    color: "#0f766e",
    bg: "#ecfdf5",
  },
  delivered: {
    label: "Livres",
    title: "Livres",
    hint: "Livraisons terminees",
    color: "#16a34a",
    bg: "#f0fdf4",
  },
  returns: {
    label: "Retours",
    title: "Retours",
    hint: "Depot ou expediteur",
    color: "#7c3aed",
    bg: "#f5f3ff",
  },
  failed: {
    label: "A relivrer",
    title: "A relivrer",
    hint: "Livraison reportee",
    color: "#ea580c",
    bg: "#fff7ed",
  },
  other: {
    label: "Autres",
    title: "Autres",
    hint: "Etats non classes",
    color: "#64748b",
    bg: "#f8fafc",
  },
};

const STATUS_ORDER = ["pending", "warehouse", "delivered", "returns", "failed", "other"];

function fmt(value) {
  if (value === null || value === undefined) return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat("fr-TN").format(number);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeStatusKey(value) {
  const raw = normalizeText(value);
  if (raw.includes("attente")) return "en_attente";
  if (raw.includes("transit")) return "en_transit";
  if (raw.includes("relivr") || raw.includes("report")) return "a_relivrer";
  if (raw.includes("livr")) return "livre";
  if (raw.includes("annul")) return "annule";
  if (raw.includes("retour")) return "retour";
  return "inconnu";
}

function normalizeStageKey(value) {
  const raw = normalizeText(value);

  if (!raw) return "pending_pickup";
  if (raw === "pending_pickup" || raw.includes("pending")) return "pending_pickup";
  if (raw === "picked_up" || raw.includes("picked")) return "picked_up";
  if (raw === "returned_to_warehouse" || (raw.includes("return") && raw.includes("warehouse"))) return "returned_to_warehouse";
  if (raw === "return_pending") return "return_pending";
  if (raw === "returned" || (raw.includes("return") && !raw.includes("warehouse"))) return "returned";
  if (raw === "out_for_delivery" || (raw.includes("warehouse") && raw.includes("out"))) return "out_for_delivery";
  if (raw === "at_warehouse" || (raw.includes("warehouse") && !raw.includes("out"))) return "at_warehouse";
  if (raw === "delivery_failed" || (raw.includes("deliver") && raw.includes("fail"))) return "delivery_failed";
  if (raw === "delivered" || (raw.includes("deliver") && !raw.includes("fail"))) return "delivered";
  return "unknown";
}

function parcelBucket(colis) {
  const status = normalizeStatusKey(colis?.statut);
  const stage = normalizeStageKey(colis?.tracking_stage);

  if (stage === "delivery_failed" || status === "a_relivrer") return "failed";
  if (stage === "returned_to_warehouse" || stage === "returned" || status === "retour") return "returns";
  if (stage === "delivered" || status === "livre") return "delivered";
  if (status === "annule") return "other";
  if (stage === "at_warehouse" || stage === "out_for_delivery" || status === "en_transit") return "warehouse";
  if (stage === "pending_pickup" || stage === "picked_up" || status === "en_attente") return "pending";
  return "other";
}

function metricCounts(colisList) {
  const counts = {
    all: colisList.length,
    pending: 0,
    warehouse: 0,
    delivered: 0,
    returns: 0,
    failed: 0,
    other: 0,
  };

  colisList.forEach((colis) => {
    const bucket = parcelBucket(colis);
    counts[bucket] = (counts[bucket] || 0) + 1;
  });

  return counts;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function formatMoneyCompact(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `${new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(amount)} DT`
    : "-";
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toInputDateValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateKey(date);
}

function dateFromInput(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-TN", { weekday: "short" }).replace(".", "");
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-TN", { day: "2-digit", month: "short" });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-TN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lastParcelDate(colis) {
  return (
    colis?.returned_to_shipper_at ||
    colis?.returned_at ||
    colis?.return_warehouse_received_at ||
    colis?.last_delivery_issue_at ||
    colis?.failed_delivery_at ||
    colis?.delivered_at ||
    colis?.out_for_delivery_at ||
    colis?.warehouse_received_at ||
    colis?.picked_up_at ||
    colis?.admin_note_at ||
    colis?.updated_at ||
    colis?.created_at
  );
}

function latestUsableDate(colisList) {
  const timestamps = colisList
    .map((colis) => new Date(lastParcelDate(colis) || colis?.created_at).getTime())
    .filter((time) => Number.isFinite(time));

  return timestamps.length ? new Date(Math.max(...timestamps)) : new Date();
}

function defaultActivityRange(colisList) {
  const end = startOfDay(latestUsableDate(colisList));
  const start = new Date(end);
  start.setDate(end.getDate() - (DAILY_WINDOW - 1));

  return {
    start: toInputDateValue(start),
    end: toInputDateValue(end),
  };
}

function resolveActivityDates(colisList, startValue, endValue) {
  const fallback = defaultActivityRange(colisList);
  let start = dateFromInput(startValue) || dateFromInput(fallback.start);
  let end = dateFromInput(endValue) || dateFromInput(fallback.end);

  if (start > end) {
    const nextStart = end;
    end = start;
    start = nextStart;
  }

  return { start: startOfDay(start), end: startOfDay(end) };
}

function buildDailyActivity(colisList, startValue, endValue) {
  const { start, end } = resolveActivityDates(colisList, startValue, endValue);
  const daysCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  const days = Array.from({ length: daysCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      key: dateKey(date),
      date,
      label: formatShortDay(date),
      caption: formatShortDate(date),
      value: 0,
      delivered: 0,
    };
  });

  const dayMap = new Map(days.map((day) => [day.key, day]));

  colisList.forEach((colis) => {
    const rawDate = lastParcelDate(colis) || colis?.created_at;
    if (!rawDate) return;

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;

    const day = dayMap.get(dateKey(startOfDay(date)));
    if (!day) return;

    day.value += 1;
    if (parcelBucket(colis) === "delivered") day.delivered += 1;
  });

  return days;
}

function formatRange(series) {
  if (!series.length) return "-";
  return `${formatShortDate(series[0].date)} - ${formatShortDate(series[series.length - 1].date)}`;
}

function depotDashboardLabel(value) {
  const raw = normalizeText(value);
  if (!raw) return "Depot non defini";
  if (raw.includes("sousse")) return "Depot Sousse";
  if (raw.includes("kairouan")) return "Depot Kairouan";
  return `Depot ${String(value).trim()}`;
}

function buildDepotRows(colisList) {
  const rows = new Map();

  colisList.forEach((colis) => {
    const label = depotDashboardLabel(colis?.depot_depart);
    const bucket = parcelBucket(colis);
    const row = rows.get(label) || {
      label,
      total: 0,
      delivered: 0,
      pending: 0,
      warehouse: 0,
      weight: 0,
      revenue: 0,
    };

    row.total += 1;
    row.weight += toNumber(colis?.poids);
    row.revenue += toNumber(colis?.prix);
    if (bucket === "delivered") row.delivered += 1;
    if (bucket === "pending") row.pending += 1;
    if (bucket === "warehouse") row.warehouse += 1;
    rows.set(label, row);
  });

  return Array.from(rows.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
}

function buildRecentParcels(colisList) {
  return colisList
    .map((colis) => ({
      ...colis,
      bucket: parcelBucket(colis),
      activityDate: lastParcelDate(colis) || colis?.created_at,
    }))
    .filter((colis) => Number.isFinite(new Date(colis.activityDate).getTime()))
    .sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime())
    .slice(0, 6);
}

function buildAttentionItems({ counts, accountPending, couriersPending, shippersPending }) {
  const items = [];

  if (counts.failed > 0) {
    items.push({
      key: "failed",
      tone: "warning",
      icon: AlertTriangle,
      label: "Relivraisons",
      value: fmt(counts.failed),
      detail: "Colis a reprendre avant blocage client.",
      to: "/admin/colis",
    });
  }

  if (counts.returns > 0) {
    items.push({
      key: "returns",
      tone: "neutral",
      icon: XCircle,
      label: "Retours",
      value: fmt(counts.returns),
      detail: "Verifier le retour depot ou expediteur.",
      to: "/admin/colis",
    });
  }

  if (accountPending > 0) {
    items.push({
      key: "accounts",
      tone: "info",
      icon: UsersRound,
      label: "Demandes comptes",
      value: fmt(accountPending),
      detail: `${fmt(shippersPending)} expediteurs, ${fmt(couriersPending)} livreurs en attente.`,
      to: couriersPending > shippersPending ? "/admin/livreurs" : "/admin/expediteurs",
    });
  }

  if (counts.pending > 0) {
    items.push({
      key: "pending",
      tone: "amber",
      icon: Clock3,
      label: "Avant depot",
      value: fmt(counts.pending),
      detail: "Volume en attente de pickup ou depot.",
      to: "/admin/colis",
    });
  }

  if (items.length === 0) {
    items.push({
      key: "stable",
      tone: "success",
      icon: CheckCircle2,
      label: "Flux stable",
      value: "OK",
      detail: "Aucun point critique detecte dans les donnees actuelles.",
      to: "/admin/dashboard",
    });
  }

  return items.slice(0, 4);
}

function donutBackground(segments) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  if (!total) return "conic-gradient(#e5e7eb 0deg 360deg)";

  let cursor = 0;
  const parts = segments.map((item) => {
    const start = cursor;
    cursor += (item.value / total) * 360;
    return `${item.color} ${start}deg ${cursor}deg`;
  });

  return `conic-gradient(${parts.join(", ")})`;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [stats, setStats] = useState(null);
  const [colisList, setColisList] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [activityStart, setActivityStart] = useState("");
  const [activityEnd, setActivityEnd] = useState("");
  const [activityRangeTouched, setActivityRangeTouched] = useState(false);
  const loadedOnceRef = useRef(false);

  const shippersTotal = stats?.shippers?.total ?? 0;
  const shippersApproved = stats?.shippers?.approved ?? 0;
  const shippersPending = stats?.shippers?.pending ?? 0;
  const couriersTotal = stats?.couriers?.total ?? 0;
  const couriersApproved = stats?.couriers?.approved ?? 0;
  const couriersPending = stats?.couriers?.pending ?? 0;

  const counts = useMemo(() => metricCounts(colisList), [colisList]);
  const parcelsTotal = counts.all;
  const deliveredRate = pct(counts.delivered, parcelsTotal);
  const totalRevenue = useMemo(
    () => colisList.reduce((sum, colis) => sum + toNumber(colis?.prix), 0),
    [colisList]
  );
  const totalWeight = useMemo(
    () => colisList.reduce((sum, colis) => sum + toNumber(colis?.poids), 0),
    [colisList]
  );

  const accountTotal = shippersTotal + couriersTotal;
  const accountApproved = shippersApproved + couriersApproved;
  const accountPending = shippersPending + couriersPending;
  const accountApprovalRate = pct(accountApproved, accountTotal);

  const parcelMetrics = useMemo(
    () =>
      ["all", ...STATUS_ORDER].map((key) => ({
        key,
        ...FILTER_META[key],
        value: counts[key] ?? 0,
        pct: key === "all" ? 100 : pct(counts[key] ?? 0, parcelsTotal),
      })),
    [counts, parcelsTotal]
  );

  const distributionMetrics = useMemo(
    () => parcelMetrics.filter((metric) => metric.key !== "all"),
    [parcelMetrics]
  );

  const selectedMetric = useMemo(
    () => parcelMetrics.find((metric) => metric.key === selectedFilter) || parcelMetrics[0],
    [parcelMetrics, selectedFilter]
  );

  const dominantSegment = useMemo(
    () =>
      distributionMetrics.reduce(
        (best, metric) => (metric.value > best.value ? metric : best),
        distributionMetrics[0] || FILTER_META.other
      ),
    [distributionMetrics]
  );

  const dailySeries = useMemo(
    () => buildDailyActivity(colisList, activityStart, activityEnd),
    [activityEnd, activityStart, colisList]
  );
  const dailyMax = useMemo(
    () => Math.max(1, ...dailySeries.map((day) => day.value)),
    [dailySeries]
  );
  const dailyTotal = useMemo(
    () => dailySeries.reduce((sum, day) => sum + day.value, 0),
    [dailySeries]
  );
  const dailyAverage = dailySeries.length ? Math.round(dailyTotal / dailySeries.length) : 0;
  const peakDay = useMemo(
    () => dailySeries.reduce((best, day) => (day.value > best.value ? day : best), dailySeries[0] || { value: 0 }),
    [dailySeries]
  );

  const donutSegments = useMemo(
    () => parcelMetrics.filter((metric) => metric.key !== "all" && metric.value > 0),
    [parcelMetrics]
  );
  const donutStyle = useMemo(() => {
    if (selectedFilter === "all") return donutBackground(donutSegments);

    const segment = distributionMetrics.find((metric) => metric.key === selectedFilter);
    if (!segment || !parcelsTotal) return "conic-gradient(#e5e7eb 0deg 360deg)";

    const rawDegrees = (segment.value / parcelsTotal) * 360;
    const degrees = segment.value > 0 ? Math.max(4, rawDegrees) : 0;
    return `conic-gradient(${segment.color} 0deg ${degrees}deg, #e5e7eb ${degrees}deg 360deg)`;
  }, [distributionMetrics, donutSegments, parcelsTotal, selectedFilter]);

  const donutCenter = selectedFilter === "all"
    ? { label: "Total colis", value: parcelsTotal }
    : { label: selectedMetric?.label || "Selection", value: selectedMetric?.value || 0 };

  const summaryMetric = selectedFilter === "all" ? dominantSegment : selectedMetric;
  const summaryLabel = selectedFilter === "all" ? "Etat dominant" : "Segment affiche";

  const depotRows = useMemo(() => buildDepotRows(colisList), [colisList]);
  const depotMax = useMemo(
    () => Math.max(1, ...depotRows.map((row) => row.total)),
    [depotRows]
  );
  const recentParcels = useMemo(() => buildRecentParcels(colisList), [colisList]);
  const attentionItems = useMemo(
    () => buildAttentionItems({ counts, accountPending, couriersPending, shippersPending }),
    [accountPending, counts, couriersPending, shippersPending]
  );

  const load = useCallback(async ({ background = false } = {}) => {
    setErr("");

    if (background && loadedOnceRef.current) {
      setBackgroundRefreshing(true);
    } else if (loadedOnceRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [statsRes, colisRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/colis"),
      ]);

      setStats(statsRes.data);
      setColisList(Array.isArray(colisRes.data) ? colisRes.data : colisRes.data?.items || []);
      setUpdatedAt(new Date());
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;

      if (status === 401) setErr("Session expiree. Reconnecte-toi.");
      else if (status === 403) setErr("Acces refuse: admin requis.");
      else setErr(detail || e?.message || "Erreur chargement dashboard.");
    } finally {
      loadedOnceRef.current = true;
      setLoading(false);
      setRefreshing(false);
      setBackgroundRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();

    const onFocus = () => load({ background: true });
    window.addEventListener("focus", onFocus);

    const timer = setInterval(() => load({ background: true }), 15000);

    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (activityRangeTouched) return;
    const range = defaultActivityRange(colisList);
    setActivityStart(range.start);
    setActivityEnd(range.end);
  }, [activityRangeTouched, colisList]);

  function resetActivityRange() {
    const range = defaultActivityRange(colisList);
    setActivityRangeTouched(false);
    setActivityStart(range.start);
    setActivityEnd(range.end);
  }

  function handleActivityStart(value) {
    setActivityRangeTouched(true);
    setActivityStart(value);
    if (activityEnd && value > activityEnd) setActivityEnd(value);
  }

  function handleActivityEnd(value) {
    setActivityRangeTouched(true);
    setActivityEnd(value);
    if (activityStart && value < activityStart) setActivityStart(value);
  }

  const busy = loading || refreshing || backgroundRefreshing;

  return (
    <div
      className={`admDashV2 admOpsConsole ${loading ? "isLoading" : ""} ${backgroundRefreshing ? "isRefreshing" : ""}`}
      aria-busy={busy}
    >
      <div className="admCommandHeader">
        <div className="admCommandTitleBlock">
          <div className="admDashEyebrow">Centre operations</div>
          <h1 className="admDashV2Title">Vue globale admin</h1>
          <div className="admDashV2Sub">
            Colis, comptes, depots et signaux critiques pour piloter la journee.
          </div>
        </div>

        <div className="admCommandActions">
          <div className="admCommandMeta">
            <span className={`admLiveDot ${backgroundRefreshing ? "isSyncing" : ""}`} aria-hidden="true" />
            <span>{backgroundRefreshing ? "Synchronisation" : "Donnees a jour"}</span>
            <strong>{updatedAt ? updatedAt.toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" }) : "-"}</strong>
          </div>
          <button
            className="admDashRefresh"
            type="button"
            onClick={() => load()}
            disabled={loading || refreshing}
          >
            <RefreshCw className={loading || refreshing ? "isSpinning" : ""} size={16} aria-hidden="true" />
            <span>{loading ? "Chargement" : refreshing ? "Mise a jour" : "Rafraichir"}</span>
          </button>
        </div>
      </div>

      {err && <div className="admDashV2Alert">{err}</div>}

      <div className="admKpiGridV2">
        <KpiCard
          title="Colis suivis"
          tag="Suivi operationnel"
          chip="Global"
          value={fmt(parcelsTotal)}
          caption={`${fmt(counts.pending)} en attente, ${fmt(counts.warehouse)} en transit`}
          accent="#2563eb"
          icon={PackageCheck}
          meter={100}
          loading={loading}
        />
        <KpiCard
          title="Livraison"
          tag="Performance"
          chip="Taux"
          value={`${deliveredRate}%`}
          caption={`${fmt(counts.delivered)} colis livres`}
          accent="#16a34a"
          icon={CheckCircle2}
          meter={deliveredRate}
          loading={loading}
        />
        <KpiCard
          title="Montant total"
          tag="Chiffre colis"
          chip="CA"
          value={formatMoneyCompact(totalRevenue)}
          caption={`${fmt(totalWeight.toFixed(1))} kg suivis`}
          accent="#0f766e"
          icon={CircleDollarSign}
          meter={100}
          loading={loading}
        />
        <KpiCard
          title="Comptes actifs"
          tag="Utilisateurs"
          chip="Admin"
          value={fmt(accountTotal)}
          caption={`${fmt(accountPending)} demandes en attente`}
          accent="#f59e0b"
          icon={UsersRound}
          meter={accountApprovalRate}
          loading={loading}
        />
      </div>

      <div className="admOpsGrid">
        <section className="admCleanCard admChartWideV2">
          <div className="admCleanCardHead">
            <div>
              <div className="admCleanTitle">Activite colis</div>
              <div className="admCleanSub">Mouvements colis sur la periode selectionnee</div>
            </div>
            <div className="admActivityTools">
              <div className="admActivityDates">
                <label>
                  <span>Du</span>
                  <input
                    type="date"
                    value={activityStart}
                    max={activityEnd || undefined}
                    onChange={(event) => handleActivityStart(event.target.value)}
                    onInput={(event) => handleActivityStart(event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>Au</span>
                  <input
                    type="date"
                    value={activityEnd}
                    min={activityStart || undefined}
                    onChange={(event) => handleActivityEnd(event.target.value)}
                    onInput={(event) => handleActivityEnd(event.currentTarget.value)}
                  />
                </label>
              </div>
              <button type="button" className="admRangeReset" onClick={resetActivityRange}>
                7 jours
              </button>
              <div className="admDateChip">{formatRange(dailySeries)}</div>
            </div>
          </div>

          {loading ? (
            <ActivityChartLoader />
          ) : (
            <>
              <div className="admActivitySummary">
                <MiniStat icon={Activity} label="Mouvements" value={fmt(dailyTotal)} />
                <MiniStat icon={Scale} label="Moyenne / jour" value={fmt(dailyAverage)} />
                <MiniStat icon={Clock3} label="Pic" value={`${fmt(peakDay?.value || 0)} ${peakDay?.label || ""}`} />
              </div>
              <ActivityBars series={dailySeries} max={dailyMax} />
            </>
          )}
        </section>

        <section className="admCleanCard admAttentionPanel">
          <div className="admCleanCardHead">
            <div>
              <div className="admCleanTitle">Attention operationnelle</div>
              <div className="admCleanSub">Les points a verifier en priorite.</div>
            </div>
          </div>

          <div className="admAttentionList">
            {loading ? (
              <>
                <LineLoader />
                <LineLoader />
                <LineLoader />
              </>
            ) : (
              attentionItems.map((item) => <AttentionItem key={item.key} item={item} />)
            )}
          </div>
        </section>
      </div>

      <section className="admCleanCard admDistributionCard">
        <div className="admCleanCardHead">
          <div>
            <div className="admCleanTitle">Repartition colis</div>
            <div className="admCleanSub">Statuts operationnels et poids dans le total.</div>
          </div>
          {!loading && (
            <div className="admDistributionFocus">
              <span>Selection</span>
              <strong>{selectedMetric?.title || selectedMetric?.label}</strong>
              {selectedFilter !== "all" && (
                <button type="button" onClick={() => setSelectedFilter("all")}>
                  Voir total
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <DistributionLoader />
        ) : (
          <div className="admDistributionLayout">
            <div className="admDistributionVisual">
              <div
                key={selectedFilter}
                className={`admDonut admDonutPro ${selectedFilter !== "all" ? "isFocused" : ""}`}
                style={{ "--donut-color": selectedMetric?.color || "#2563eb", background: donutStyle }}
              >
                <div className="admDonutHole">
                  <span>{donutCenter.label}</span>
                  <strong>{fmt(donutCenter.value)}</strong>
                </div>
              </div>

              <div className="admDistributionSummary">
                <span>{summaryLabel}</span>
                <strong>{summaryMetric?.label || "-"}</strong>
                <small>{fmt(summaryMetric?.value || 0)} colis, {summaryMetric?.pct || 0}% du total</small>
              </div>
            </div>

            <div className="admStatusStatGrid">
              {distributionMetrics.map((segment) => (
                <button
                  key={segment.key}
                  type="button"
                  className={`admStatusStatCard ${selectedFilter === segment.key ? "isActive" : ""}`}
                  onClick={() => setSelectedFilter(segment.key)}
                  aria-pressed={selectedFilter === segment.key}
                  style={{ "--status-color": segment.color, "--status-bg": segment.bg }}
                >
                  <div className="admStatusStatTop">
                    <span>
                      <i />
                      {segment.label}
                    </span>
                    <strong>{segment.pct}%</strong>
                  </div>
                  <div className="admStatusStatValue">{fmt(segment.value)}</div>
                  <div className="admStatusStatBar">
                    <div style={{ width: `${segment.pct}%` }} />
                  </div>
                  <div className="admStatusStatHint">{segment.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="admInsightsGridV2">
        <section className="admCleanCard">
          <div className="admCleanCardHead">
            <div>
              <div className="admCleanTitle">Comptes</div>
              <div className="admCleanSub">{accountApprovalRate}% des comptes sont approuves</div>
            </div>
          </div>

          <div className="admAccountRows">
            {loading ? (
              <>
                <LineLoader />
                <LineLoader />
              </>
            ) : (
              <>
                <AccountProgress label="Expediteurs" total={shippersTotal} approved={shippersApproved} pending={shippersPending} accent="#2563eb" />
                <AccountProgress label="Livreurs" total={couriersTotal} approved={couriersApproved} pending={couriersPending} accent="#0f766e" />
              </>
            )}
          </div>
        </section>

        <section className="admCleanCard">
          <div className="admCleanCardHead">
            <div>
              <div className="admCleanTitle">Depots</div>
              <div className="admCleanSub">Charge, poids et livraisons par depot</div>
            </div>
          </div>

          <div className="admDepotRows">
            {loading ? (
              <>
                <LineLoader />
                <LineLoader />
                <LineLoader />
              </>
            ) : depotRows.length === 0 ? (
              <div className="admEmptyMini">Aucun depot trouve.</div>
            ) : (
              depotRows.map((row) => (
                <DepotRow key={row.label} row={row} max={depotMax} />
              ))
            )}
          </div>
        </section>
      </div>

      <section className="admCleanCard admRecentPanel">
        <div className="admCleanCardHead">
          <div>
            <div className="admCleanTitle">Activite recente</div>
            <div className="admCleanSub">Derniers colis modifies, livres, sortis ou crees.</div>
          </div>
          <Link className="admPanelLink" to="/admin/colis">
            Voir colis
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="admRecentGridV2">
            <RecentLoader />
            <RecentLoader />
            <RecentLoader />
          </div>
        ) : recentParcels.length === 0 ? (
          <div className="admEmptyMini">Aucune activite recente.</div>
        ) : (
          <div className="admRecentGridV2">
            {recentParcels.map((colis) => (
              <RecentParcelCard key={colis.id} colis={colis} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({ title, tag, chip, value, caption, accent, icon, meter = 0, loading }) {
  const meterWidth = Math.max(0, Math.min(100, Number(meter) || 0));

  return (
    <section className={`admKpiCardV2 ${loading ? "isLoading" : ""}`} style={{ "--kpi-accent": accent }}>
      <div className="admKpiHeader">
        <div className="admKpiIcon" aria-hidden="true">
          {createElement(icon, { size: 20, strokeWidth: 1.9 })}
        </div>
        <div className="admKpiChip">{chip}</div>
      </div>
      <div className="admKpiTitleBlock">
        <div className="admKpiLabel">{title}</div>
        <div className="admKpiTag">{tag}</div>
      </div>
      {loading ? (
        <>
          <div className="admKpiValueLoader">
            <span />
            <span />
            <span />
          </div>
          <div className="admKpiCaptionLoader" />
        </>
      ) : (
        <>
          <div className="admKpiBody">
            <div className="admKpiValue">{value}</div>
          </div>
          <div className="admKpiFooter">
            <div className="admKpiCaption">{caption}</div>
            <div className="admKpiMeterWrap">
              <span>{meterWidth}%</span>
              <div className="admKpiMeter" aria-hidden="true">
                <div style={{ width: `${meterWidth}%` }} />
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="admMiniStat">
      {createElement(icon, { size: 16, "aria-hidden": "true" })}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AttentionItem({ item }) {
  const Icon = item.icon;

  return (
    <Link className={`admAttentionItem ${item.tone}`} to={item.to}>
      <span className="admAttentionIcon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="admAttentionCopy">
        <strong>{item.label}</strong>
        <small>{item.detail}</small>
      </span>
      <span className="admAttentionValue">{item.value}</span>
    </Link>
  );
}

function ActivityChartLoader() {
  const bars = [18, 58, 26, 42, 22, 82, 34];

  return (
    <div className="admActivityChart admActivityChartLoading">
      {bars.map((height, index) => (
        <div key={index} className="admBarSlot admLoadingBarSlot">
          <div className="admLoadingValue" />
          <div
            className="admLoadingBarPillar"
            style={{
              height: `${height}%`,
              animationDelay: `${index * 90}ms`,
            }}
          />
          <div className="admLoadingDay" />
          <div className="admLoadingDate" />
        </div>
      ))}
    </div>
  );
}

function DistributionLoader() {
  return (
    <div className="admDistributionLoader">
      <div className="admDistributionVisual">
        <div className="admDonutLoading">
          <div className="admDonutLoadingHole">
            <span />
            <strong />
          </div>
        </div>
        <div className="admDistributionSummary admDistributionSummaryLoading">
          <span />
          <strong />
          <small />
        </div>
      </div>
      <div className="admStatusStatGrid">
        {new Array(6).fill(null).map((_, index) => (
          <div key={index} className="admStatusStatCard admStatusStatLoader">
            <div className="admStatusStatTop">
              <span />
              <strong />
            </div>
            <div className="admStatusStatValue" />
            <div className="admStatusStatBar" />
            <div className="admStatusStatHint" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LineLoader() {
  return (
    <div className="admLineLoader">
      <div className="admLineLoaderTop">
        <span />
        <strong />
      </div>
      <div className="admLineLoaderBar" />
      <div className="admLineLoaderMeta" />
    </div>
  );
}

function RecentLoader() {
  return (
    <div className="admRecentCardV2 admRecentCardLoader">
      <div className="admRecentLoaderTop">
        <span />
        <strong />
      </div>
      <div className="admRecentLoaderMeta" />
    </div>
  );
}

function ActivityBars({ series, max }) {
  return (
    <div className="admActivityChart" style={{ "--bar-count": series.length }}>
      {series.map((day) => {
        const height = day.value > 0 ? Math.max(10, Math.round((day.value / max) * 100)) : 4;
        const deliveredShare = pct(day.delivered, day.value);

        return (
          <div key={day.key} className="admBarSlot">
            <div className="admBarValue">{day.value > 0 ? fmt(day.value) : ""}</div>
            <div
              className={`admBarPillar ${day.value === max && day.value > 0 ? "isPeak" : ""}`}
              style={{ height: `${height}%` }}
            >
              {day.delivered > 0 && (
                <div className="admBarDelivered" style={{ height: `${Math.max(18, deliveredShare)}%` }} />
              )}
            </div>
            <div className="admBarDay">{day.label}</div>
            <div className="admBarCaption">{day.caption}</div>
          </div>
        );
      })}
    </div>
  );
}

function AccountProgress({ label, total, approved, pending, accent }) {
  const approvedRate = pct(approved, total);

  return (
    <div className="admAccountRow" style={{ "--account-accent": accent }}>
      <div className="admAccountTop">
        <strong>{label}</strong>
        <span>{fmt(total)} total</span>
      </div>
      <div className="admAccountBar">
        <div style={{ width: `${approvedRate}%` }} />
      </div>
      <div className="admAccountMeta">
        <span>{fmt(approved)} approuves</span>
        <span>{fmt(pending)} en attente</span>
      </div>
    </div>
  );
}

function DepotRow({ row, max }) {
  const width = pct(row.total, max);
  const deliveredRate = pct(row.delivered, row.total);

  return (
    <div className="admDepotRow">
      <div className="admDepotTop">
        <strong>{row.label}</strong>
        <span>{fmt(row.total)} colis</span>
      </div>
      <div className="admDepotBar">
        <div style={{ width: `${width}%` }} />
      </div>
      <div className="admDepotMeta">
        <span>{fmt(row.weight.toFixed(1))} kg</span>
        <span>{formatMoneyCompact(row.revenue)}</span>
        <span>{deliveredRate}% livres</span>
      </div>
    </div>
  );
}

function RecentParcelCard({ colis }) {
  const statusMeta = FILTER_META[colis.bucket] || FILTER_META.other;
  const tracking = colis.numero_suivi || colis.barcode_value || `#${colis.id}`;

  return (
    <Link className="admRecentCardV2" to="/admin/colis" style={{ "--recent-color": statusMeta.color, "--recent-bg": statusMeta.bg }}>
      <div className="admRecentCardTop">
        <span className="admRecentTrack">{tracking}</span>
        <span className="admBadgeV2">{statusMeta.label}</span>
      </div>
      <strong>{colis.nom_destinataire || "Destinataire non defini"}</strong>
      <div className="admRecentMeta">
        <span>
          <Warehouse size={14} aria-hidden="true" />
          {depotDashboardLabel(colis.depot_depart)}
        </span>
        <span>
          <Boxes size={14} aria-hidden="true" />
          {formatMoneyCompact(colis.prix)}
        </span>
      </div>
      <div className="admRecentFoot">
        <Truck size={14} aria-hidden="true" />
        <span>{formatDateTime(colis.activityDate)}</span>
      </div>
    </Link>
  );
}
