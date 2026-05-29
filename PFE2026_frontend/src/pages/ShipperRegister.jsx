import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import { api } from "../api/client.js";
import PasswordInput from "./PasswordInput";
import "./ShipperRegister.css";

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

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path
        d="m5 12.5 4.1 4.1L19.5 6.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

export default function ShipperRegister() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+216 ");
  const [phone2, setPhone2] = useState("+216 ");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("feminin");
  const [ouvrirColisParDefaut, setOuvrirColisParDefaut] = useState("non");
  const [password, setPassword] = useState("");
  const [errorPhone1, setErrorPhone1] = useState(false);
  const [errorPhone2, setErrorPhone2] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();

    if (loading) return;

    if (errorPhone1) {
      setMsg("Numero principal invalide");
      return;
    }

    if (errorPhone2) {
      setMsg("Deuxieme numero invalide");
      return;
    }

    setMsg("");
    setLoading(true);

    try {
      await api.post("/auth/shipper/register", {
        full_name: name,
        email,
        phone,
        phone2: phone2.replace(/\s/g, "") === "+216" ? null : phone2,
        address,
        gender,
        ouvrir_colis_par_defaut: ouvrirColisParDefaut,
        password,
      });

      navigate("/expediteur/login", {
        state: { msg: "Il faut attendre la confirmation de l admin." },
      });
    } catch (err) {
      const data = err?.response?.data;

      if (Array.isArray(data?.detail)) {
        setMsg(data.detail[0].msg);
      } else if (typeof data?.detail === "string") {
        setMsg(data.detail);
      } else {
        setMsg("Erreur d inscription");
      }
    } finally {
      setLoading(false);
    }
  }

  function formatPhone(value, setPhoneError, required = true) {
    let chiffres = value.replace(/\D/g, "");

    if (!chiffres.startsWith("216")) {
      chiffres = `216${chiffres}`;
    }

    let localNumber = chiffres.slice(3, 11);

    if (localNumber.length > 2 && localNumber.length <= 5) {
      localNumber = `${localNumber.slice(0, 2)} ${localNumber.slice(2)}`;
    } else if (localNumber.length > 5) {
      localNumber = `${localNumber.slice(0, 2)} ${localNumber.slice(2, 5)} ${localNumber.slice(5, 8)}`;
    }

    const formatted = `+216 ${localNumber}`.trim();
    const digitCount = localNumber.replace(/\s/g, "").length;
    setPhoneError(required ? digitCount !== 8 : digitCount > 0 && digitCount !== 8);
    return formatted;
  }

  return (
    <main className="shipperRegisterPage" aria-label="Inscription expediteur">
      <video
        className="shipperRegisterVideoLayer"
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
      <div className="shipperRegisterDimLayer" aria-hidden="true" />

      <section className="shipperRegisterShell">
        <aside className="shipperRegisterIdentity" aria-label="MZ Logistic expediteur">
          <div className="shipperRegisterIdentityTop">
            <button
              className="shipperRegisterGhostButton"
              onClick={() => navigate("/")}
              type="button"
            >
              <HomeIcon />
              <span>Accueil</span>
            </button>
          </div>

          <div className="shipperRegisterBrandBlock">
            <p className="shipperRegisterEyebrow">MZ Logistic</p>
            <h1>Registre Expediteur</h1>
            <p>
              Ouvrez votre espace professionnel pour deposer vos colis, gerer vos
              coordonnees et garder vos bons de livraison coherents.
            </p>
          </div>

          <div className="shipperRegisterMetrics" aria-label="Points cles">
            <div>
              <span>01</span>
              <strong>Profil expediteur</strong>
              <small>Identite, adresse et contacts centralises.</small>
            </div>
            <div>
              <span>02</span>
              <strong>Validation admin</strong>
              <small>Acces controle avant activation du compte.</small>
            </div>
            <div>
              <span>03</span>
              <strong>Bons reutilisables</strong>
              <small>Adresse expediteur reprise sur les prochaines expeditions.</small>
            </div>
          </div>

          <div className="shipperRegisterAssurance">
            <CheckIcon />
            <span>Les informations saisies preparent votre espace de suivi expediteur.</span>
          </div>
        </aside>

        <section className="shipperRegisterPanel" aria-labelledby="shipper-register-title">
          <div className="shipperRegisterPanelHeader">
            <div>
              <p className="shipperRegisterEyebrow">Demande d acces</p>
              <h2 id="shipper-register-title">Creer votre compte</h2>
              <p>Renseignez les informations de reference de votre activite.</p>
            </div>

            <div className="shipperRegisterTopActions">
              <ThemeToggleButton compact />
            </div>
          </div>

          {msg && (
            <div className="shipperRegisterAlert" role="alert">
              {msg}
            </div>
          )}

          <form className="shipperRegisterForm" onSubmit={onSubmit}>
            <div className="shipperRegisterFormGrid">
              <label className="shipperRegisterField" htmlFor="shipper-name">
                <span>Nom complet</span>
                <input
                  id="shipper-name"
                  className="shipperRegisterInput"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nom et prenom"
                  autoComplete="name"
                  required
                  disabled={loading}
                />
              </label>

              <label className="shipperRegisterField" htmlFor="shipper-email">
                <span>Email professionnel</span>
                <input
                  id="shipper-email"
                  className="shipperRegisterInput"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="expediteur@mz.com"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </label>

              <label className="shipperRegisterField shipperRegisterFieldWide" htmlFor="shipper-address">
                <span>Adresse expediteur</span>
                <textarea
                  id="shipper-address"
                  className="shipperRegisterTextarea"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Adresse a afficher sur le bon de livraison"
                  autoComplete="street-address"
                  disabled={loading}
                  rows={3}
                />
              </label>

              <fieldset className="shipperRegisterChoiceGroup">
                <legend>Genre</legend>
                <div className="shipperRegisterRadioGrid">
                  <label className={`shipperRegisterRadioCard ${gender === "feminin" ? "isSelected" : ""}`}>
                    <input
                      type="radio"
                      name="gender"
                      value="feminin"
                      checked={gender === "feminin"}
                      onChange={(event) => setGender(event.target.value)}
                      disabled={loading}
                    />
                    <span>Feminin</span>
                  </label>

                  <label className={`shipperRegisterRadioCard ${gender === "masculin" ? "isSelected" : ""}`}>
                    <input
                      type="radio"
                      name="gender"
                      value="masculin"
                      checked={gender === "masculin"}
                      onChange={(event) => setGender(event.target.value)}
                      disabled={loading}
                    />
                    <span>Masculin</span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="shipperRegisterChoiceGroup">
                <legend>Ouvrir le colis avant paiement</legend>
                <div className="shipperRegisterRadioGrid">
                  <label className={`shipperRegisterRadioCard ${ouvrirColisParDefaut === "oui" ? "isSelected" : ""}`}>
                    <input
                      type="radio"
                      name="ouvrir_colis_par_defaut"
                      value="oui"
                      checked={ouvrirColisParDefaut === "oui"}
                      onChange={(event) => setOuvrirColisParDefaut(event.target.value)}
                      disabled={loading}
                    />
                    <span>Oui</span>
                  </label>

                  <label className={`shipperRegisterRadioCard ${ouvrirColisParDefaut === "non" ? "isSelected" : ""}`}>
                    <input
                      type="radio"
                      name="ouvrir_colis_par_defaut"
                      value="non"
                      checked={ouvrirColisParDefaut === "non"}
                      onChange={(event) => setOuvrirColisParDefaut(event.target.value)}
                      disabled={loading}
                    />
                    <span>Non</span>
                  </label>
                </div>
              </fieldset>

              <label className="shipperRegisterField" htmlFor="shipper-phone">
                <span>Telephone principal</span>
                <input
                  id="shipper-phone"
                  className={`shipperRegisterInput ${errorPhone1 ? "isInvalid" : ""}`}
                  value={phone}
                  onChange={(event) => setPhone(formatPhone(event.target.value, setErrorPhone1))}
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  disabled={loading}
                  aria-invalid={errorPhone1}
                />
              </label>

              <label className="shipperRegisterField" htmlFor="shipper-phone2">
                <span>Telephone 2 <small>optionnel</small></span>
                <input
                  id="shipper-phone2"
                  className={`shipperRegisterInput ${errorPhone2 ? "isInvalid" : ""}`}
                  value={phone2}
                  onChange={(event) => setPhone2(formatPhone(event.target.value, setErrorPhone2, false))}
                  inputMode="numeric"
                  autoComplete="tel"
                  disabled={loading}
                  aria-invalid={errorPhone2}
                />
              </label>

              <label className="shipperRegisterField shipperRegisterFieldWide" htmlFor="shipper-password">
                <span>Mot de passe</span>
                <PasswordInput
                  id="shipper-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  wrapperClassName="shipperRegisterPassword"
                />
              </label>
            </div>

            <div className="shipperRegisterActions">
              <button className="shipperRegisterSubmit" type="submit" disabled={loading}>
                {loading ? "Creation..." : "Creer un compte"}
              </button>

              <button
                className="shipperRegisterSecondary"
                type="button"
                onClick={() => navigate("/expediteur/login")}
                disabled={loading || errorPhone1 || errorPhone2}
              >
                J'ai deja un compte
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
