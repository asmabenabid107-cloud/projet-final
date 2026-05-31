import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";import colisService from "../../api/colisService";
import ThemeToggleButton from "../../components/ThemeToggleButton.jsx";
import { isApprovedAdminNote } from "../../constants/adminDecision.js";

function calculerPrix(poids) {
  const p = Number(poids);
  if (!p || p <= 0) return "";
  if (p < 4) return "8.00";
  if (p < 5) return "15.00";
  return "20.00";
}

function formatPhone(digits) {
  const d = digits.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.slice(0, 2) + " " + d.slice(2);
  return d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5);
}
//supprime quelle que soi sauf numero
function digitsOnly(v) {
  return v.replace(/\D/g, "").slice(0, 8);
}

function validateEmail(email) {
  if (!email) return null;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return re.test(email) ? null : "Format email invalide (ex: nom@domaine.com)";
}

function validateNom(nom) {
  if (!nom.trim()) return "Nom requis";
  if (/\d/.test(nom)) return "Le nom ne doit pas contenir de chiffres";
  if (/[^a-zA-ZÀ-ÿ\s\-']/.test(nom)) return "Caractères spéciaux non autorisés";
  if (nom.trim().length < 3) return "Minimum 3 caractères";
  return null;
}

function validatePhone(phone) {
  const d = digitsOnly(phone);
  if (!d) return "Téléphone requis";
  if (d.length !== 8) return `${d.length}/8 chiffres saisis`;
  return null;
}

function validatePhone2(phone) {
  if (!phone || digitsOnly(phone).length === 0) return null;
  const d = digitsOnly(phone);
  if (d.length !== 8) return `${d.length}/8 chiffres saisis`;
  return null;
}

const STATUTS = {
  en_attente: {
    label: "En attente",
    bg: "rgba(245,158,11,0.15)",
    color: "var(--warning)",
    border: "rgba(245,158,11,0.35)",
  },
  en_transit: {
    label: "En transit",
    bg: "rgba(110,168,255,0.15)",
    color: "var(--accent-soft)",
    border: "rgba(110,168,255,0.35)",
  },
  a_relivrer: {
    label: "A relivrer",
    bg: "rgba(249,115,22,0.15)",
    color: "#f97316",
    border: "rgba(249,115,22,0.35)",
  },
  livre: {
    label: "Livre",
    bg: "rgba(44,203,118,0.15)",
    color: "var(--success)",
    border: "rgba(44,203,118,0.35)",
  },
  annule: {
    label: "Annule",
    bg: "rgba(255,95,95,0.15)",
    color: "var(--danger)",
    border: "rgba(255,95,95,0.35)",
  },
  livré: {
    label: "Livré",
    bg: "rgba(44,203,118,0.15)",
    color: "var(--success)",
    border: "rgba(44,203,118,0.35)",
  },
  annulé: {
    label: "Annulé",
    bg: "rgba(255,95,95,0.15)",
    color: "var(--danger)",
    border: "rgba(255,95,95,0.35)",
  },
  retour: {
    label: "Retour",
    bg: "rgba(167,139,250,0.15)",
    color: "var(--violet)",
    border: "rgba(167,139,250,0.35)",
  },
};


const TAILLES_VETEMENTS = ["XS", "S", "M", "L", "XL", "XXL"];
const TAILLES_CHAUSSURES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
const TAILLES_AUTRE = ["Unique", "Petit", "Moyen", "Grand", "Très grand"];

function getTaillesByType(type) {
  if (type === "vetement") return TAILLES_VETEMENTS;
  if (type === "chaussure") return TAILLES_CHAUSSURES;
  return TAILLES_AUTRE;
}
const TUNISIA_ZONES = {
  Tunis: ["Bab Bhar","Bab Souika","Carthage","El Menzah","El Omrane","La Goulette","La Marsa","Sidi Hassine","Cité El Khadra"],
  Ariana: ["Ariana Ville","Ettadhamen","Kalaat Landalous","La Soukra","Mnihla","Raoued","Sidi Thabet"],
  Ben_Arous: ["Ben Arous","El Mourouj","Ezzahra","Fouchana","Hammam Lif","Mégrine","Radès","Mohamedia"],
  Manouba: ["Borj El Amri","Douar Hicher","El Battan","Jedaida","Manouba","Mornaguia","Tebourba"],
  Nabeul: ["Nabeul","Hammamet","Dar Chaabane","Korba","Kélibia","Menzel Temime","Soliman","Beni Khalled"],
  Sousse: ["Sousse Médina","Sousse Riadh","Sahloul","Hammam Sousse","Akouda","Msaken","Kalaa Kebira","Khezama","Enfidha"],
  Monastir: ["Monastir","Ksar Hellal","Moknine","Jemmal","Sayada","Téboulba","Bembla","Bekalta"],
  Mahdia: ["Mahdia","Ksour Essef","El Jem","Chebba","Melloulèche","Sidi Alouane"],
  Sfax: ["Sfax Ville","Sakiet Ezzit","Sakiet Eddaier","El Ain","Thyna","Mahres","Agareb","Jebeniana","Skhira"],
  Kairouan: ["Kairouan Nord","Kairouan Sud","Chebika","Sbikha","Haffouz","Oueslatia","Bouhajla"],
  Bizerte: ["Bizerte Nord","Bizerte Sud","Menzel Bourguiba","Mateur","Ras Jebel","Sejnane","Ghar El Melh"],
  Béja: ["Béja Nord","Béja Sud","Amdoun","Testour","Téboursouk","Nefza"],
  Jendouba: ["Jendouba","Aïn Draham","Tabarka","Fernana","Ghardimaou"],
  Le_Kef: ["Le Kef","Tajerouine","Sakiet Sidi Youssef","Dahmani"],
  Siliana: ["Siliana","Bou Arada","Gaafour","Makthar","El Krib"],
  Zaghouan: ["Zaghouan","Zriba","Bir Mcherga","El Fahs"],
  Kasserine: ["Kasserine","Sbeitla","Feriana","Foussana","Thala"],
  Sidi_Bouzid: ["Sidi Bouzid","Meknassy","Regueb","Jilma","Souk Jedid"],
  Gabès: ["Gabès Ville","Gabès Sud","Mareth","Matmata","Ghannouch"],
  Médenine: ["Médenine","Ben Guerdane","Zarzis","Djerba Midoun","Djerba Houmt Souk"],
  Tataouine: ["Tataouine","Bir Lahmar","Remada","Ghomrassen"],
  Gafsa: ["Gafsa","Metlaoui","Redeyef","Mdhilla"],
  Tozeur: ["Tozeur","Nefta","Degache"],
  Kebili: ["Kébili","Douz","Souk Lahad"]
};

const DEPOT_OPTIONS = [
  {
    key: "kairouan",
    label: "Dépôt Kairouan",
  },
  {
    key: "sousse",
    label: "Dépôt Sousse",
  },
];

function getDepotLabel(value) {
  return DEPOT_OPTIONS.find((d) => d.key === value)?.label || "";
}

const INITIAL_FORM = {
  depot_depart: "",
  adresse_livraison: "",
  gouvernorat: "",
  delegation: "",
  rue: "",
  nom_destinataire: "",
  telephone1: "",
  telephone2: "",
  email_destinataire: "",
  poids: "",
  statut: "en_attente",
  prix: "",
  longueur: "",
  largeur: "",
  hauteur: "",
  priorite_colis: "normal",
  sensibilite_colis: "",
};

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-panel-soft)",
  color: "var(--text-primary)",
  padding: "12px 12px",
  outline: "none",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 12,
  opacity: 0.75,
  marginBottom: 6,
  display: "block",
};

