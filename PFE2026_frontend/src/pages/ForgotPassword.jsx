import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import "../App.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await api.post("/auth/forgot-password", { email });
      setMessage("Un code OTP a ete envoye a votre email.");
      setTimeout(() => {
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
      }, 1500);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Une erreur est survenue. Veuillez reessayer.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <div
        style={{
          width: "min(520px, 92vw)",
          background: "var(--auth-panel-bg)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              Mot de passe oublie
            </div>
            <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
              Entrez votre email pour recevoir un code OTP.
            </div>
          </div>
          <ThemeToggleButton compact />
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: 12, marginTop: 14 }}
        >
          {message && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid var(--accent-border)",
                background: "var(--surface-panel-soft)",
                padding: 10,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid var(--danger-border)",
                background: "var(--surface-panel-soft)",
                padding: 10,
              }}
            >
              {error}
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
              Email
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              disabled={loading}
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1px solid var(--border-soft)",
                background: "var(--surface-panel-soft)",
                color: "var(--text-primary)",
                padding: 12,
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              borderRadius: 12,
              border: "1px solid var(--accent-border)",
              background: "var(--accent-bg)",
              color: "var(--text-primary)",
              padding: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {loading ? "Envoi..." : "Envoyer OTP"}
          </button>
        </form>
      </div>
    </div>
  );
}
