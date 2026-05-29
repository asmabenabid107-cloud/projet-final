import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../api/client.js";
import {
  DAY_OFF_OPTIONS,
  DEPOT_OPTIONS,
  REGION_OPTIONS,
  getDayOffLabel,
} from "../../constants/courierOptions.js";

const selectStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border-soft)",
  background: "var(--surface-card)",
  color: "var(--text-primary)",
  padding: "12px 14px",
  outline: "none",
};

function getTodayDateValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

const TODAY_DATE = getTodayDateValue();

function formatContractDateForMessage(value) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("fr-TN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function Livreurs() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [approvalTarget, setApprovalTarget] = useState(null);
  const [assignedRegion, setAssignedRegion] = useState(REGION_OPTIONS[0]);
  const [assignedDepot, setAssignedDepot] = useState(DEPOT_OPTIONS[0]);
  const [assignedDayOff, setAssignedDayOff] = useState(DAY_OFF_OPTIONS[0].value);
  const [contractEndDate, setContractEndDate] = useState("");
  const [savingApproval, setSavingApproval] = useState(false);

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const res = await api.get("/admin/couriers/pending");
      setItems(res.data || []);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401) setMsg("Session expiree. Reconnecte-toi en admin.");
      else if (status === 403) setMsg("Acces refuse: tu n'es pas admin.");
      else setMsg(detail || err?.message || "Erreur chargement des demandes.");
    } finally {
      setLoading(false);
    }
  }

  function openApproveModal(courier) {
    setAssignedRegion(courier?.assigned_region || REGION_OPTIONS[0]);
    setAssignedDepot(courier?.assigned_depot || DEPOT_OPTIONS[0]);
    setAssignedDayOff(courier?.day_off || DAY_OFF_OPTIONS[0].value);
    setContractEndDate("");
    setApprovalTarget(courier);
  }

  function closeApproveModal() {
    if (savingApproval) return;
    setApprovalTarget(null);
  }

  async function approveSelectedCourier() {
    if (!approvalTarget) return;
    if (!contractEndDate) {
      setMsg("Choisis une date de fin de contrat avant validation.");
      return;
    }

    const confirmationMessage =
  `Confirmer le livreur ${approvalTarget.name} ?\n\n` +
  `Region : ${assignedRegion}\n` +
  `Depot : ${assignedDepot}\n` +
  `Jour de repos : ${getDayOffLabel(assignedDayOff)}\n` +
  `Fin de contrat : ${formatContractDateForMessage(contractEndDate)}\n\n` +
  "Cette date ne pourra plus etre modifiee apres validation.";

    if (!confirm(confirmationMessage)) return;

    setMsg("");
    setSavingApproval(true);
    try {
      await api.post(`/admin/couriers/${approvalTarget.id}/approve`, {
        assigned_region: assignedRegion,
        assigned_depot: assignedDepot,
        contract_end_date: contractEndDate,
        day_off: assignedDayOff,
      });
      setApprovalTarget(null);
      await load();
      navigate("/admin/livreurs/approuves");
    } catch (err) {
      setMsg(err?.response?.data?.detail || err?.message || "Erreur approbation.");
    } finally {
      setSavingApproval(false);
    }
  }

  async function reject(id) {
    if (!confirm("Refuser ce livreur ? Le compte sera desactive.")) return;
    setMsg("");
    try {
      await api.post(`/admin/couriers/${id}/reject`);
      await load();
    } catch (err) {
      setMsg(err?.response?.data?.detail || err?.message || "Erreur refus.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const normalizedSearch = normalizeSearchValue(search);
  const filteredItems = items.filter((courier) => {
    if (!normalizedSearch) return true;
    return [courier.name, courier.email, courier.phone].some((value) =>
      normalizeSearchValue(value).includes(normalizedSearch),
    );
  });

  return (
    <div style={{ padding: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          padding: 14,
          borderRadius: 18,
          border: "1px solid var(--border-soft)",
          background:
            "radial-gradient(900px 280px at 85% -30%, rgba(45,91,255,.25), transparent 60%), rgba(255,255,255,.04)",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: 0.2 }}>
            Demandes livreurs
          </div>
          <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4 }}>
            La region, le depot, le jour de repos et la date de fin de contrat sont choisis au moment de l'approbation.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/admin/livreurs/approuves")}
            type="button"
            style={{
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 900,
              border: "1px solid var(--success-border)",
              background: "var(--success-bg)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            Voir approuves
          </button>

          <button
            onClick={load}
            disabled={loading}
            type="button"
            style={{
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 900,
              border: "1px solid var(--border-strong)",
              background: "var(--surface-card)",
              color: "var(--text-primary)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Chargement..." : "Rafraichir"}
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher par email ou numero..."
          style={{ ...selectStyle, flex: "1 1 280px", minWidth: 220 }}
        />

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--border-soft)",
            background: "var(--surface-card)",
            color: "var(--text-secondary)",
            fontSize: 12,
            minWidth: 180,
          }}
        >
          {filteredItems.length} demande(s)
        </div>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 16,
            border: "1px solid var(--danger-border)",
            background: "var(--danger-bg)",
          }}
        >
          <div style={{ fontWeight: 800 }}>{msg}</div>
          {(msg.includes("Reconnecte") || msg.includes("Session expiree")) && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => {
                  localStorage.removeItem("admin_access_token");
                  navigate("/admin/login");
                }}
                style={{
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-card)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Aller au login admin
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div style={{ opacity: 0.85 }}>Chargement...</div>
        ) : items.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              border: "1px solid var(--border-soft)",
              background: "var(--surface-panel-soft)",
              opacity: 0.9,
            }}
          >
            Aucune demande en attente.
          </div>
        ) : filteredItems.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              border: "1px solid var(--border-soft)",
              background: "var(--surface-panel-soft)",
              opacity: 0.9,
            }}
          >
            Aucune demande ne correspond a cette recherche.
          </div>
        ) : (
          <div className="adminThreeGrid" style={{ display: "grid", gap: 12 }}>
            {filteredItems.map((u) => (
              <div
                key={u.id}
                style={{
                  borderRadius: 18,
                  border: "1px solid var(--border-soft)",
                  background: "linear-gradient(180deg, var(--surface-card), var(--surface-inset))",
                  padding: 14,
                  boxShadow: "var(--shadow-soft)",
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>{u.name}</div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--border-strong)",
                        background: "var(--surface-card)",
                        opacity: 0.92,
                      }}
                    >
                      En attente
                    </span>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.9 }}>
                      <span style={{ opacity: 0.75, width: 64, fontSize: 12 }}>Email</span>
                      <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {u.email}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.9 }}>
                      <span style={{ opacity: 0.75, width: 64, fontSize: 12 }}>Tel</span>
                      <span style={{ fontSize: 13 }}>{u.phone}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
                  <button
                    onClick={() => openApproveModal(u)}
                    style={{
                      borderRadius: 14,
                      border: "1px solid var(--success-border)",
                      background: "var(--success-bg)",
                      color: "var(--text-primary)",
                      padding: "10px 14px",
                      fontWeight: 950,
                      cursor: "pointer",
                      minWidth: 140,
                    }}
                  >
                    Affecter et confirmer
                  </button>

                  <button
                    onClick={() => reject(u.id)}
                    style={{
                      borderRadius: 14,
                      border: "1px solid var(--danger-border)",
                      background: "rgba(255,95,95,.12)",
                      color: "var(--text-primary)",
                      padding: "10px 14px",
                      fontWeight: 950,
                      cursor: "pointer",
                      minWidth: 120,
                    }}
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {approvalTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: "min(520px, 92vw)",
              background: "var(--auth-panel-bg)",
              border: "1px solid var(--border-soft)",
              borderRadius: 18,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900 }}>Validation du livreur</div>
            <div style={{ marginTop: 6, opacity: 0.74, fontSize: 13 }}>
              Choisis la region, le depot, le jour de repos et la date de fin de contrat de <strong>{approvalTarget.name}</strong>.
              Le statut sera mis a <strong>actif</strong> jusqu'a la fin du contrat.
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Region assignee</div>
                <select
                  value={assignedRegion}
                  onChange={(e) => setAssignedRegion(e.target.value)}
                  style={selectStyle}
                >
                  {REGION_OPTIONS.map((region) => (
                    <option key={region} value={region} style={{ background: "var(--auth-panel-bg)" }}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Depot de travail</div>
                <select
                  value={assignedDepot}
                  onChange={(e) => setAssignedDepot(e.target.value)}
                  style={selectStyle}
                >
                  {DEPOT_OPTIONS.map((depot) => (
                    <option key={depot} value={depot} style={{ background: "var(--auth-panel-bg)" }}>
                      {depot}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Jour de repos</div>
                <select
                  value={assignedDayOff}
                  onChange={(e) => setAssignedDayOff(e.target.value)}
                  style={selectStyle}
                >
                  {DAY_OFF_OPTIONS.map((day) => (
                    <option key={day.value} value={day.value} style={{ background: "var(--auth-panel-bg)" }}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Fin de contrat</div>
                <input
                  type="date"
                  value={contractEndDate}
                  min={TODAY_DATE}
                  onChange={(e) => setContractEndDate(e.target.value)}
                  style={selectStyle}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid var(--warning-border)",
                background: "var(--warning-bg)",
                color: "var(--text-primary)",
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              Apres confirmation, la date de fin de contrat sera verrouillee. Quand cette date sera atteinte,
              le statut du livreur passera automatiquement a <strong>Contrat termine</strong>.
              Chaque semaine, le jour choisi affichera <strong>Jour de repos</strong>.
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closeApproveModal}
                style={{
                  borderRadius: 12,
                  padding: "10px 14px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-card)",
                  color: "var(--text-primary)",
                  cursor: savingApproval ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  opacity: savingApproval ? 0.6 : 1,
                }}
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={savingApproval}
                onClick={approveSelectedCourier}
                style={{
                  borderRadius: 12,
                  padding: "10px 14px",
                  border: "1px solid var(--success-border)",
                  background: "var(--success-bg)",
                  color: "var(--text-primary)",
                  cursor: savingApproval ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  opacity: savingApproval ? 0.7 : 1,
                }}
              >
                {savingApproval ? "Validation..." : "Confirmer le livreur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
