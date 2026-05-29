import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../api/client.js";

function formatDate(value) {
  if (!value) return "Non definie";

  const raw = typeof value === "string" ? value.slice(0, 10) : value;
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("fr-TN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function isCurrentApprovedLeave(item) {
  if (item.status !== "approved") return false;

  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const start = new Date(`${item.start_date}T00:00:00`);
  const end = new Date(`${item.end_date}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  return start.getTime() <= todayKey && end.getTime() >= todayKey;
}

function getStatusMeta(status) {
  if (status === "approved") {
    return {
      label: "Approuvee",
      border: "rgba(44,203,118,.35)",
      bg: "rgba(44,203,118,.12)",
      color: "var(--success)",
    };
  }

  if (status === "denied") {
    return {
      label: "Refusee",
      border: "rgba(255,95,95,.35)",
      bg: "rgba(255,95,95,.12)",
      color: "var(--danger-soft)",
    };
  }

  return {
    label: "En attente",
    border: "rgba(245,158,11,.35)",
    bg: "rgba(245,158,11,.12)",
    color: "#f8c56b",
  };
}

const fieldStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border-soft)",
  background: "var(--surface-card)",
  color: "var(--text-primary)",
  padding: "12px 14px",
  outline: "none",
};

const viewButtonStyle = (active) => ({
  borderRadius: 14,
  padding: "10px 14px",
  fontWeight: 900,
  border: `1px solid ${active ? "rgba(110,168,255,.35)" : "rgba(255,255,255,.14)"}`,
  background: active ? "rgba(110,168,255,.12)" : "rgba(255,255,255,.06)",
  color: "var(--text-primary)",
  cursor: "pointer",
});

export default function LivreursConges() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [denyTarget, setDenyTarget] = useState(null);
  const [denyReason, setDenyReason] = useState("");
  const [activeView, setActiveView] = useState("requested");

  const currentLeaves = useMemo(
    () => items.filter((item) => isCurrentApprovedLeave(item)),
    [items],
  );
  const pendingItems = useMemo(
    () => items.filter((item) => item.status === "pending"),
    [items],
  );
  const historyItems = useMemo(
    () =>
      items.filter(
        (item) => item.status !== "pending" && !isCurrentApprovedLeave(item),
      ),
    [items],
  );

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const res = await api.get("/admin/courier-leaves");
      setItems(res.data || []);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401) setMsg("Session expiree. Reconnecte-toi en admin.");
      else if (status === 403) setMsg("Acces refuse: tu n'es pas admin.");
      else setMsg(detail || err?.message || "Erreur chargement des demandes de conge.");
    } finally {
      setLoading(false);
    }
  }

  async function approve(item) {
    if (!confirm(`Approuver la demande de conge de ${item.courier_name} ?`)) return;

    setMsg("");
    setSavingId(item.id);
    try {
      await api.post(`/admin/courier-leaves/${item.id}/approve`);
      await load();
    } catch (err) {
      setMsg(err?.response?.data?.detail || err?.message || "Erreur approbation.");
    } finally {
      setSavingId(null);
    }
  }

  function openDenyModal(item) {
    setDenyTarget(item);
    setDenyReason("");
  }

  function closeDenyModal() {
    if (savingId) return;
    setDenyTarget(null);
    setDenyReason("");
  }

  async function submitDeny() {
    if (!denyTarget) return;
    if (!denyReason.trim()) {
      setMsg("Ajoute une raison avant de refuser la demande.");
      return;
    }

    setMsg("");
    setSavingId(denyTarget.id);
    try {
      await api.post(`/admin/courier-leaves/${denyTarget.id}/deny`, {
        denial_reason: denyReason.trim(),
      });
      setDenyTarget(null);
      setDenyReason("");
      await load();
    } catch (err) {
      setMsg(err?.response?.data?.detail || err?.message || "Erreur refus.");
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const displayItems = activeView === "requested" ? pendingItems : historyItems;

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
            "radial-gradient(900px 280px at 85% -30%, rgba(245,158,11,.18), transparent 60%), rgba(255,255,255,.04)",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: 0.2 }}>
            Conges livreurs
          </div>
          <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4 }}>
            Gere les demandes, l'historique et les conges actuellement actifs.
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
              border: "1px solid var(--border-strong)",
              background: "var(--surface-card)",
              color: "var(--text-primary)",
              cursor: "pointer",
            }}
          >
            Retour livreurs
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
        </div>
      )}

      <section style={{ marginTop: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>Conge actuel</div>

        {loading ? (
          <div style={{ opacity: 0.85 }}>Chargement...</div>
        ) : currentLeaves.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              border: "1px solid var(--border-soft)",
              background: "var(--surface-panel-soft)",
              opacity: 0.9,
            }}
          >
            Aucun livreur n'est actuellement en conge.
          </div>
        ) : (
          <div className="adminThreeGrid" style={{ display: "grid", gap: 12 }}>
            {currentLeaves.map((item) => (
              <div
                key={item.id}
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(44,203,118,.20)",
                  background: "linear-gradient(180deg, rgba(44,203,118,.10), rgba(0,0,0,.18))",
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>{item.courier_name}</div>
                    <div style={{ opacity: 0.82, fontSize: 13, marginTop: 4 }}>{item.courier_email}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid var(--success-border)",
                      background: "var(--success-bg)",
                      color: "var(--success)",
                      height: "fit-content",
                    }}
                  >
                    En conge
                  </span>
                </div>

                <div style={{ marginTop: 10, opacity: 0.82, fontSize: 13 }}>
                  Du {formatDate(item.start_date)} au {formatDate(item.end_date)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setActiveView("requested")}
            style={viewButtonStyle(activeView === "requested")}
          >
            Demandes conges ({pendingItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveView("history")}
            style={viewButtonStyle(activeView === "history")}
          >
            Historique ({historyItems.length})
          </button>
        </div>

        {loading ? (
          <div style={{ opacity: 0.85 }}>Chargement...</div>
        ) : displayItems.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              border: "1px solid var(--border-soft)",
              background: "var(--surface-panel-soft)",
              opacity: 0.9,
            }}
          >
            {activeView === "requested"
              ? "Aucune demande de conge en attente."
              : "Aucun historique de conge pour le moment."}
          </div>
        ) : (
          <div className="adminThreeGrid" style={{ display: "grid", gap: 12 }}>
            {displayItems.map((item) => {
              const meta = getStatusMeta(item.status);

              return (
                <div
                  key={item.id}
                  style={{
                    borderRadius: 18,
                    border: "1px solid var(--border-soft)",
                    background:
                      activeView === "requested"
                        ? "linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.18))"
                        : "rgba(255,255,255,.04)",
                    padding: 14,
                    boxShadow:
                      activeView === "requested" ? "0 18px 50px rgba(0,0,0,.35)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{item.courier_name}</div>
                      <div style={{ opacity: 0.82, fontSize: 13, marginTop: 4 }}>{item.courier_email}</div>
                    </div>

                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: `1px solid ${meta.border}`,
                        background: meta.bg,
                        color: meta.color,
                        height: "fit-content",
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
  <div style={{ opacity: 0.82, fontSize: 13 }}>
    Du {formatDate(item.start_date)} au {formatDate(item.end_date)}
  </div>

  <div style={{ opacity: 0.62, fontSize: 12 }}>
    Demandee le {formatDate(item.requested_at)}
  </div>

  {item.description_conge && (
    <div
      style={{
        marginTop: 6,
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(110,168,255,.20)",
        background: "rgba(110,168,255,.08)",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <strong>Motif du congé :</strong> {item.description_conge}
    </div>
  )}

                    {item.reviewed_at && (
                      <div style={{ opacity: 0.62, fontSize: 12 }}>
                        Traitee le {formatDate(item.reviewed_at)}
                      </div>
                    )}
                    {item.status === "denied" && item.denial_reason && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: 10,
                          borderRadius: 12,
                          border: "1px solid rgba(255,95,95,.25)",
                          background: "var(--danger-bg)",
                          fontSize: 13,
                        }}
                      >
                        Raison du refus: {item.denial_reason}
                      </div>
                    )}
                  </div>

                  {activeView === "requested" && (
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                        marginTop: 14,
                      }}
                    >
                      <button
                        onClick={() => approve(item)}
                        disabled={savingId === item.id}
                        style={{
                          borderRadius: 14,
                          border: "1px solid var(--success-border)",
                          background: "var(--success-bg)",
                          color: "var(--text-primary)",
                          padding: "10px 14px",
                          fontWeight: 950,
                          cursor: savingId === item.id ? "not-allowed" : "pointer",
                          minWidth: 120,
                          opacity: savingId === item.id ? 0.7 : 1,
                        }}
                      >
                        Approuver
                      </button>

                      <button
                        onClick={() => openDenyModal(item)}
                        disabled={savingId === item.id}
                        style={{
                          borderRadius: 14,
                          border: "1px solid var(--danger-border)",
                          background: "rgba(255,95,95,.12)",
                          color: "var(--text-primary)",
                          padding: "10px 14px",
                          fontWeight: 950,
                          cursor: savingId === item.id ? "not-allowed" : "pointer",
                          minWidth: 120,
                          opacity: savingId === item.id ? 0.7 : 1,
                        }}
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {denyTarget && (
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
              width: "min(560px, 92vw)",
              background: "var(--auth-panel-bg)",
              border: "1px solid var(--border-soft)",
              borderRadius: 18,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900 }}>Refuser la demande</div>
            <div style={{ marginTop: 6, opacity: 0.74, fontSize: 13 }}>
              Ajoute une raison de refus pour <strong>{denyTarget.courier_name}</strong>.
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Raison du refus</div>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                rows={4}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closeDenyModal}
                style={{
                  borderRadius: 12,
                  padding: "10px 14px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-card)",
                  color: "var(--text-primary)",
                  cursor: savingId ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  opacity: savingId ? 0.6 : 1,
                }}
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={savingId === denyTarget.id}
                onClick={submitDeny}
                style={{
                  borderRadius: 12,
                  padding: "10px 14px",
                  border: "1px solid var(--danger-border)",
                  background: "rgba(255,95,95,.12)",
                  color: "var(--text-primary)",
                  cursor: savingId === denyTarget.id ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  opacity: savingId === denyTarget.id ? 0.7 : 1,
                }}
              >
                {savingId === denyTarget.id ? "Refus..." : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
