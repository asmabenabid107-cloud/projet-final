import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import PasswordInput from "./PasswordInput";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import "../App.css";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const otpCode = searchParams.get("otp");
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (formData.newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email,
        otp_code: otpCode,
        new_password: formData.newPassword,
      });
      alert("Mot de passe reinitialise avec succes !");
      navigate("/expediteur/login");
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Erreur lors de la reinitialisation. Veuillez reessayer.",
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
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800 }}>Nouveau mot de passe</div>
          <ThemeToggleButton compact />
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: 12, marginTop: 14 }}
        >
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

          <PasswordInput
            value={formData.newPassword}
            onChange={(e) =>
              setFormData({ ...formData, newPassword: e.target.value })
            }
            placeholder="Nouveau mot de passe"
            required
            disabled={loading}
            autoComplete="new-password"
          />

          <PasswordInput
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
            placeholder="Confirmer mot de passe"
            required
            disabled={loading}
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              borderRadius: 12,
              padding: 12,
              background: "var(--accent-bg)",
              border: "1px solid var(--accent-border)",
              color: "var(--text-primary)",
              fontWeight: 800,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Reinitialisation..." : "Reinitialiser"}
          </button>
        </form>
      </div>
    </div>
  );
}
