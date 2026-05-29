import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";

export default function ExpediteursApproved() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((u) => {
      return (
        (u.name || "").toLowerCase().includes(s) ||
        (u.email || "").toLowerCase().includes(s) ||
        (u.phone || "").toLowerCase().includes(s)
      );
    });
  }, [items, q]);

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const res = await api.get("/admin/shippers/approved");
      setItems(res.data || []);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      if (status === 401) setMsg("Session expirée. Reconnecte-toi en admin.");
      else if (status === 403) setMsg("Accès refusé: admin requis.");
      else setMsg(detail || err?.message || "Erreur chargement des expéditeurs approuvés.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (!confirm("Supprimer cet expéditeur ?")) return;
    setMsg("");
    try {
      await api.delete(`/admin/shippers/${id}`);
      await load();
    } catch (err) {
      setMsg(err?.response?.data?.detail || err?.message || "Erreur suppression.");
    }
  }

  useEffect(() => {
    load();
  }, []);

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
            "radial-gradient(900px 280px at 85% -30%, rgba(44,203,118,.22), transparent 60%), rgba(255,255,255,.04)",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: 0.2 }}>
            Expéditeurs approuvés
          </div>
          <div style={{ opacity: 0.78, fontSize: 13, marginTop: 4 }}>
            Comptes validés par l’admin.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/admin/expediteurs")}
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
            Voir demandes
          </button>

          <button
            type="button"
            onClick={load}
            disabled={loading}
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
            {loading ? "Chargement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher (nom, email, téléphone)…"
          style={{
            flex: "1 1 320px",
            borderRadius: 14,
            border: "1px solid var(--border-soft)",
            background: "var(--surface-panel-soft)",
            color: "var(--text-primary)",
            padding: "12px 12px",
            outline: "none",
          }}
        />
        <div
          style={{
            borderRadius: 999,
            border: "1px solid var(--border-soft)",
            background: "var(--surface-card)",
            padding: "8px 12px",
            fontWeight: 900,
            opacity: 0.9,
          }}
        >
          {filtered.length}
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

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div style={{ opacity: 0.85 }}>Chargement...</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              border: "1px solid var(--border-soft)",
              background: "var(--surface-panel-soft)",
              opacity: 0.9,
            }}
          >
            Aucun expéditeur approuvé.
          </div>
        ) : (
          <div className="adminThreeGrid" style={{ display: "grid", gap: 12 }}>
            {filtered.map((u) => (
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
                        fontWeight: 950,
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--success-border)",
                        background: "var(--success-bg)",
                        opacity: 0.95,
                      }}
                    >
                      Approuvé
                    </span>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 7 }}>
  <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.9 }}>
    <span style={{ opacity: 0.75, width: 82, fontSize: 12 }}>Email</span>
    <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
      {u.email || "-"}
    </span>
  </div>

  <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.9 }}>
    <span style={{ opacity: 0.75, width: 82, fontSize: 12 }}>Tél</span>
    <span style={{ fontSize: 13 }}>{u.phone || "-"}</span>
  </div>

  <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.9 }}>
    <span style={{ opacity: 0.75, width: 82, fontSize: 12 }}>Tél 2</span>
    <span style={{ fontSize: 13 }}>{u.phone2 || "-"}</span>
  </div>

  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: 0.9 }}>
    <span style={{ opacity: 0.75, width: 82, fontSize: 12 }}>Adresse</span>
    <span
      style={{
        fontSize: 13,
        lineHeight: 1.45,
        overflowWrap: "anywhere",
      }}
    >
      {u.address || "-"}
    </span>
  </div>
</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    onClick={() => remove(u.id)}
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
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
