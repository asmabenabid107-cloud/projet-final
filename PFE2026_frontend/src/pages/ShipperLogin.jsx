import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

import { api } from "../api/client.js";
import PasswordInput from "./PasswordInput";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import "./ShipperLogin.css";

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

function RouteIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path
        d="M6 5.5h5.5a4 4 0 0 1 0 8H10A4 4 0 0 0 10 21h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M6 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function ShipperLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const infoMsg = useMemo(() => location.state?.msg || "", [location.state]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setErr("");
    setLoading(true);

    try {
      const res = await api.post("/auth/shipper/login", { email, password });
      localStorage.setItem("shipper_access_token", res.data.access_token);
      navigate("/expediteur/dashboard");
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;

      if (status === 403) setErr(detail || "Compte en attente de confirmation admin");
      else setErr(detail || "Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shipperLoginPage" aria-label="Connexion expediteur">
      <video
        className="shipperLoginVideoLayer"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/229733769-m.jpg"
        aria-hidden="true"
      >
        <source src="/drivingvid.mp4" type="video/mp4" />
      </video>
      <div className="shipperLoginDimLayer" aria-hidden="true" />

      <section className="shipperLoginShell">
        <aside className="shipperLoginStory" aria-label="Espace expediteur">
          <button className="shipperLoginHome" type="button" onClick={() => navigate("/")}>
            <HomeIcon />
            <span>Accueil</span>
          </button>

          <div className="shipperLoginStoryBody">
            <div className="shipperLoginMark">
              <RouteIcon />
            </div>
            <p className="shipperLoginEyebrow">Espace expediteur</p>
            <h1>Reprenez le controle de vos expeditions.</h1>
            <p>
              Connectez-vous pour creer vos colis, suivre vos demandes et garder
              vos informations expediteur pretes pour chaque bon.
            </p>
          </div>

          <div className="shipperLoginFeatureGrid">
            <div>
              <strong>Suivi</strong>
              <span>Colis et statuts au meme endroit.</span>
            </div>
            <div>
              <strong>Adresse</strong>
              <span>Coordonnees reutilisees automatiquement.</span>
            </div>
          </div>
        </aside>

        <section className="shipperLoginCard" aria-labelledby="shipper-login-title">
          <div className="shipperLoginTop">
            <div>
              <p className="shipperLoginEyebrow">Connexion securisee</p>
              <h2 id="shipper-login-title">Connexion Expediteur</h2>
              <p>Acces a votre espace MZ Logistic.</p>
            </div>

            <ThemeToggleButton compact />
          </div>

          {infoMsg && <div className="shipperLoginAlert ok">{infoMsg}</div>}
          {err && <div className="shipperLoginAlert error">{err}</div>}

          <form className="shipperLoginForm" onSubmit={onSubmit}>
            <label className="shipperLoginField" htmlFor="shipper-login-email">
              <span>Email</span>
              <input
                id="shipper-login-email"
                className="shipperLoginInput"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="expediteur@mz.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </label>

            <label className="shipperLoginField" htmlFor="shipper-login-password">
              <span className="shipperLoginLabelRow">
                <span>Mot de passe</span>
                <Link to="/forgot-password">Mot de passe oublie ?</Link>
              </span>
              <PasswordInput
                id="shipper-login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                wrapperClassName="shipperLoginPassword"
              />
            </label>

            <button className="shipperLoginSubmit" type="submit" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <div className="shipperLoginFooter">
            <span>
              Pas encore de compte ? <Link to="/expediteur/register">Creer un compte</Link>
            </span>
          </div>
        </section>
      </section>
    </main>
  );
}
