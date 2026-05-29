export const COLIS_SORT_OPTIONS = [
  { key: "recent", label: "Plus recents" },
  { key: "oldest", label: "Plus anciens" },
  { key: "tracking_az", label: "Numero A-Z" },
  { key: "tracking_za", label: "Numero Z-A" },
  { key: "name_az", label: "Client A-Z" },
  { key: "name_za", label: "Client Z-A" },
  { key: "price_desc", label: "Prix decroissant" },
  { key: "price_asc", label: "Prix croissant" },
  { key: "weight_desc", label: "Poids decroissant" },
  { key: "weight_asc", label: "Poids croissant" },
  { key: "status", label: "Statut" },
  { key: "depot", label: "Depot" },
];

const STATUS_ORDER = ["en_attente", "en_transit", "a_relivrer", "livre", "annule", "retour"];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function dateValue(colis) {
  const raw =
    colis?.updated_at ||
    colis?.admin_note_at ||
    colis?.created_at ||
    colis?.delivered_at ||
    colis?.picked_up_at;
  const value = new Date(raw || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function statusRank(value) {
  const index = STATUS_ORDER.indexOf(value);
  return index === -1 ? STATUS_ORDER.length : index;
}

function compareText(a, b) {
  return normalizeText(a).localeCompare(normalizeText(b), "fr");
}

export function sortColisList(list, sortKey = "recent") {
  return [...list].sort((a, b) => {
    switch (sortKey) {
      case "oldest":
        return dateValue(a) - dateValue(b);
      case "tracking_az":
        return compareText(a.numero_suivi, b.numero_suivi);
      case "tracking_za":
        return compareText(b.numero_suivi, a.numero_suivi);
      case "name_az":
        return compareText(a.nom_destinataire, b.nom_destinataire);
      case "name_za":
        return compareText(b.nom_destinataire, a.nom_destinataire);
      case "price_desc":
        return numericValue(b.prix) - numericValue(a.prix);
      case "price_asc":
        return numericValue(a.prix) - numericValue(b.prix);
      case "weight_desc":
        return numericValue(b.poids) - numericValue(a.poids);
      case "weight_asc":
        return numericValue(a.poids) - numericValue(b.poids);
      case "status":
        return statusRank(a.statut) - statusRank(b.statut) || compareText(a.numero_suivi, b.numero_suivi);
      case "depot":
        return compareText(a.depot_depart, b.depot_depart) || compareText(a.numero_suivi, b.numero_suivi);
      case "recent":
      default:
        return dateValue(b) - dateValue(a);
    }
  });
}