const sectionStyle = {
  borderRadius: 14,
  border: "1px solid var(--border-soft)",
  background: "var(--surface-panel-soft)",
  padding: 20,
};

function errStyle(hasErr) {
  return {
    ...inputStyle,
    borderColor: hasErr ? "rgba(255,95,95,.55)" : "rgba(255,255,255,.14)",
  };
}

function ErrMsg({ msg }) {
  return msg ? (
    <div style={{ fontSize: 12, marginTop: 4, color: "var(--danger)" }}>
      ⚠ {msg}
    </div>
  ) : null;
}

let pid = 0;

function newProduct() {
  return {
    _id: ++pid,
    nom: "",
    quantite: 1,
    prix: "",
    type: "autre",
    taille: "Unique",
  };
}

function parseAdresse(adresse) {
  const parts = (adresse || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const rue = parts[0] || "";
  const delegation = parts[1] || "";
  const gouvernoratRaw = parts[2] || "";

  const gouvernoratKey =
    Object.keys(TUNISIA_ZONES).find(
      (g) =>
        g === gouvernoratRaw ||
        g.replace("_", " ") === gouvernoratRaw
    ) || "";

  return { rue, delegation, gouvernorat: gouvernoratKey };
}


export default function ColisForm() {
  const navigate = useNavigate();
const location = useLocation();
const { id } = useParams();
const isEdit = Boolean(id);

const depotFromDashboard =
  location.state?.depot || localStorage.getItem("shipper_selected_depot") || "";

  const [form, setForm] = useState(INITIAL_FORM);
  const [products, setProducts] = useState([newProduct()]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);


//pour charge depot
  useEffect(() => {
  if (isEdit) return;

  if (!depotFromDashboard) {
    alert("Veuillez choisir un dépôt depuis le tableau de bord avant de créer un colis.");
    navigate("/expediteur/dashboard");
    return;
  }

  setForm((prev) => ({
    ...prev,
    depot_depart: depotFromDashboard,
  }));
}, [depotFromDashboard, isEdit, navigate]);

  const totalProduits = products.reduce(
    (s, p) => s + (Number(p.quantite) || 0) * (Number(p.prix) || 0),
    0
  );

  useEffect(() => {
    const auto = calculerPrix(form.poids);
    setForm((prev) => ({ ...prev, prix: auto }));
  }, [form.poids]);

  const prixLivraison = Number(form.prix) || 0;
  const prixTotalFinal = prixLivraison + totalProduits;

  useEffect(() => {
    if (!isEdit) return;

    colisService
      .getOne(id)
      .then((data) => {
        if (isApprovedAdminNote(data.admin_note)) {
          alert("Ce colis a deja ete accepte par l'admin. Il ne peut plus etre modifie.");
          navigate("/expediteur/colis/tous");
          return;
        }

        const parts = (data.telephone_destinataire || "").split(" / ");

        const adresseParts = parseAdresse(data.adresse_livraison);

const gov = data.gouvernorat || adresseParts.gouvernorat || "";
const del = data.delegation || adresseParts.delegation || "";
const rue = data.rue || adresseParts.rue || "";

setForm({
  depot_depart: data.depot_depart || "",
  adresse_livraison: data.adresse_livraison || "",
  gouvernorat: gov,
  delegation: del,
  rue: rue,

  nom_destinataire: data.nom_destinataire || "",
  telephone1: formatPhone(digitsOnly(parts[0] || "")),
  telephone2: formatPhone(digitsOnly(parts[1] || "")),
  email_destinataire: data.email_destinataire || "",
  poids: data.poids ?? "",
  statut: data.statut || "en_attente",
  prix: data.prix ?? calculerPrix(data.poids),
  longueur: data.longueur ?? "",
  largeur: data.largeur ?? "",
  hauteur: data.hauteur ?? "",
  priorite_colis: data.priorite_colis || "normal",
  sensibilite_colis: data.sensibilite_colis || "",
});
        if (data.produits?.length) {
          setProducts(
            data.produits.map((p) => {
              const type = p.type || "autre";
              const tailles = getTaillesByType(type);
              return {
                ...p,
                _id: ++pid,
                type,
                taille: p.taille || tailles[0],
              };
            })
          );
        }
      })
      .catch(() => {
        alert("Colis introuvable");
        navigate("/expediteur/dashboard");
      })
      .finally(() => setFetchLoading(false));
  }, [id, isEdit, navigate]);

  const liveValidate = (name, value) => {
    switch (name) {
      case "nom_destinataire":
        return validateNom(value);
      case "telephone1":
        return validatePhone(value);
      case "telephone2":
        return validatePhone2(value);
      case "email_destinataire":
        return validateEmail(value);
      case "adresse_livraison":
        return value.trim() ? null : "Adresse requise";
      case "poids":
        return !value || Number(value) <= 0 ? "Poids invalide" : null;
      case "longueur":
      case "largeur":
      case "hauteur":
        return value !== "" && Number(value) <= 0 ? "Valeur invalide" : null;
      default:
        return null;
    }
  };

  const handleChange = (e) => {
    let { name, value } = e.target;

    if (name === "telephone1" || name === "telephone2") {
      value = formatPhone(digitsOnly(value));
    }

    if (name === "gouvernorat") {
  setForm((prev) => ({
    ...prev,
    gouvernorat: value,
    delegation: "",
    adresse_livraison: "",
  }));
  setErrors((prev) => ({
    ...prev,
    gouvernorat: null,
    delegation: null,
    adresse_livraison: null,
  }));
  return;
}

    setForm((prev) => ({ ...prev, [name]: value }));

    const err = liveValidate(name, value);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleProduct = (pidValue, field, value) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p._id !== pidValue) return p;

        if (field === "type") {
          const tailles = getTaillesByType(value);
          return {
            ...p,
            type: value,
            taille: tailles[0],
          };
        }

        return { ...p, [field]: value };
      })
    );

    if (errors[`p_${pidValue}_${field}`]) {
      setErrors((prev) => ({ ...prev, [`p_${pidValue}_${field}`]: null }));
    }
  };

  const addProduct = () => setProducts((prev) => [...prev, newProduct()]);

  const removeProduct = (pidValue) => {
    if (products.length > 1) {
      setProducts((prev) => prev.filter((p) => p._id !== pidValue));
    }
  };

  const buildAdresseLivraison = () => {
  const built = [form.rue, form.delegation, form.gouvernorat, "Tunisie"]
    .filter(Boolean)
    .join(", ");

  return built || form.adresse_livraison;
};



  const validate = () => {
    const e = {};

    const nomErr = validateNom(form.nom_destinataire);
    if (nomErr) e.nom_destinataire = nomErr;

if (!form.gouvernorat && !form.adresse_livraison) {
  e.gouvernorat = "Gouvernorat requis";
}
if (!isEdit && !form.depot_depart) {
  e.depot_depart = "Dépôt requis";
}
if (!form.delegation && !form.adresse_livraison) {
  e.delegation = "Délégation requise";
}

if (!form.rue.trim() && !form.adresse_livraison) {
  e.rue = "Rue / numéro requis";
}
    const tel1Err = validatePhone(form.telephone1);
    if (tel1Err) e.telephone1 = tel1Err;

    const tel2Err = validatePhone2(form.telephone2);
    if (tel2Err) e.telephone2 = tel2Err;

    const emailErr = validateEmail(form.email_destinataire);
    if (emailErr) e.email_destinataire = emailErr;

    if (!form.poids || Number(form.poids) <= 0) e.poids = "Poids invalide";

    ["longueur", "largeur", "hauteur"].forEach((field) => {
      if (form[field] !== "" && Number(form[field]) <= 0) {
        e[field] = "Valeur invalide";
      }
    });

    products.forEach((p) => {
      if (!p.nom.trim()) e[`p_${p._id}_nom`] = "Nom requis";
      if (!p.quantite || Number(p.quantite) < 1) e[`p_${p._id}_quantite`] = "≥ 1";
      if (p.prix === "" || Number(p.prix) < 0) e[`p_${p._id}_prix`] = "Prix invalide";
    });

    return e;
  };

 const handleSubmit = async (e) => {
  e.preventDefault();

  const errs = validate();
  if (Object.keys(errs).length) {
    setErrors(errs);
    return;
  }

  setLoading(true);

  try {
    const payload = {
      gouvernorat: form.gouvernorat,
      delegation: form.delegation,
      rue: form.rue,
      adresse_livraison: buildAdresseLivraison(),
      nom_destinataire: form.nom_destinataire,
      telephone_destinataire:
        digitsOnly(form.telephone1) +
        (digitsOnly(form.telephone2)
          ? ` / ${digitsOnly(form.telephone2)}`
          : ""),
      email_destinataire: form.email_destinataire || null,
      poids: Number(form.poids),
      longueur: form.longueur === "" ? null : Number(form.longueur),
      largeur: form.largeur === "" ? null : Number(form.largeur),
      hauteur: form.hauteur === "" ? null : Number(form.hauteur),
      statut: form.statut,
      prix: Number(prixTotalFinal),
      prix_free: null,
      depot_depart: form.depot_depart,
      destination_label: form.delegation || form.gouvernorat || null,
      priorite_colis: form.priorite_colis,
      sensibilite_colis: form.sensibilite_colis || null,
      produits: products.map((product) => ({
        nom: product.nom,
        quantite: Number(product.quantite),
        prix: Number(product.prix),
        type: product.type,
        taille: product.taille,
      })),
    };

    if (isEdit) {
      await colisService.update(id, payload);
      navigate("/expediteur/colis/tous");
    } else {
      await colisService.create(payload);
      navigate("/expediteur/dashboard");
    }
  } catch (err) {
    alert(err?.response?.data?.detail || `Erreur (${err?.response?.status || "?"})`);
  } finally {
    setLoading(false);
  }
};

  if (fetchLoading) {
    return (
      <p style={{ textAlign: "center", marginTop: 60, color: "var(--text-primary)" }}>
        Chargement...
      </p>
    );
  }

  const si = STATUTS[form.statut] || STATUTS.en_attente;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--page-bg)",
        color: "var(--text-primary)",
        fontFamily: "system-ui, Arial, sans-serif",
        paddingBottom: 40,
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--header-bg)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(10px)",
          padding: "14px 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#7aa2ff",
              boxShadow: "0 0 0 6px rgba(122,162,255,0.15)",
            }}
          />
          <span style={{ fontWeight: 900 }}>🚚 MZ Logistic</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ThemeToggleButton compact />
          <button
            type="button"
            onClick={() => navigate("/expediteur/dashboard")}
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-soft)",
              color: "var(--text-primary)",
              borderRadius: 12,
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Retour
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 900 }}>
            {isEdit ? "✏️ Modifier le colis" : "📦 Nouveau colis"}
          </h1>
          <p style={{ margin: "4px 0 0", opacity: 0.6, fontSize: "0.9rem" }}>
            {isEdit ? "Modifiez les informations" : "Remplissez les informations du colis"}
          </p>
        </div>

        {!isEdit && (
  <div
    style={{
      ...sectionStyle,
      marginBottom: 16,
      borderColor: errors.depot_depart ? "rgba(255,95,95,.55)" : "var(--border-soft)",
    }}
  >
    <div
      style={{
        fontWeight: 800,
        marginBottom: 10,
      }}
    >
      🏢 Dépôt choisi
    </div>

    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--accent-bg-soft)",
        border: "1px solid rgba(110,168,255,.25)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontWeight: 900, color: "var(--accent-soft)" }}>
          {getDepotLabel(form.depot_depart) || "Aucun dépôt sélectionné"}
        </div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 3 }}>
          Ce colis sera envoyé vers ce dépôt.
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate("/expediteur/dashboard")}
        style={{
          border: "1px solid var(--border-strong)",
          background: "var(--surface-card)",
          color: "var(--text-primary)",
          borderRadius: 10,
          padding: "9px 12px",
          cursor: "pointer",
          fontWeight: 800,
        }}
      >
        Changer dépôt
      </button>
    </div>

    <ErrMsg msg={errors.depot_depart} />
  </div>
)}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={sectionStyle}>
            <div style={{ fontWeight: 800, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              👤 Coordonnées du destinataire
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Nom complet *</label>
                <input
                  name="nom_destinataire"
                  value={form.nom_destinataire}
                  onChange={handleChange}
                  placeholder="Ex: Mohamed Ali"
                  style={errStyle(errors.nom_destinataire)}
                />
                <ErrMsg msg={errors.nom_destinataire} />
              </div>

              <div>
                <label style={labelStyle}>
                  Email <span style={{ opacity: 0.5 }}>(optionnel)</span>
                </label>
                <input
                  name="email_destinataire"
                  value={form.email_destinataire}
                  onChange={handleChange}
                  type="text"
                  placeholder="nom@domaine.com"
                  style={errStyle(errors.email_destinataire)}
                />
                <ErrMsg msg={errors.email_destinataire} />
              </div>

              <div>
                <label style={labelStyle}>
                  Téléphone 1 * <span style={{ opacity: 0.4, fontWeight: 400 }}>format: XX XXX XXX</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    name="telephone1"
                    value={form.telephone1}
                    onChange={handleChange}
                    placeholder="XX XXX XXX"
                    inputMode="numeric"
                    style={{ ...errStyle(errors.telephone1), paddingRight: 50, letterSpacing: "0.08em" }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "0.72rem",
                      opacity: 0.5,
                      fontFamily: "monospace",
                    }}
                  >
                    {digitsOnly(form.telephone1).length}/8
                  </span>
                </div>
                <ErrMsg msg={errors.telephone1} />
              </div>

              <div>
                <label style={labelStyle}>
                  Téléphone 2 <span style={{ opacity: 0.4, fontWeight: 400 }}>optionnel · XX XXX XXX</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    name="telephone2"
                    value={form.telephone2}
                    onChange={handleChange}
                    placeholder="XX XXX XXX"
                    inputMode="numeric"
                    style={{ ...errStyle(errors.telephone2), paddingRight: 50, letterSpacing: "0.08em" }}
                  />
                  {form.telephone2 && (
                    <span
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "0.72rem",
                        opacity: 0.5,
                        fontFamily: "monospace",
                      }}
                    >
                      {digitsOnly(form.telephone2).length}/8
                    </span>
                  )}
                </div>
                <ErrMsg msg={errors.telephone2} />
              </div>
            </div>
          </div>

 <div style={sectionStyle}>
  <div
    style={{
      fontWeight: 800,
      marginBottom: 16,
      paddingBottom: 10,
      borderBottom: "1px solid rgba(255,255,255,.07)",
    }}
  >
    📍 Adresse de livraison
  </div>

  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
    <div>
      <label style={labelStyle}>Gouvernorat *</label>
      <select
        className="shipperAddressSelect"
        name="gouvernorat"
        value={form.gouvernorat}
        onChange={handleChange}
        style={errStyle(errors.gouvernorat)}
      >
        <option value="">Sélectionner une gouvernorat</option>
        {Object.keys(TUNISIA_ZONES).map((w) => (
          <option key={w} value={w}>
            {w.replace("_", " ")}
          </option>
        ))}
      </select>
      <ErrMsg msg={errors.gouvernorat} />
    </div>

    <div>
  <label style={labelStyle}>Délégation *</label>
  <select
    className="shipperAddressSelect"
    name="delegation"
    value={form.delegation}
    onChange={handleChange}
    disabled={!form.gouvernorat}
    style={{
      ...errStyle(errors.delegation),
      opacity: form.gouvernorat ? 1 : 0.6,
      cursor: form.gouvernorat ? "pointer" : "not-allowed",
    }}
  >
    <option value="">
      {form.gouvernorat
        ? "Sélectionner une délégation"
        : "Choisir d’abord une gouvernorat"}
    </option>

    {(TUNISIA_ZONES[form.gouvernorat] || []).map((d) => (
      <option key={d} value={d}>
        {d}
      </option>
    ))}
  </select>
  <ErrMsg msg={errors.delegation} />
