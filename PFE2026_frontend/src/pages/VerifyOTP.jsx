import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import "../App.css";

export default function VerifyOTP() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const navigate = useNavigate();

  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post("/auth/verify-otp", {
        email,
        otp_code: otpCode,
      });
      navigate(
        `/reset-password?email=${encodeURIComponent(email)}&otp=${otpCode}`,
      );
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
            <div style={{ fontSize: 22, fontWeight: 800 }}>Verification OTP</div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              Code envoye a {email}
            </div>
          </div>
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

          <input
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
            required
            style={{
              width: "100%",
              borderRadius: 12,
              padding: 12,
              background: "var(--surface-panel-soft)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-soft)",
            }}
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
            }}
          >
            {loading ? "Verification..." : "Verifier"}
          </button>
        </form>
      </div>
    </div>
  );
}
