import { useEffect, useMemo, useState } from "react";
import tourneeService from "../../api/tourneeService";

const STATUS_META = {
  proposed: {
    label: "Proposée",
    short: "Proposées",
    bg: "rgba(245,158,11,0.14)",
    color: "#f59e0b",
    border: "rgba(245,158,11,0.35)",
    dot: "#f59e0b",
  },
  accepted: {
    label: "Acceptée",
    short: "Acceptées",
    bg: "rgba(34,197,94,0.12)",
    color: "#22c55e",
    border: "rgba(34,197,94,0.28)",
    dot: "#22c55e",
  },
  refused: {
    label: "Refusée",
    short: "Refusées",
    bg: "rgba(239,68,68,0.12)",
    color: "#ef4444",
    border: "rgba(239,68,68,0.28)",
    dot: "#ef4444",
  },
};

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

const getStatus = (status) => STATUS_META[status] || STATUS_META.proposed;
const getTourneeTitle = (t) => t?.nom || "Tournée IA";

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

const routePlannerCss = `
.rp-page {
  padding: 18px;
  color: var(--text-primary);
}

.rp-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 22px;
  align-items: center;
  padding: 24px 28px;
  border-radius: 24px;
  border: 1px solid rgba(126,154,255,0.22);
  background:
    radial-gradient(520px 230px at 92% -20%, rgba(99,102,241,0.16), transparent 64%),
    linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025));
  box-shadow: 0 14px 36px rgba(15,23,42,0.06);
  margin-bottom: 18px;
}

.rp-hero-content {
  min-width: 0;
}

.rp-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(110,168,255,0.25);
  background: rgba(110,168,255,0.10);
  color: var(--accent-soft);
  font-size: 12px;
  font-weight: 900;
  margin-bottom: 12px;
}

.rp-ai-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  box-shadow: 0 0 0 5px rgba(110,168,255,0.12);
}

.rp-title {
  margin: 0;
  font-size: clamp(28px, 3.4vw, 42px);
  line-height: 1.05;
  font-weight: 1000;
  letter-spacing: -0.045em;
}

.rp-subtitle {
  margin: 10px 0 0;
  max-width: 760px;
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.55;
}

.rp-control-card {
  width: 440px;
  padding: 16px;
  border-radius: 22px;
  border: 1px solid rgba(126,154,255,0.22);
  background: rgba(255,255,255,0.36);
  box-shadow: 0 12px 30px rgba(15,23,42,0.055);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: end;
}

.rp-primary-btn,
.rp-ghost-btn,
.rp-success-btn,
.rp-danger-btn {
  border: 0;
  outline: none;
  border-radius: 16px;
  padding: 12px 16px;
  font-weight: 950;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
  white-space: nowrap;
}

.rp-primary-btn {
  grid-column: span 2;
  border: 1px solid rgba(99,102,241,0.35);
  background: rgba(99,102,241,0.10);
  color: var(--text-primary);
  box-shadow: 0 10px 26px rgba(99,102,241,0.10);
}

.rp-ghost-btn {
  border: 1px solid var(--border-soft);
  background: rgba(255,255,255,0.46);
  color: var(--text-primary);
}

.rp-success-btn {
  border: 1px solid rgba(34,197,94,0.32);
  background: rgba(34,197,94,0.13);
  color: #22c55e;
}

.rp-danger-btn {
  border: 1px solid rgba(239,68,68,0.32);
  background: rgba(239,68,68,0.13);
  color: #ef4444;
}

.rp-primary-btn:hover,
.rp-ghost-btn:hover,
.rp-success-btn:hover,
.rp-danger-btn:hover {
  transform: translateY(-1px);
}

.rp-primary-btn:disabled {
  opacity: .65;
  cursor: not-allowed;
  transform: none;
}

.rp-date-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rp-date-label {
  font-size: 12px;
  font-weight: 900;
  color: var(--text-secondary);
}

.rp-date-input {
  border: 1px solid var(--border-soft);
  background: rgba(255,255,255,0.55);
  color: var(--text-primary);
  border-radius: 16px;
  padding: 11px 12px;
  font-size: 14px;
  font-weight: 850;
  outline: none;
  cursor: pointer;
}

.rp-rest-note {
  grid-column: span 2;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(99,102,241,0.08);
  border: 1px solid rgba(99,102,241,0.18);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 850;
  text-align: center;
}

:root[data-theme="dark"] .rp-hero {
  border-color: rgba(148, 163, 184, 0.18);
  background:
    radial-gradient(520px 260px at 92% -20%, rgba(96, 165, 250, 0.22), transparent 64%),
    radial-gradient(460px 220px at 12% 0%, rgba(45, 212, 191, 0.11), transparent 62%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(17, 24, 39, 0.82));
  box-shadow:
    0 22px 54px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

:root[data-theme="dark"] .rp-eyebrow {
  border-color: rgba(96, 165, 250, 0.34);
  background: rgba(96, 165, 250, 0.12);
  color: #93c5fd;
}

:root[data-theme="dark"] .rp-ai-dot {
  background: #93c5fd;
  box-shadow: 0 0 0 5px rgba(96, 165, 250, 0.14);
}

:root[data-theme="dark"] .rp-control-card {
  border-color: rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, rgba(30, 41, 59, 0.74), rgba(15, 23, 42, 0.82));
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(14px) saturate(130%);
}

:root[data-theme="dark"] .rp-ghost-btn,
:root[data-theme="dark"] .rp-date-input {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.78);
  color: #e5edf9;
}

:root[data-theme="dark"] .rp-date-input {
  color-scheme: dark;
}

:root[data-theme="dark"] .rp-ghost-btn:hover,
:root[data-theme="dark"] .rp-date-input:hover,
:root[data-theme="dark"] .rp-date-input:focus {
  border-color: rgba(96, 165, 250, 0.42);
  background: rgba(30, 41, 59, 0.86);
}

:root[data-theme="dark"] .rp-primary-btn {
  border-color: rgba(129, 140, 248, 0.42);
  background:
    linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(45, 212, 191, 0.11));
  color: #eef5ff;
  box-shadow: 0 14px 34px rgba(79, 70, 229, 0.18);
}

:root[data-theme="dark"] .rp-primary-btn:hover:not(:disabled) {
  border-color: rgba(129, 140, 248, 0.58);
  box-shadow: 0 18px 40px rgba(79, 70, 229, 0.24);
}

:root[data-theme="dark"] .rp-rest-note {
  border-color: rgba(129, 140, 248, 0.22);
  background: rgba(99, 102, 241, 0.10);
  color: rgba(226, 232, 240, 0.82);
}

.rp-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.rp-stat-card {
  padding: 16px;
  border-radius: 20px;
  border: 1px solid var(--border-soft);
  background:
    radial-gradient(240px 120px at 100% 0%, rgba(110,168,255,0.14), transparent 60%),
    var(--surface-panel-faint);
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.045);
}

.rp-stat-label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 850;
  margin-bottom: 8px;
}

.rp-stat-value {
  font-size: 26px;
  font-weight: 1000;
  letter-spacing: -0.03em;
}

.rp-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 20px;
  border: 1px solid var(--border-soft);
  background: var(--surface-panel-soft);
  margin-bottom: 14px;
}

.rp-toolbar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.rp-toolbar-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 0 -2px;
}

.rp-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.rp-filter-chip {
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

.rp-filter-chip.active {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--text-primary);
}

.rp-depot-chip {
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

.rp-depot-chip.active {
  border-color: rgba(45,212,191,0.45);
  background: rgba(45,212,191,0.12);
  color: #2dd4bf;
}

.rp-search {
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

.rp-message {
  margin-bottom: 14px;
  padding: 13px 15px;
  border-radius: 18px;
  border: 1px solid var(--border-soft);
  background: var(--surface-panel-soft);
  font-weight: 900;
}

.rp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(285px, 1fr));
  gap: 16px;
}

.rp-card {
  position: relative;
  overflow: hidden;
  min-height: 190px;
  border: 1px solid var(--border-subtle);
  background:
    radial-gradient(280px 150px at 100% 0%, rgba(110,168,255,0.10), transparent 60%),
    var(--surface-panel-faint);
  border-radius: 22px;
  padding: 18px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.07);
  text-align: left;
  cursor: pointer;
  color: var(--text-primary);
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}

.rp-card:hover {
  transform: translateY(-3px);
  border-color: rgba(110,168,255,0.36);
  box-shadow: 0 22px 60px rgba(15, 23, 42, 0.12);
}

.rp-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.rp-code {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--text-secondary);
  font-weight: 850;
}

.rp-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  padding: 6px 11px;
  border-radius: 999px;
  font-weight: 900;
}

.rp-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.rp-card-title {
  font-size: 1.12rem;
  font-weight: 1000;
  letter-spacing: -0.025em;
  line-height: 1.25;
  margin-bottom: 14px;
}

.rp-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}

.rp-metric {
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background: rgba(255,255,255,0.04);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.rp-depot-pill {
  margin-top: 12px;
  display: inline-flex;
  padding: 7px 10px;
  border-radius: 12px;
  border: 1px solid rgba(110,168,255,0.2);
  background: rgba(110,168,255,0.08);
  color: var(--accent-soft);
  font-size: 12px;
  font-weight: 900;
}

.rp-empty {
  padding: 30px;
  border-radius: 22px;
  border: 1px dashed var(--border-soft);
  background: var(--surface-panel-soft);
  text-align: center;
  color: var(--text-secondary);
}

.rp-loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(285px, 1fr));
  gap: 16px;
}

.rp-skeleton {
  height: 190px;
  border-radius: 22px;
  border: 1px solid var(--border-subtle);
  background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.12), rgba(255,255,255,0.04));
  background-size: 240% 100%;
  animation: rpPulse 1.5s infinite linear;
}

@keyframes rpPulse {
  from { background-position: 220% 0; }
  to   { background-position: -20% 0; }
}

.rp-restants {
  margin-top: 18px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(245,158,11,0.35);
  background:
    radial-gradient(420px 220px at 100% 0%, rgba(245,158,11,0.12), transparent 70%),
    rgba(245,158,11,0.07);
}

.rp-restants-head {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 12px;
  margin-bottom: 12px;
}

.rp-restants-title {
  font-size: 18px;
  font-weight: 1000;
  letter-spacing: -0.02em;
}

.rp-restants-subtitle {
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 4px;
}

.rp-restants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.rp-restant-card {
  border-radius: 16px;
  border: 1px solid rgba(245,158,11,0.25);
  background: rgba(255,255,255,0.05);
  padding: 12px;
}

.rp-restant-region {
  font-weight: 950;
  margin-bottom: 6px;
}

.rp-restant-count {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 800;
}

.rp-overlay {
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

.rp-modal {
  width: min(980px, 100%);
  max-height: 92vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 28px;
  border: 1px solid var(--border-soft);
  background:
    radial-gradient(800px 320px at 100% -10%, rgba(110,168,255,0.16), transparent 60%),
    var(--sidebar-bg);
  color: var(--text-primary);
  box-shadow: 0 30px 90px rgba(0,0,0,0.28);
}

.rp-modal-header {
  padding: 24px 24px 16px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border-soft);
}

.rp-modal-title {
  margin: 0;
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.12;
  letter-spacing: -0.04em;
  font-weight: 1000;
}

.rp-modal-desc {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.rp-close-btn {
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

.rp-modal-body {
  padding: 18px 24px 24px;
  overflow-y: auto;
}

.rp-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.rp-info-card {
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-panel-faint);
}

.rp-info-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 7px;
  font-weight: 800;
}

.rp-info-value {
  font-weight: 950;
  line-height: 1.45;
}

.rp-route-section {
  margin-top: 14px;
  padding: 16px;
  border-radius: 22px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-panel-faint);
}

.rp-section-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.rp-section-title strong {
  font-size: 16px;
}

.rp-route-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 6px;
}

.rp-step {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 11px;
  align-items: start;
}

.rp-step-no {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(110,168,255,0.16);
  color: var(--accent-soft);
  font-weight: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(110,168,255,0.28);
}

.rp-step-card {
  border-radius: 16px;
  border: 1px solid var(--border-subtle);
  background: rgba(255,255,255,0.045);
  padding: 12px 14px;
}

.rp-step-address {
  font-weight: 900;
  line-height: 1.45;
}

.rp-step-details {
  margin-top: 7px;
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(110,168,255,0.10);
  color: var(--accent-soft);
  font-size: 12px;
  font-weight: 900;
}

.rp-modal-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.rp-toast {
  position: fixed;
  top: 22px;
  right: 22px;
  z-index: 3000;
  max-width: min(440px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(245,158,11,0.35);
  background: rgba(255,247,237,0.97);
  color: #92400e;
  font-weight: 900;
  line-height: 1.45;
  box-shadow: 0 18px 45px rgba(15,23,42,0.18);
  animation: rpToastIn .25s ease;
}

.rp-toast-title {
  font-size: 13px;
  margin-bottom: 3px;
}

.rp-toast-text {
  font-size: 12px;
  font-weight: 850;
}

@keyframes rpToastIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}


@media (max-width: 900px) {
  .rp-hero {
    grid-template-columns: 1fr;
  }

  .rp-control-card {
    width: 100%;
  }
}

@media (max-width: 860px) {
  .rp-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .rp-info-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .rp-page {
    padding: 12px;
  }

  .rp-control-card {
    grid-template-columns: 1fr;
  }

  .rp-primary-btn,
  .rp-rest-note {
    grid-column: span 1;
  }

  .rp-stats {
    grid-template-columns: 1fr;
  }

  .rp-card {
    min-height: 170px;
  }
}
`;