</div>

  <div style={{ marginTop: 14 }}>
    <label style={labelStyle}>Rue et numéro de maison *</label>
    <textarea
      name="rue"
      value={form.rue}
      onChange={handleChange}
      placeholder="Ex: Rue des Roses, maison n°12"
      rows={3}
      style={{ ...errStyle(errors.rue), resize: "vertical" }}
    />
    <ErrMsg msg={errors.rue} />
  </div>

  <div
    style={{
      marginTop: 12,
      padding: "10px 12px",
      borderRadius: 10,
      background: "var(--surface-inset-strong)",
      fontSize: "0.82rem",
      opacity: 0.85,
    }}
  >
    <strong>Adresse finale :</strong>{" "}
    {buildAdresseLivraison() || "—"}
  </div>
</div>
</div>

          <div style={sectionStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: "1px solid rgba(255,255,255,.07)",
              }}
            >
              <div style={{ fontWeight: 800 }}>🛍️ Produits</div>
              <button
                type="button"
                onClick={addProduct}
                style={{
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                  color: "var(--accent-soft)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                }}
              >
                + Ajouter produit
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 90px 75px 95px 105px 36px",
                gap: 8,
                padding: "0 4px 6px",
                borderBottom: "1px solid rgba(255,255,255,.06)",
                marginBottom: 8,
              }}
            >
              {["Nom produit", "Type", "Qté", "Prix/u", "Taille", ""].map((h, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: "0.7rem",
                    opacity: 0.45,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {products.map((p) => {
                const tailles = getTaillesByType(p.type);

                return (
                  <div
                    key={p._id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr 90px 75px 95px 105px 36px",
                      gap: 8,
                      alignItems: "start",
                      background: "rgba(0,0,0,.15)",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <div>
                      <input
                        value={p.nom}
                        onChange={(e) => handleProduct(p._id, "nom", e.target.value)}
                        placeholder="Ex: T-shirt, chaussures..."
                        style={{
                          ...inputStyle,
                          padding: "9px 10px",
                          borderColor: errors[`p_${p._id}_nom`]
                            ? "rgba(255,95,95,.55)"
                            : "rgba(255,255,255,.14)",
                        }}
                      />
                      {errors[`p_${p._id}_nom`] && (
                        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }}>
                          ⚠ {errors[`p_${p._id}_nom`]}
                        </div>
                      )}
                    </div>

                    <select
                      value={p.type}
                      onChange={(e) => handleProduct(p._id, "type", e.target.value)}
                      style={{ ...inputStyle, padding: "9px 6px", cursor: "pointer" }}
                    >
                      <option value="autre" style={{ background: "var(--auth-panel-bg)" }}>
                        Autre
                      </option>
                      <option value="vetement" style={{ background: "var(--auth-panel-bg)" }}>
                        Vêtement
                      </option>
                      <option value="chaussure" style={{ background: "var(--auth-panel-bg)" }}>
                        Chaussure
                      </option>
                    </select>

                    <div>
                      <input
                        type="number"
                        min="1"
                        value={p.quantite}
                        onChange={(e) => handleProduct(p._id, "quantite", e.target.value)}
                        style={{
                          ...inputStyle,
                          padding: "9px 8px",
                          textAlign: "center",
                          borderColor: errors[`p_${p._id}_quantite`]
                            ? "rgba(255,95,95,.55)"
                            : "rgba(255,255,255,.14)",
                        }}
                      />
                      {errors[`p_${p._id}_quantite`] && (
                        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }}>
                          ⚠ {errors[`p_${p._id}_quantite`]}
                        </div>
                      )}
                    </div>

                    <div>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={p.prix}
                        placeholder="0"
                        onChange={(e) => handleProduct(p._id, "prix", e.target.value)}
                        style={{
                          ...inputStyle,
                          padding: "9px 8px",
                          borderColor: errors[`p_${p._id}_prix`]
                            ? "rgba(255,95,95,.55)"
                            : "rgba(255,255,255,.14)",
                        }}
                      />
                      {errors[`p_${p._id}_prix`] && (
                        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }}>
                          ⚠ {errors[`p_${p._id}_prix`]}
                        </div>
                      )}
                    </div>

                    <select
                      value={p.taille}
                      onChange={(e) => handleProduct(p._id, "taille", e.target.value)}
                      style={{ ...inputStyle, padding: "9px 6px", cursor: "pointer" }}
                    >
                      {tailles.map((t) => (
                        <option key={t} value={t} style={{ background: "var(--auth-panel-bg)" }}>
                          {t}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeProduct(p._id)}
                      disabled={products.length === 1}
                      style={{
                        background: "rgba(255,95,95,.12)",
                        border: "1px solid rgba(255,95,95,.25)",
                        color: "var(--danger)",
                        borderRadius: 8,
                        padding: "9px 0",
                        cursor: products.length === 1 ? "not-allowed" : "pointer",
                        opacity: products.length === 1 ? 0.35 : 1,
                        fontWeight: 700,
                        width: "100%",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
                padding: "10px 14px",
                background: "var(--surface-inset-strong)",
                borderRadius: 10,
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ opacity: 0.6, fontSize: "0.88rem" }}>Sous-total produits :</span>
              <strong style={{ color: "var(--accent-soft)", fontSize: "1.05rem" }}>
                {totalProduits.toFixed(2)} DT
              </strong>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ fontWeight: 800, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              ⚠️ Priorité et sensibilité du colis
            </div>

<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>              <div>
                <label style={labelStyle}>Priorité du colis</label>
                <select
                  name="priorite_colis"
                  value={form.priorite_colis}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="normal">Normal — livraison standard</option>
                  <option value="urgent">Urgent — maximum 48h</option>
                  <option value="sensible">Sensible — fragile / attention spéciale</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Sensibilité du colis <span style={{ opacity: 0.5 }}>(optionnel)</span>
                </label>
                <textarea
                  name="sensibilite_colis"
                  value={form.sensibilite_colis}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Ex: colis en verre, fragile, nourriture, à garder droit, ne pas écraser..."
                  style={{ ...inputStyle, resize: "vertical", minHeight: 82 }}
                />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ fontWeight: 800, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
              📦 Détails du colis
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Poids (kg) *</label>
                <input
                  name="poids"
                  value={form.poids}
                  onChange={handleChange}
                  type="number"
                  placeholder="0.5"
                  step="0.1"
                  min="0.1"
                  style={errStyle(errors.poids)}
                />
                <ErrMsg msg={errors.poids} />
              </div>

              <div>
                <label style={labelStyle}>
                  Frais livraison (DT)
                  <span style={{ marginLeft: 6, fontSize: "0.65rem", opacity: 0.5, fontWeight: 400 }}>
                    calculé auto
                  </span>
                </label>
                <div
                  style={{
                    ...inputStyle,
                    background: "var(--accent-bg-soft)",
                    border: "1px solid rgba(110,168,255,.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: "var(--accent-soft)", fontWeight: 800 }}>
                    {form.prix || "—"}
                  </span>
                  <span style={{ fontSize: "0.65rem", opacity: 0.5 }}>DT</span>
                </div>
                {form.poids && (
                  <div style={{ fontSize: "0.7rem", opacity: 0.5, marginTop: 4 }}>
                    {Number(form.poids) < 4
                      ? "< 4 kg → 8 DT"
                      : Number(form.poids) < 5
                      ? "4 - 4.9 kg → 15 DT"
                      : "≥ 5 kg → 20 DT"}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Statut</label>
                <div
                  style={{
                    ...inputStyle,
                    background: si.bg,
                    border: `1px solid ${si.border}`,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: si.color, fontWeight: 800, fontSize: "0.85rem" }}>
                    {si.label}
                  </span>
                </div>
                <span style={{ fontSize: "0.7rem", opacity: 0.45, marginTop: 4, display: "block" }}>
                  🔒 Géré par le livreur
                </span>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid rgba(255,255,255,.07)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 10 }}>
                📐 Dimensions du colis <span style={{ opacity: 0.5, fontWeight: 500 }}>(optionnel)</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Longueur (cm)</label>
                  <input
                    name="longueur"
                    value={form.longueur}
                    onChange={handleChange}
                    type="number"
                    placeholder="Ex: 40"
                    step="0.1"
                    min="0"
                    style={errStyle(errors.longueur)}
                  />
                  <ErrMsg msg={errors.longueur} />
                </div>

                <div>
                  <label style={labelStyle}>Largeur (cm)</label>
                  <input
                    name="largeur"
                    value={form.largeur}
                    onChange={handleChange}
                    type="number"
                    placeholder="Ex: 30"
                    step="0.1"
                    min="0"
                    style={errStyle(errors.largeur)}
                  />
                  <ErrMsg msg={errors.largeur} />
                </div>

                <div>
                  <label style={labelStyle}>Hauteur (cm)</label>
                  <input
                    name="hauteur"
                    value={form.hauteur}
                    onChange={handleChange}
                    type="number"
                    placeholder="Ex: 25"
                    step="0.1"
                    min="0"
                    style={errStyle(errors.hauteur)}
                  />
                  <ErrMsg msg={errors.hauteur} />
                </div>
              </div>

              <div style={{ fontSize: "0.72rem", opacity: 0.55, marginTop: 8 }}>
                Ces valeurs seront enregistrées dans la base et pourront être utilisées par l’IA pour organiser les tournées.
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                padding: "14px 18px",
                borderRadius: 12,
                background: "var(--surface-deep)",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", opacity: 0.5, marginBottom: 4 }}>Produits</div>
                <div style={{ fontWeight: 800, color: "var(--accent-soft)" }}>
                  {totalProduits.toFixed(2)} DT
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", opacity: 0.5, marginBottom: 4 }}>+ Livraison</div>
                <div style={{ fontWeight: 800, color: "var(--warning)" }}>
                  {prixLivraison.toFixed(2)} DT
                </div>
              </div>
              <div style={{ textAlign: "center", borderLeft: "1px solid rgba(255,255,255,.08)", paddingLeft: 12 }}>
                <div style={{ fontSize: "0.7rem", opacity: 0.5, marginBottom: 4 }}>= Total</div>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--success)" }}>
                  {prixTotalFinal.toFixed(2)} DT
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => navigate("/expediteur/dashboard")}
              style={{
                padding: "12px 24px",
                border: "1px solid var(--border-strong)",
                borderRadius: 12,
                background: "var(--surface-card)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px 28px",
                border: "1px solid var(--accent-border)",
                borderRadius: 12,
                background: "var(--accent-bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontWeight: 800,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? "Enregistrement..."
                : isEdit
                ? "✓ Enregistrer les modifications"
                : "✓ Créer le colis"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
