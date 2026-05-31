import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggleButton from "../../components/ThemeToggleButton.jsx";
import colisService from "../../api/colisService";
import { api } from "../../api/client";
import "../../Dashboard.css";

const STATUS_META = {
  en_attente: {
    label: "En attente",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  en_transit: {
    label: "En transit",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  a_relivrer: {
    label: "A relivrer",
    color: "#f97316",
    bg: "#fff7ed",
    border: "#fed7aa",
  },
  livre: {
    label: "Livrés",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  retour: {
    label: "Retour",
    color: "#6d28d9",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
};

const STAT_CONFIG = [
  {
    key: "total",
    label: "Total colis",
    noClick: false,
    colorVal: "#2563eb",
    bgIco: "#eff6ff",
  },
  {
    key: "en_attente",
    label: "En attente",
    noClick: false,
    colorVal: "#b45309",
    bgIco: "#fffbeb",
  },
  {
    key: "en_transit",
    label: "En transit",
    noClick: false,
    colorVal: "#2563eb",
    bgIco: "#eff6ff",
  },
  {
    key: "a_relivrer",
    label: "A relivrer",
    noClick: false,
    colorVal: "#f97316",
    bgIco: "#fff7ed",
  },
  {
    key: "livre",
    label: "Livrés",
    noClick: false,
    colorVal: "#15803d",
    bgIco: "#f0fdf4",
  },
  {
    key: "retour",
    label: "Retour",
    noClick: false,
    colorVal: "#6d28d9",
    bgIco: "#f5f3ff",
  },
];

const COLIS_PER_PAGE = 9;

const DEPOT_OPTIONS = [
  {
    key: "kairouan",
    label: "Dépôt Kairouan",
    ville: "Kairouan",
    description: "Colis à déposer ou traiter depuis le dépôt de Kairouan.",
  },
  {
    key: "sousse",
    label: "Dépôt Sousse",
    ville: "Sousse",
    description: "Colis à déposer ou traiter depuis le dépôt de Sousse.",
  },
];

function normalizeStatus(value) {
  const status = String(value || "").toLowerCase();

  if (status.includes("attente")) return "en_attente";
  if (status.includes("transit")) return "en_transit";
  if (status.includes("relivr") || status.includes("report")) return "a_relivrer";
  if (status.includes("livr")) return "livre";
  if (status.includes("retour")) return "retour";

  return status;
}

function isRelivrerTomorrow(colis) {
  const statut = normalizeStatus(colis?.statut);
  const stage = String(colis?.tracking_stage || "").toLowerCase();

  if (colis?.delivered_at || statut === "livre") return false;
  if (colis?.returned_at || statut === "retour") return false;

  return (
    statut === "a_relivrer" ||
    (stage === "at_warehouse" && Boolean(colis?.last_delivery_issue_at))
  );
}

function notifRemaining(expiresAt) {
  if (!expiresAt) return "";

  const ms = new Date(expiresAt).getTime() - Date.now();

  if (isNaN(ms) || ms <= 0) return "Expirée";

  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);

  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatIcon({ k, color }) {
  if (k === "total") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect
          x="1"
          y="4"
          width="14"
          height="10"
          rx="1.5"
          stroke={color}
          strokeWidth="1.5"
        />
        <path
          d="M5 4V3a3 3 0 016 0v1"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (k === "en_attente") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.5" />
        <path
          d="M8 5v3.5l2 2"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (k === "en_transit") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect
          x="1"
          y="5"
          width="10"
          height="7"
          rx="1"
          stroke={color}
          strokeWidth="1.4"
        />
        <path
          d="M11 7h2.5l1.5 2v2h-4V7z"
          stroke={color}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <circle cx="4" cy="13" r="1.2" fill={color} />
        <circle cx="12" cy="13" r="1.2" fill={color} />
      </svg>
    );
  }

  if (k === "livre") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path
          d="M2.5 8.5l3.5 3.5 7-7"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8h8a3 3 0 010 6H7"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M6 5L3 8l3 3"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ColisCard({ colis }) {
  const key = normalizeStatus(colis.statut);

  const meta =
    STATUS_META[key] || {
      label: colis.statut,
      color: "#94a3b8",
      bg: "rgba(148,163,184,0.10)",
      border: "rgba(148,163,184,0.30)",
    };

  const date = colis.created_at
    ? new Date(colis.created_at).toLocaleDateString("fr-TN")
    : "-";

  const prix = Number(colis.prix);
  const prixText = Number.isFinite(prix) ? `${prix.toFixed(3)} DT` : "0.000 DT";

  return (
    <div className="dash-cc">
      <div className="dash-cc-top">
        <span className="dash-cc-num">#{colis.numero_suivi}</span>

        <span
          className="dash-pill"
          style={{
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          {meta.label}
        </span>
      </div>

      <div className="dash-cc-body">
        <div className="dash-cc-lbl">DESTINATAIRE</div>
        <div className="dash-cc-name">{colis.nom_destinataire}</div>
        <div className="dash-cc-sub">{colis.telephone_destinataire}</div>

        {colis.email_destinataire && (
          <div className="dash-cc-sub">{colis.email_destinataire}</div>
        )}

        <div className="dash-cc-lbl">ADRESSE</div>
        <div className="dash-cc-address">{colis.adresse_livraison}</div>

        <div className="dash-cc-foot">
          <div>
            <div className="dash-cc-ml">Poids</div>
            <div className="dash-cc-mv">{colis.poids} kg</div>
          </div>

          <div>
            <div className="dash-cc-ml">Prix</div>
            <div className="dash-cc-mv price">{prixText}</div>
          </div>

          <div>
            <div className="dash-cc-ml">Date</div>
            <div className="dash-cc-mv date">{date}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [colisList, setColisList] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatut, setActiveStatut] = useState(null);
  const [colisPage, setColisPage] = useState(1);
  const [user, setUser] = useState(null);

  const [selectedDepot, setSelectedDepot] = useState(
    localStorage.getItem("shipper_selected_depot") || ""
  );

  const [showProfil, setShowProfil] = useState(false);
  const [profil, setProfil] = useState(null);
  const [profilEdit, setProfilEdit] = useState({
    phone: "",
    email: "",
    address: "",
    ouvrir_colis_par_defaut: "non",
  });
  const [profilErrors, setProfilErrors] = useState({});
  const [profilLoading, setProfilLoading] = useState(false);
  const [profilSuccess, setProfilSuccess] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data || null);
    } catch (err) {
      if (err?.response?.status !== 401) console.error(err);
      setUser(null);
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true);

      const [colisData, notifData] = await Promise.all([
        colisService.getAll(),
        colisService.getNotifications(),
      ]);

      setColisList(Array.isArray(colisData) ? colisData : []);
      setNotifications(Array.isArray(notifData) ? notifData : []);
    } catch (err) {
      if (err?.response?.status !== 401) console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleDepotChange(value) {
    setSelectedDepot(value);
    localStorage.setItem("shipper_selected_depot", value);
  }

  function goToNewColis() {
    if (!selectedDepot) {
      alert("Veuillez choisir un dépôt avant de créer un colis.");
      return;
    }

    navigate("/expediteur/colis/nouveau", {
      state: { depot: selectedDepot },
    });
  }

  async function dismissNotif(id) {
    try {
      await colisService.markNotificationRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  async function dismissAll() {
    try {
      await colisService.markAllNotificationsRead();
      setNotifications([]);
    } catch (err) {
      console.error(err);
    }
  }

  async function openNotification(notif) {
    try {
      await colisService.markNotificationRead(notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    } catch (err) {
      console.error(err);
    }

    navigate("/expediteur/colis/tous");
  }

  async function openProfil() {
    setShowProfil(true);
    setProfilSuccess(false);
    setProfilErrors({});

    try {
      const { data } = await api.get("/auth/me");

      setProfil(data);

      setProfilEdit({
        phone: data.phone || "",
        email: data.email || "",
        address: data.address || "",
        ouvrir_colis_par_defaut: data.ouvrir_colis_par_defaut || "non",
      });
    } catch (err) {
      console.error(err);
      setProfil(null);
    }
  }

  function handleProfilChange(e) {
    const { name, value } = e.target;

    setProfilEdit((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (profilErrors[name]) {
      setProfilErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  }

  async function handleProfilSave() {
    if (!profilEdit.email.trim()) {
      setProfilErrors({ email: "Email requis" });
      return;
    }

    setProfilLoading(true);

    try {
      const { data } = await api.patch("/auth/me", {
        phone: profilEdit.phone,
        email: profilEdit.email,
        address: profilEdit.address,
        ouvrir_colis_par_defaut: profilEdit.ouvrir_colis_par_defaut,
      });

      setProfil(data);
      setUser(data);

      setProfilEdit({
        phone: data.phone || "",
        email: data.email || "",
        address: data.address || "",
        ouvrir_colis_par_defaut: data.ouvrir_colis_par_defaut || "non",
      });

      setProfilSuccess(true);
      setTimeout(() => setProfilSuccess(false), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur serveur");
    } finally {
      setProfilLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("shipper_access_token");
    navigate("/expediteur/login");
  }

  const counts = useMemo(
    () => ({
      total: colisList.length,
      en_attente: colisList.filter(
        (c) => normalizeStatus(c.statut) === "en_attente"
      ).length,
      en_transit: colisList.filter(
        (c) => normalizeStatus(c.statut) === "en_transit"
      ).length,
      a_relivrer: colisList.filter(isRelivrerTomorrow).length,
      livre: colisList.filter((c) => normalizeStatus(c.statut) === "livre")
        .length,
      retour: colisList.filter((c) => normalizeStatus(c.statut) === "retour")
        .length,
    }),
    [colisList]
  );

  const filteredColis = useMemo(() => {
    if (!activeStatut) return [];
    if (activeStatut === "total") return colisList;
    if (activeStatut === "a_relivrer") return colisList.filter(isRelivrerTomorrow);

    return colisList.filter(
      (c) => normalizeStatus(c.statut) === activeStatut
    );
  }, [activeStatut, colisList]);

  const colisPageCount = Math.max(1, Math.ceil(filteredColis.length / COLIS_PER_PAGE));
  const safeColisPage = Math.min(colisPage, colisPageCount);
  const colisPageStart = filteredColis.length === 0 ? 0 : (safeColisPage - 1) * COLIS_PER_PAGE + 1;
  const colisPageEnd = Math.min(safeColisPage * COLIS_PER_PAGE, filteredColis.length);
  const paginatedColis = filteredColis.slice(
    (safeColisPage - 1) * COLIS_PER_PAGE,
    safeColisPage * COLIS_PER_PAGE
  );

  const showingNotifs = activeStatut === null;

  const activeStatLabel =
    STAT_CONFIG.find((item) => item.key === activeStatut)?.label ||
    STATUS_META[activeStatut]?.label ||
    "";

  const userName = user?.name || "Expéditeur";
  const nom = user?.name || "Expéditeur";

  const civilite =
    user?.gender === "female" || user?.gender === "feminin"
      ? "Madame"
      : user?.gender === "male" || user?.gender === "masculin"
      ? "Monsieur"
      : "";

  const welcomeText = user ? `${civilite} ${nom}` : "Expéditeur";

  return (
    <div className="dash-root">
      <div className="dash-shell">
        <aside className="dash-sidebar">
          <div className="dash-sb-logo">
            <div className="dash-sb-dot" />
            <span className="dash-sb-name">MZ Logistic</span>
          </div>

          <nav className="dash-sb-nav">
            <div className="dash-sb-sec">Principal</div>

            <button className="dash-sb-link active" type="button">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <rect
                  x="9"
                  y="1"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <rect
                  x="1"
                  y="9"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <rect
                  x="9"
                  y="9"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
              Tableau de bord
            </button>

            <div className="dash-sb-sec">Colis</div>

            <button className="dash-sb-link" onClick={goToNewColis}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 3v10M3 8h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Nouveau colis
            </button>

            <button
              className="dash-sb-link"
              onClick={() => navigate("/expediteur/colis/tous")}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect
                  x="1.5"
                  y="3"
                  width="13"
                  height="10"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M5 7h6M5 10h4"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
              Liste colis
            </button>

            <button
              className="dash-sb-link"
              onClick={() => navigate("/expediteur/colis/historique")}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="8"
                  cy="8"
                  r="6.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M8 5v3.5l2 2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              Historique
            </button>
          </nav>

          <div className="dash-sb-bottom">
            <div className="dash-sb-user">
              <div className="dash-sb-avatar">
                {userName
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </div>

              <div>
                <div className="dash-sb-uname">{userName}</div>
                <div className="dash-sb-urole">Expéditeur</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="dash-main">
          <div className="dash-topbar">
            <div className="dash-topbar-right">
              <ThemeToggleButton />
              <button className="dash-btn" onClick={openProfil}>
                Mon profil
              </button>
              <button className="dash-btn dash-btn-danger" onClick={handleLogout}>
                Déconnexion
              </button>
            </div>
          </div>

          <div className="dash-page">
            <div className="dash-hero">
              <div className="dash-hero-title">
                Bienvenue, {welcomeText}
              </div>
              <div className="dash-hero-sub">
                Gérez vos colis et suivez les statuts en temps réel.
              </div>
            </div>

            <div className="dash-depot-card">
              <div className="dash-depot-head">
                <div>
                  <div className="dash-depot-title">Choix du dépôt</div>
                  <div className="dash-depot-sub">
                    Avant de créer un colis, choisissez le dépôt auquel ce colis
                    sera envoyé.
                  </div>
                </div>

                <button
                  type="button"
                  className="dash-depot-action"
                  onClick={goToNewColis}
                >
                  + Nouveau colis
                </button>
              </div>

              <div className="dash-depot-grid">
                {DEPOT_OPTIONS.map((depot) => {
                  const active = selectedDepot === depot.key;

                  return (
                    <button
                      key={depot.key}
                      type="button"
                      className={`dash-depot-option ${active ? "active" : ""}`}
                      onClick={() => handleDepotChange(depot.key)}
                    >
                      <div className="dash-depot-radio">{active ? "✓" : ""}</div>

                      <div>
                        <div className="dash-depot-name">{depot.label}</div>
                        <div className="dash-depot-desc">
                          {depot.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedDepot ? (
                <div className="dash-depot-selected">
                  Dépôt sélectionné :{" "}
                  <strong>
                    {DEPOT_OPTIONS.find((d) => d.key === selectedDepot)?.label}
                  </strong>
                </div>
              ) : (
                <div className="dash-depot-warning">
                  Aucun dépôt sélectionné. Le choix est obligatoire pour créer un
                  colis.
                </div>
              )}
            </div>

            <div className="dash-stats">
              {STAT_CONFIG.map((stat) => {
                const isActive = activeStatut === stat.key;
                const meta = STATUS_META[stat.key];

                return (
                  <div
                    key={stat.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveStatut((prev) => (prev === stat.key ? null : stat.key));
                      setColisPage(1);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveStatut((prev) => (prev === stat.key ? null : stat.key));
                        setColisPage(1);
                      }
                    }}
                    className={`dash-sc${isActive ? " active" : ""}`}
                    style={{
                      cursor: "pointer",
                      ...(isActive
                        ? {
                            borderColor: meta?.border || stat.colorVal,
                            background: meta?.bg || stat.bgIco,
                          }
                        : {}),
                    }}
                  >
                    <div
                      className="dash-sc-ico"
                      style={{ background: stat.bgIco }}
                    >
                      <StatIcon k={stat.key} color={stat.colorVal} />
                    </div>

                    <div
                      className="dash-sc-val"
                      style={{ color: stat.colorVal }}
                    >
                      {loading ? "—" : counts[stat.key]}
                    </div>

                    <div className="dash-sc-lbl">{stat.label}</div>

                  </div>
                );
              })}
            </div>

            <div className="dash-notif-panel">
              <div className="dash-notif-head">
                <div>
                  <div className="dash-notif-title">
                    {showingNotifs
                      ? "Notifications"
                      : `Colis — ${activeStatLabel}`}
                  </div>

                  <div className="dash-notif-sub">
                    {showingNotifs ? (
                      <>
                        <span>
                          {notifications.length > 0
                            ? `${notifications.length} message${
                                notifications.length > 1 ? "s" : ""
                              } de l'administration`
                            : "Aucune nouvelle notification"}
                        </span>

                        {notifications.length > 0 && (
                          <span className="dash-notif-tag">
                            expire après 48h
                          </span>
                        )}
                      </>
                    ) : (
                      <span>{filteredColis.length} colis trouvés</span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {showingNotifs && notifications.length > 0 && (
                    <button className="dash-dismiss-all" onClick={dismissAll}>
                      Tout marquer comme lu
                    </button>
                  )}

                  {!showingNotifs && (
                    <button
                      className="dash-clear-btn"
                      type="button"
                      aria-label="Fermer le filtre colis"
                      onClick={() => {
                        setActiveStatut(null);
                        setColisPage(1);
                      }}
                    >
                      ✕ Fermer
                    </button>
                  )}
                </div>
              </div>

              {showingNotifs ? (
                notifications.length === 0 ? (
                  <div className="dash-empty">
                    <div className="dash-empty-ico">🔔</div>
                    <div className="dash-empty-txt">Aucune notification</div>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const ok = notification.kind === "approved";

                    return (
                      <div
                        key={notification.id}
                        className={`dash-notif-item ${ok ? "ok" : "ko"}`}
                        onClick={() => openNotification(notification)}
                      >
                        <div className={`dash-notif-ico ${ok ? "ok" : "ko"}`}>
                          {ok ? "✓" : "✕"}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div
                            className={`dash-notif-name ${ok ? "ok" : "ko"}`}
                          >
                            {notification.title}
                          </div>

                          <div className="dash-notif-row">
                            Destinataire :{" "}
                            <b>{notification.nom_destinataire}</b>
                          </div>

                          <div className="dash-notif-track">
                            #{notification.numero_suivi}
                          </div>

                          <div className="dash-notif-note">
                            {notification.note ||
                              (ok
                                ? "Le colis a été confirmé par l'administration."
                                : "Le colis a été refusé par l'administration.")}
                          </div>
                        </div>

                        <div className="dash-notif-side">
                          <button
                            className="dash-notif-x"
                            type="button"
                            aria-label="Fermer cette notification"
                            onClick={(event) => {
                              event.stopPropagation();
                              dismissNotif(notification.id);
                            }}
                          >
                            ×
                          </button>

                          <span className="dash-notif-expire">
                            expire dans {notifRemaining(notification.expires_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )
              ) : filteredColis.length === 0 ? (
                <div className="dash-empty">
                  <div className="dash-empty-ico">📭</div>
                  <div className="dash-empty-txt">
                    Aucun colis avec ce statut
                  </div>
                </div>
              ) : (
                <>
                  <div className="dash-colis-grid">
                    {paginatedColis.map((colis) => (
                      <ColisCard key={colis.id} colis={colis} />
                    ))}
                  </div>

                  {colisPageCount > 1 && (
                    <div className="dash-pagination">
                      <div className="dash-pagination-info">
                        Affichage {colisPageStart}-{colisPageEnd} sur {filteredColis.length}
                      </div>
                      <div className="dash-pagination-actions" aria-label="Pagination colis">
                        <button
                          type="button"
                          className="dash-page-btn"
                          onClick={() => setColisPage(Math.max(1, safeColisPage - 1))}
                          disabled={safeColisPage === 1}
                        >
                          Precedent
                        </button>
                        {Array.from({ length: colisPageCount }, (_, index) => index + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            className={`dash-page-btn ${safeColisPage === page ? "active" : ""}`}
                            onClick={() => setColisPage(page)}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="dash-page-btn"
                          onClick={() => setColisPage(Math.min(colisPageCount, safeColisPage + 1))}
                          disabled={safeColisPage === colisPageCount}
                        >
                          Suivant
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showProfil && (
        <div className="dash-overlay" onClick={() => setShowProfil(false)}>
          <div className="dash-modal" onClick={(event) => event.stopPropagation()}>
            <div className="dash-modal-head">
              <div>
                <div className="dash-modal-title">Mon profil</div>
                <div className="dash-modal-sub">Compte expéditeur</div>
              </div>

              <button
                className="dash-modal-close"
                type="button"
                aria-label="Fermer le profil"
                onClick={() => setShowProfil(false)}
              >
                ×
              </button>
            </div>

            {profil === null ? (
              <p
                style={{
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: 12,
                }}
              >
                Chargement...
              </p>
            ) : (
              <>
                <div className="dash-info-block">
                  <div className="dash-info-row">
                    <span className="dash-ir-key">Nom</span>
                    <span className="dash-ir-val">{profil.name}</span>
                  </div>

                  <div className="dash-info-row">
                    <span className="dash-ir-key">Rôle</span>
                    <span
                      className="dash-ir-val"
                      style={{ color: "#2563eb" }}
                    >
                      {profil.role}
                    </span>
                  </div>

                  <div className="dash-info-row">
                    <span className="dash-ir-key">Statut</span>
                    <span
                      className="dash-ir-val"
                      style={{
                        color: profil.is_active ? "#15803d" : "#dc2626",
                      }}
                    >
                      {profil.is_active ? "Actif" : "Inactif"}
                    </span>
                  </div>

                  <div className="dash-info-row">
                    <span className="dash-ir-key">Ouvrir colis</span>
                    <span className="dash-ir-val">
                      {profil.ouvrir_colis_par_defaut === "oui" ? "Oui" : "Non"}
                    </span>
                  </div>
                </div>

                <div className="dash-field-lbl">Email *</div>
                <input
                  name="email"
                  type="email"
                  value={profilEdit.email}
                  onChange={handleProfilChange}
                  className="dash-field"
                  style={profilErrors.email ? { borderColor: "#fca5a5" } : {}}
                />

                {profilErrors.email && (
                  <div
                    style={{
                      color: "#dc2626",
                      fontSize: 11,
                      marginTop: -8,
                      marginBottom: 8,
                    }}
                  >
                    {profilErrors.email}
                  </div>
                )}

                <div className="dash-field-lbl">Téléphone</div>
                <input
                  name="phone"
                  value={profilEdit.phone}
                  onChange={handleProfilChange}
                  placeholder="+216 XX XXX XXX"
                  className="dash-field"
                />

                <div className="dash-field-lbl">Adresse expéditeur</div>
                <textarea
                  name="address"
                  value={profilEdit.address}
                  onChange={handleProfilChange}
                  placeholder="Adresse à afficher sur le bon de livraison"
                  className="dash-field"
                  rows={3}
                  style={{
                    minHeight: 90,
                    resize: "vertical",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                />

                <div className="dash-field-lbl">
                  Ouvrir le colis avant paiement
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="ouvrir_colis_par_defaut"
                      value="oui"
                      checked={profilEdit.ouvrir_colis_par_defaut === "oui"}
                      onChange={handleProfilChange}
                    />
                    Oui
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="ouvrir_colis_par_defaut"
                      value="non"
                      checked={profilEdit.ouvrir_colis_par_defaut !== "oui"}
                      onChange={handleProfilChange}
                    />
                    Non
                  </label>
                </div>

                {profilSuccess && (
                  <div className="dash-success-bar">
                    Profil mis à jour avec succès.
                  </div>
                )}

                <div className="dash-modal-btns">
                  <button
                    className="dash-mbtn dash-mbtn-cancel"
                    onClick={() => setShowProfil(false)}
                  >
                    Fermer
                  </button>

                  <button
                    className="dash-mbtn dash-mbtn-save"
                    onClick={handleProfilSave}
                    disabled={profilLoading}
                  >
                    {profilLoading ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
