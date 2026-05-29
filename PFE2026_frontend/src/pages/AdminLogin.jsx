import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../api/client.js";
import PasswordInput from "./PasswordInput";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import "./AdminLogin.css";

function HomeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path
        d="M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.2Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path
        d="M12 3.5 19 6v5.4c0 4.5-2.8 7.8-7 9.1-4.2-1.3-7-4.6-7-9.1V6l7-2.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m9.2 12.2 1.9 1.9 4-4.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || "/admin/dashboard";

  const [email, setEmail] = useState("admin@mz.com");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setMsg("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("admin_access_token", res.data.access_token);
      navigate(returnTo, { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const fallback = err?.message || "Erreur de connexion admin";
      setMsg(detail || fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="adminLoginPage" aria-label="Connexion admin">
      <video
        className="adminLoginVideoLayer"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/229733769-m.jpg"
        aria-hidden="true"
      >
        <source src="/adminvid.mp4" type="video/mp4" />
      </video>
      <div className="adminLoginDimLayer" aria-hidden="true" />

      <section className="adminLoginFrame">
        <header className="adminLoginHeader">
          <button className="adminLoginHome" type="button" onClick={() => navigate("/")}>
            <HomeIcon />
            <span>Accueil</span>
          </button>
          <ThemeToggleButton compact />
        </header>

        <section className="adminLoginMain">
          <aside className="adminLoginConsole" aria-label="Console admin">
            <div className="adminLoginShield">
              <ShieldIcon />
            </div>
            <p className="adminLoginEyebrow">Admin control</p>
            <h1>Centre de pilotage MZ Logistic</h1>
            <p>
              Controlez les comptes, les colis, les tournees et les validations
              depuis un acces admin dedie.
            </p>

          </aside>

          <section className="adminLoginCard" aria-labelledby="admin-login-title">
            <p className="adminLoginEyebrow">Connexion securisee</p>
            <h2 id="admin-login-title">Connexion Admin</h2>
            <p className="adminLoginIntro">Acces au tableau de bord MZ Logistic.</p>

            <form className="adminLoginForm" onSubmit={onSubmit}>
              <label className="adminLoginField" htmlFor="admin-login-email">
                <span>Email</span>
                <input
                  id="admin-login-email"
                  className="adminLoginInput"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@mz.com"
                  disabled={loading}
                  autoComplete="email"
                />
              </label>

              <label className="adminLoginField" htmlFor="admin-login-password">
                <span>Mot de passe</span>
                <PasswordInput
                  id="admin-login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  wrapperClassName="adminLoginPassword"
                />
              </label>

              {msg && (
                <div className="adminLoginAlert" role="alert">
                  {msg}
                </div>
              )}

              <button className="adminLoginSubmit" type="submit" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>

          </section>
        </section>
      </section>
    </main>
  );
}