function getTodayTunisia() {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  return now.toISOString().split("T")[0];
}

function getDayLabel(dateStr) {
  if (!dateStr) return "";
  const fullDays = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  const d = new Date(dateStr + "T12:00:00");
  return `${fullDays[d.getDay()]} ${dateStr}`;
}

export default function RoutePlanner() {
  const [tournees, setTournees] = useState([]);
  const [restants, setRestants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTournee, setSelectedTournee] = useState(null);
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [depotFilter, setDepotFilter] = useState("all");
  const [executionDate, setExecutionDate] = useState(getTodayTunisia);
  const [toast, setToast] = useState("");

  const parcoursSteps = useMemo(
    () => parseParcours(selectedTournee?.parcours_text || ""),
    [selectedTournee]
  );

  const depotList = useMemo(() => extractDepots(tournees), [tournees]);

  const stats = useMemo(() => {
    const total = tournees.length;
    const proposed = tournees.filter((t) => t.status === "proposed").length;
    const accepted = tournees.filter((t) => t.status === "accepted").length;
    const refused = tournees.filter((t) => t.status === "refused").length;
    const totalColis = tournees.reduce(
      (s, t) => s + (Number(t.nombre_colis) || 0),
      0
    );
    const totalPoids = tournees.reduce(
      (s, t) => s + (Number(t.poids_total) || 0),
      0
    );
    return { total, proposed, accepted, refused, totalColis, totalPoids };
  }, [tournees]);

  const filteredTournees = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tournees.filter((t) => {
      const matchStatus =
        statusFilter === "all"
          ? t.status !== "refused"
          : t.status === statusFilter;

      const matchDepot =
        depotFilter === "all" ||
        normalizeDepot(t.depot_label || t.depot_depart || "") ===
          normalizeDepot(depotFilter);

      const text = [
        t.nom,
        t.region,
        t.depot_label,
        t.livreur_name,
        t.vehicle_name,
        `TOUR-${String(t.id).padStart(3, "0")}`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchStatus && matchDepot && (!q || text.includes(q));
    });
  }, [tournees, query, statusFilter, depotFilter]);

  const showToast = (text) => {
    if (!text) return;

    setToast(text);

    window.clearTimeout(window.__rpToastTimer);
    window.__rpToastTimer = window.setTimeout(() => {
      setToast("");
    }, 4500);
  };

  const loadTournees = async () => {
  try {
    const data = await tourneeService.getAll(executionDate);
    setTournees(data || []);

    const restantsData = await tourneeService.getRestants(executionDate);
    setRestants(restantsData || []);
  } catch (err) {
    console.error(err);
    setMsg("Erreur chargement des tournées.");
  }
};

  useEffect(() => {
    loadTournees();
  }, [executionDate]);

  const handleGenerate = async () => {
    try {
      setMsg("");
      setRestants([]);
      setSelectedTournee(null);
      setTournees([]);
      setLoading(true);

      const res = await tourneeService.generateAI(executionDate);
      const dayLabel = getDayLabel(executionDate);
      const warnings = Array.isArray(res?.warnings) ? res.warnings : [];

      setMsg(`${res.count || 0} tournée(s) générée(s) pour ${dayLabel}.`);

      if (warnings.length > 0) {
        showToast(warnings[0]);
      }

      await loadTournees();
    } catch (err) {
      console.error(err);
      setMsg("Erreur génération IA.");
      setRestants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id) => {
    try {
      await tourneeService.accept(id);
      setSelectedTournee(null);
      await loadTournees();
    } catch (err) {
      console.error(err);
      setMsg("Erreur acceptation tournée.");
    }
  };

  const handleRefuse = async (id) => {
    const reason = window.prompt(
      "Pourquoi refuser cette tournée ?",
      "Proposition non adaptée"
    );

    if (!reason) return;

    try {
      await tourneeService.refuse(id, reason);
      setSelectedTournee(null);
      await loadTournees();
    } catch (err) {
      console.error(err);
      setMsg("Erreur refus tournée.");
    }
  };

  const modalStatus = selectedTournee ? getStatus(selectedTournee.status) : null;

  return (
    <div className="rp-page">
      <style>{routePlannerCss}</style>

      {toast && (
        <div className="rp-toast" role="status">
          <div className="rp-toast-title">Notification IA</div>
          <div className="rp-toast-text">{toast}</div>
        </div>
      )}

      <section className="rp-hero">
        <div className="rp-hero-content">
          <div className="rp-eyebrow">
            <span className="rp-ai-dot" />
            Planification intelligente
          </div>

          <h1 className="rp-title">Génération IA des tournées</h1>

          <p className="rp-subtitle">
            Générer, contrôler et valider les tournées proposées selon les colis,
            les véhicules, les dépôts et la capacité.
          </p>
        </div>

        <div className="rp-control-card">
          <button className="rp-ghost-btn" type="button" onClick={loadTournees}>
            Rafraîchir
          </button>

          <div className="rp-date-box">
            <label className="rp-date-label">Date d'exécution</label>
            <input
              className="rp-date-input"
              type="date"
              value={executionDate}
              min={getTodayTunisia()}
              onChange={(e) => setExecutionDate(e.target.value)}
            />
          </div>

          <button
            className="rp-primary-btn"
            type="button"
            onClick={handleGenerate}
            disabled={loading || !executionDate}
          >
            {loading ? "Génération..." : "Générer tournées IA"}
          </button>

          <div className="rp-rest-note">
            Les livreurs en repos ce jour sont exclus automatiquement.
          </div>
        </div>
      </section>

      <section className="rp-stats">
        <StatCard label="Tournées" value={stats.total} />
        <StatCard label="Colis planifiés" value={stats.totalColis} />
        <StatCard
          label="Poids total"
          value={`${formatNumber(stats.totalPoids)} kg`}
        />
        <StatCard label="Proposées" value={stats.proposed} />
      </section>

      <section className="rp-toolbar">
        <div className="rp-toolbar-row">
          <div className="rp-filters">
            <button
              type="button"
              className={`rp-filter-chip ${
                statusFilter === "all" ? "active" : ""
              }`}
              onClick={() => setStatusFilter("all")}
            >
              Toutes
            </button>

            {Object.entries(STATUS_META).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                className={`rp-filter-chip ${
                  statusFilter === key ? "active" : ""
                }`}
                onClick={() => setStatusFilter(key)}
              >
                {meta.short}
              </button>
            ))}
          </div>

          <input
            className="rp-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une tournée, région, livreur..."
          />
        </div>

        <div className="rp-toolbar-divider" />

        <div className="rp-filters">
          <button
            type="button"
            className={`rp-depot-chip ${
              depotFilter === "all" ? "active" : ""
            }`}
            onClick={() => setDepotFilter("all")}
          >
            Tous les dépôts
          </button>

          {depotList.map((depot) => (
            <button
              key={depot}
              type="button"
              className={`rp-depot-chip ${
                normalizeDepot(depotFilter) === normalizeDepot(depot)
                  ? "active"
                  : ""
              }`}
              onClick={() => setDepotFilter(depot)}
            >
              {depot}
            </button>
          ))}
        </div>
      </section>

      {msg && <div className="rp-message">{msg}</div>}

      {loading ? (
        <div className="rp-loading-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rp-skeleton" />
          ))}
        </div>
      ) : filteredTournees.length === 0 ? (
        <div className="rp-empty">
          <strong>Aucune tournée trouvée.</strong>
          <div style={{ marginTop: 6 }}>
            Lance la génération IA ou modifie les filtres de recherche.
          </div>
        </div>
      ) : (
        <div className="rp-grid">
          {filteredTournees.map((t) => {
            const status = getStatus(t.status);

            return (
              <button
                key={t.id}
                type="button"
                className="rp-card"
                onClick={() => setSelectedTournee(t)}
              >
                <div className="rp-card-top">
                  <span className="rp-code">
                    TOUR-{String(t.id).padStart(3, "0")}
                  </span>

                  <span
                    className="rp-status"
                    style={{
                      background: status.bg,
                      color: status.color,
                      border: `1px solid ${status.border}`,
                    }}
                  >
                    <span
                      className="rp-status-dot"
                      style={{ background: status.dot }}
                    />
                    {status.label}
                  </span>
                </div>

                <div className="rp-card-title">{getTourneeTitle(t)}</div>

                <div className="rp-metrics">
                  <span className="rp-metric">{t.nombre_colis || 0} colis</span>
                  <span className="rp-metric">
                    {formatNumber(t.poids_total)} kg
                  </span>
                  <span className="rp-metric">
                    {formatNumber(t.distance_km, 0)} km
                  </span>
                </div>

                <div className="rp-depot-pill">
                  {t.depot_label || t.depot_depart || "-"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tournees.length > 0 && restants.length > 0 && (
        <section className="rp-restants">
          <div className="rp-restants-head">
            <div>
              <div className="rp-restants-title">
                Colis restants non affectés
              </div>
              <div className="rp-restants-subtitle">
                Les groupes restants sont inférieurs aux règles de génération ou
                non compatibles avec les contraintes.
              </div>
            </div>

            <div className="rp-filter-chip active">
              {restants.reduce((s, g) => s + g.count, 0)} colis non affectés
            </div>
          </div>

          <div className="rp-restants-grid">
            {restants.map((group, index) => (
              <div key={`${group.region}-${index}`} className="rp-restant-card">
                <div className="rp-restant-region">{group.region}</div>
                <div className="rp-restant-count">
                  {group.count} colis non affectés
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedTournee && (
        <div className="rp-overlay" onClick={() => setSelectedTournee(null)}>
          <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rp-modal-header">
              <div>
                <div
                  className="rp-status"
                  style={{
                    background: modalStatus.bg,
                    color: modalStatus.color,
                    border: `1px solid ${modalStatus.border}`,
                    marginBottom: 10,
                  }}
                >
                  <span
                    className="rp-status-dot"
                    style={{ background: modalStatus.dot }}
                  />
                  {modalStatus.label}
                </div>

                <h2 className="rp-modal-title">{selectedTournee.nom}</h2>
                <p className="rp-modal-desc">
                  Détails de la tournée proposée par l'IA.
                </p>
              </div>

              <button
                className="rp-close-btn"
                type="button"
                onClick={() => setSelectedTournee(null)}
              >
                ×
              </button>
            </div>

            <div className="rp-modal-body">
              <div className="rp-info-grid">
                <Info label="Livreur" value={selectedTournee.livreur_name} />
                <Info
                  label="Véhicule"
                  value={`${selectedTournee.vehicle_name || "-"} | Capacité: ${
                    selectedTournee.vehicle_capacity || "-"
                  } kg`}
                />
                <Info
                  label="Nombre colis"
                  value={selectedTournee.nombre_colis}
                />
                <Info
                  label="Poids total"
                  value={`${formatNumber(selectedTournee.poids_total)} kg`}
                />
                <Info
                  label="Distance estimée"
                  value={`${formatNumber(selectedTournee.distance_km, 0)} km`}
                />
                <Info
                  label="Dépôt départ / arrivée"
                  value={`${selectedTournee.depot_label || selectedTournee.depot_depart || "-"}${
                    selectedTournee.depot_adresse
                      ? ` — ${selectedTournee.depot_adresse}`
                      : ""
                  }`}
                />
              </div>

              <div className="rp-route-section">
                <div className="rp-section-title">
                  <strong>Parcours</strong>
                  <span
                    style={{
                      color: "var(--text-secondary)",
                      fontWeight: 850,
                    }}
                  >
                    {parcoursSteps.length} étapes
                  </span>
                </div>

                {parcoursSteps.length > 0 ? (
                  <div className="rp-route-list">
                    {parcoursSteps.map((step) => (
                      <div key={step.id} className="rp-step">
                        <div className="rp-step-no">{step.id}</div>
                        <div className="rp-step-card">
                          <div className="rp-step-address">
                            {step.adresse}
                          </div>
                          {step.details && (
                            <div className="rp-step-details">
                              {step.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      color: "var(--text-secondary)",
                      fontWeight: 800,
                    }}
                  >
                    Aucun parcours disponible.
                  </div>
                )}
              </div>

              <div className="rp-modal-actions">
                {selectedTournee.status !== "accepted" && (
                  <button
                    type="button"
                    className="rp-success-btn"
                    onClick={() => handleAccept(selectedTournee.id)}
                  >
                    Accepter
                  </button>
                )}

                {selectedTournee.status !== "refused" && (
                  <button
                    type="button"
                    className="rp-danger-btn"
                    onClick={() => handleRefuse(selectedTournee.id)}
                  >
                    Refuser
                  </button>
                )}

                <button
                  type="button"
                  className="rp-ghost-btn"
                  onClick={() => setSelectedTournee(null)}
                >
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

function StatCard({ label, value }) {
  return (
    <div className="rp-stat-card">
      <div className="rp-stat-label">{label}</div>
      <div className="rp-stat-value">{value}</div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rp-info-card">
      <div className="rp-info-label">{label}</div>
      <div className="rp-info-value">{value || "-"}</div>
    </div>
  );
}
