import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";

import { api } from "../../api/client";
import colisService from "../../api/colisService";
import ThemeToggleButton from "../../components/ThemeToggleButton.jsx";
import { isApprovedAdminNote } from "../../constants/adminDecision.js";

const STATUS_LABELS = {
  en_attente: { label: "En attente", color: "var(--warning)", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.35)" },
  en_transit: { label: "En transit", color: "var(--accent-soft)", bg: "rgba(110,168,255,0.15)", border: "rgba(110,168,255,0.35)" },
  a_relivrer: { label: "A relivrer", color: "#f97316", bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.35)" },
  livre: { label: "Livre", color: "var(--success)", bg: "rgba(44,203,118,0.15)", border: "rgba(44,203,118,0.35)" },
  annule: { label: "Annule", color: "var(--danger)", bg: "rgba(255,95,95,0.15)", border: "rgba(255,95,95,0.35)" },
  retour: { label: "Retour", color: "var(--violet)", bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.35)" },
};

const STAGE_META = {
  pending_pickup: { label: "En attente de prise en charge", color: "#f59e0b", bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.28)" },
  picked_up: { label: "Pris en charge", color: "#0ea5e9", bg: "rgba(14,165,233,0.14)", border: "rgba(14,165,233,0.28)" },
  at_warehouse: { label: "Au depot", color: "#6366f1", bg: "rgba(99,102,241,0.14)", border: "rgba(99,102,241,0.28)" },
  out_for_delivery: { label: "Sorti du depot", color: "#8b5cf6", bg: "rgba(139,92,246,0.14)", border: "rgba(139,92,246,0.28)" },
  return_pending: { label: "Depot retour expediteur", color: "#8b5cf6", bg: "rgba(139,92,246,0.14)", border: "rgba(139,92,246,0.28)" },
  returned: { label: "Retour expediteur", color: "#a78bfa", bg: "rgba(167,139,250,0.14)", border: "rgba(167,139,250,0.28)" },
  delivered: { label: "Arrive a destination", color: "#34d399", bg: "rgba(52,211,153,0.14)", border: "rgba(52,211,153,0.28)" },
};

const STATUS_FILTERS = ["tous", "en_attente", "en_transit", "a_relivrer", "livre", "retour"];
const COLIS_PAGE_SIZE = 8;
const COURIER_SCAN_DEEP_LINK_BASE = "mzlivreur://mz-logistic/colis-action";

function normalizeStatus(value) {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("attente")) return "en_attente";
  if (raw.includes("transit")) return "en_transit";
  if (raw.includes("relivr") || raw.includes("report")) return "a_relivrer";
  if (raw.includes("livr")) return "livre";
  if (raw.includes("annul")) return "annule";
  if (raw.includes("retour")) return "retour";
  return raw;
}

function normalizeStage(value) {
  const raw = String(value || "").toLowerCase();
  if (raw === "return_pending") return "return_pending";
  if (raw === "out_for_delivery" || (raw.includes("out") && raw.includes("delivery"))) {
    return "out_for_delivery";
  }
  if (raw.includes("return")) return "returned";
  if (raw === "returned") return "returned";
  if (raw.includes("picked")) return "picked_up";
  if (raw.includes("warehouse")) return "at_warehouse";
  if (raw.includes("dispatch")) return "picked_up";
  if (raw.includes("deliver")) return "delivered";
  return "pending_pickup";
}

function effectiveStatusKey(colis) {
  const base = normalizeStatus(colis?.statut);
  const stage = normalizeStage(colis?.tracking_stage);

  if (base === "annule") return base;
  if (colis?.returned_at || colis?.returned_to_shipper_at || base === "retour" || stage === "returned" || stage === "return_pending") return "retour";
  if (colis?.delivered_at || base === "livre" || stage === "delivered") return "livre";
  if (base === "a_relivrer" || (stage === "at_warehouse" && colis?.last_delivery_issue_at)) return "a_relivrer";
  if (base === "en_transit") return "en_transit";
  if (base === "en_attente") return "en_attente";
  if (stage === "picked_up" || stage === "at_warehouse" || stage === "out_for_delivery") return "en_transit";
  return "en_attente";
}

function deliveryIssueReason(value) {
  return String(value || "").trim() || "Non renseigne";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-TN");
}

function formatDateTime(value) {
  if (!value) return "Non renseigne";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigne";
  return date.toLocaleString("fr-TN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toFixed(2)} DT` : "-";
}

function formatPrintAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("fr-TN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

function formatPrintDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const parts = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
}

function formatPrintIsoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPrintPhone(value) {
  return String(value || "")
    .split("/")
    .map((part) => part.trim().replace(/\s+/g, "").replace(/^\+216/, ""))
    .filter(Boolean)
    .join("/");
}

function splitDisplayName(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return { firstLine: "Non renseigne", secondLine: "" };
  }

  const words = raw.split(/\s+/);
  if (words.length <= 2) {
    return { firstLine: raw, secondLine: "" };
  }

  return {
    firstLine: words.slice(0, 2).join(" "),
    secondLine: words.slice(2).join(" "),
  };
}

function formatSenderAddress(profile) {
  const parts = [profile?.city, profile?.address]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.join(" ") || "Adresse non renseignee";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function deriveAddressLabel(address, fallback = "Origine") {
  const raw = String(address || "").trim();
  if (!raw) return fallback;
  const segments = raw.split(/[,/-]/).map((part) => part.trim()).filter(Boolean);
  if (segments.length > 0) return segments[0];
  return raw.length > 24 ? `${raw.slice(0, 24)}...` : raw;
}

function deriveDestinationLabel(colis) {
  return (colis?.destination_label || "").trim() || deriveAddressLabel(colis?.adresse_livraison, "Destination");
}
function deriveDepotLabel(colis) {
  const depot = String(colis?.depot_depart || "").toLowerCase().trim();

  if (depot === "kairouan") return "Dépôt Kairouan";
  if (depot === "sousse") return "Dépôt Sousse";

  return "Dépôt non défini";
}

function deriveDestinationGovernorate(colis) {
  return (
    String(colis?.gouvernorat || "").replace("_", " ").trim() ||
    String(colis?.zone || "").replace("_", " ").trim() ||
    "Gouvernorat non défini"
  );
}
function productName(item, index) {
  if (typeof item === "string" || typeof item === "number") return String(item);
  if (!item || typeof item !== "object") return `Produit ${index + 1}`;
  return item.nom || item.designation || item.name || item.label || `Produit ${index + 1}`;
}

function renderPrintProductRows(produits, totalPrice) {
  if (!Array.isArray(produits) || produits.length === 0) {
    return `
      <tr>
        <td class="designationCell">.</td>
        <td class="centerCell">1</td>
        <td class="centerCell">${escapeHtml(formatPrintAmount(totalPrice))}</td>
      </tr>
    `;
  }

  return produits
    .map((item, index) => {
      const quantity = Number(item?.quantite) || 1;
      const unitPrice = Number(item?.prix);
      const rowTotal = Number.isFinite(unitPrice) ? unitPrice * quantity : null;
      return `
        <tr>
          <td class="designationCell">${escapeHtml(productName(item, index) || ".")}</td>
          <td class="centerCell">${escapeHtml(quantity)}</td>
          <td class="centerCell">${escapeHtml(rowTotal != null ? formatPrintAmount(rowTotal) : formatPrintAmount(totalPrice))}</td>
        </tr>
      `;
    })
    .join("");
}

function getCourierScanCode(colis) {
  return String(colis?.barcode_value || colis?.numero_suivi || `COLIS-${colis?.id || ""}`).trim();
}

function createCourierScanLink(scanCode) {
  return `${COURIER_SCAN_DEEP_LINK_BASE}?code=${encodeURIComponent(scanCode)}`;
}

async function createQrDataUrl(value) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
    color: {
      dark: "#111111",
      light: "#ffffff",
    },
  });
}

function createMzLogoSvg() {
  return `
    <svg viewBox="0 0 180 124" xmlns="http://www.w3.org/2000/svg" aria-label="MZ Logistic">
      <rect width="180" height="124" fill="#ffffff"/>
      <path d="M18 107 L30 16 L58 16 L46 107 Z" fill="#101010"/>
      <path d="M67 107 L79 16 L107 16 L95 107 Z" fill="#101010"/>
      <path d="M116 107 L128 16 L156 16 L144 107 Z" fill="#101010"/>
      <polygon points="18,74 67,52 61,72 121,46 83,92 89,72 31,98" fill="#ea1c24"/>
      <rect x="42" y="111" width="52" height="2" fill="#ea1c24"/>
      <text x="68" y="122" text-anchor="middle" font-size="9" font-family="Arial, Helvetica, sans-serif" letter-spacing="1.6" fill="#444444">LOGISTIC</text>
    </svg>
  `;
}

async function buildPrintDocumentHtml(colis, shipperProfile) {
  const courierScanCode = getCourierScanCode(colis);
  const depotLabel = deriveDepotLabel(colis);
  const destinationGovernorate = deriveDestinationGovernorate(colis);
  const courierScanLink = createCourierScanLink(courierScanCode);
  const courierQrCode = await createQrDataUrl(courierScanLink);
  const bottomQrCode = await createQrDataUrl(courierScanLink);
  const senderName = splitDisplayName(shipperProfile?.name);
  const senderAddress = formatSenderAddress(shipperProfile);
  const senderPhone = formatPrintPhone(shipperProfile?.phone) || "Non renseigne";
  const senderGender =
    shipperProfile?.gender === "feminin"
      ? "F"
      : shipperProfile?.gender === "masculin"
        ? "M"
        : "";
  const recipientPhone = formatPrintPhone(colis.telephone_destinataire) || "Non renseigne";
  const printDateTime = formatPrintDateTime(new Date());
  const blfDate = formatPrintIsoDate(colis.created_at || new Date());
  const ouvrirColisLabel =
    (colis.ouvrir_colis || shipperProfile?.ouvrir_colis_par_defaut || "non").toLowerCase() === "oui"
      ? "Oui"
      : "Non";
  const logoSvg = createMzLogoSvg();

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Bon de livraison ${escapeHtml(colis.numero_suivi || "")}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #efefef;
            color: #111111;
            font-family: "Times New Roman", Times, serif;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 8mm 12mm 9mm;
            background: #ffffff;
          }
          .metaRow {
            position: relative;
            min-height: 18px;
            font-size: 11px;
            margin-bottom: 12px;
          }
          .metaDate {
            position: absolute;
            left: 0;
            top: 0;
          }
          .metaAction {
            text-align: center;
          }
          .topSection {
            display: grid;
            grid-template-columns: 290px 150px 1fr;
            column-gap: 24px;
            align-items: start;
          }
          .qrBox {
            padding-top: 6px;
          }
          .qrLabel {
            margin-bottom: 4px;
            font-size: 14px;
            font-weight: 700;
          }
          .qrImageWrap {
            min-height: 132px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
          }
          .qrImage {
            width: 126px;
            height: 126px;
            image-rendering: crisp-edges;
          }
          .scanCode {
            margin-top: 4px;
            padding-left: 2px;
            font-size: 13px;
            letter-spacing: 0.08em;
            white-space: nowrap;
            font-family: "Courier New", Courier, monospace;
          }
          .qrHint {
            min-height: 18px;
            margin-top: 2px;
            font-size: 13px;
          }
          .blfDate {
            margin-top: 18px;
            font-size: 12px;
          }
          .logoWrap {
            display: flex;
            justify-content: center;
            padding-top: 28px;
          }
          .logoWrap svg {
            width: 108px;
            height: auto;
          }
          .senderBlock {
            padding-top: 24px;
            font-size: 17px;
            line-height: 1.18;
            font-weight: 700;
          }
          .senderLine {
            white-space: nowrap;
          }
          .titleBox {
            width: 78%;
            margin: 12px auto 8px;
            border: 1.4px solid #4d4d4d;
            text-align: center;
            font-size: 18px;
            font-weight: 700;
            padding: 3px 10px;
          }
          .routeLine {
            margin: 0 0 26px;
            text-align: center;
            font-size: 18px;
            font-weight: 700;
          }
          .routeLine span {
            font-weight: 800;
          }
          .recipientBox {
            border: 1.4px solid #4d4d4d;
            padding: 6px 10px 7px;
            font-size: 18px;
            line-height: 1.25;
            margin-bottom: 26px;
          }
          .recipientTop {
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
          }
          .labelStrong {
            font-weight: 700;
          }
          .productsTable {
            width: 100%;
            border-collapse: separate;
            border-spacing: 2px;
            table-layout: fixed;
          }
          .productsTable th {
            border: 1.4px solid #4d4d4d;
            font-size: 17px;
            font-weight: 700;
            padding: 2px 6px;
            text-align: center;
          }
          .productsTable td {
            border: 1.4px solid #4d4d4d;
            font-size: 17px;
            padding: 6px 8px;
            height: 40px;
          }
          .productsTable th:nth-child(1) {
            width: 70%;
          }
          .productsTable th:nth-child(2) {
            width: 12%;
          }
          .productsTable th:nth-child(3) {
            width: 18%;
          }
          .designationCell {
            text-align: left;
          }
          .centerCell {
            text-align: center;
          }
          .totalLine {
            width: 40%;
            margin: 10px 0 0 auto;
            display: grid;
            grid-template-columns: auto auto;
            justify-content: end;
            column-gap: 10px;
            align-items: end;
            border-bottom: 1.4px solid #4d4d4d;
            padding-bottom: 3px;
            font-size: 26px;
            font-weight: 700;
          }
          .totalValue {
            white-space: nowrap;
          }
          .optionRow {
            display: grid;
            grid-template-columns: 1fr 1.15fr;
            border: 1.4px solid #4d4d4d;
            margin-top: 30px;
          }
          .optionCell {
            min-height: 38px;
            padding: 4px 8px;
            font-size: 24px;
            display: flex;
            align-items: center;
          }
          .optionCell + .optionCell {
            border-left: 1.4px solid #4d4d4d;
          }
          .bottomQr {
            width: 180px;
            margin: 6px auto 0;
            text-align: center;
          }
          .bottomQr .qrImageWrap {
            min-height: 138px;
            justify-content: center;
          }
          .footer {
            margin-top: 12px;
            padding-top: 8px;
            border-top: 1px solid #a7a7a7;
            font-size: 13px;
            line-height: 1.35;
          }
          @media print {
            body { background: #ffffff; }
            .page {
              width: auto;
              min-height: auto;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="metaRow">
            <div class="metaDate">${escapeHtml(printDateTime)}</div>
            <div class="metaAction">Imprimer</div>
          </div>

          <div class="topSection">
            <div class="qrBox">
              <div class="qrLabel">QR pour livreur</div>
              <div class="qrImageWrap">
                <img class="qrImage" src="${escapeHtml(courierQrCode)}" alt="QR livreur" />
              </div>
              <div class="scanCode">${escapeHtml(courierScanCode)}</div>
              <div class="qrHint">Ouvre l'app livreur et propose les actions.</div>
              <div class="blfDate">Date BLF : ${escapeHtml(blfDate)}</div>
            </div>

            <div class="logoWrap">${logoSvg}</div>

            <div class="senderBlock">
              <div class="senderLine">Exp&#233;diteur : ${escapeHtml(senderName.firstLine)}</div>
              ${senderName.secondLine ? `<div class="senderLine">${escapeHtml(senderName.secondLine)}</div>` : ""}
              <div class="senderLine">Adr: ${escapeHtml(senderAddress)}</div>
              <div class="senderLine">T&#233;l.: ${escapeHtml(senderPhone)}</div>
              <div class="senderLine">M/F: ${escapeHtml(senderGender)}</div>
            </div>
          </div>

          <div class="titleBox">BON DE LIVRAISON N&#176; ${escapeHtml(colis.numero_suivi || "")}</div>
          <div class="routeLine">
<span>${escapeHtml(depotLabel)}</span> &gt;&gt; <span>${escapeHtml(destinationGovernorate)}</span>          </div>

          <div class="recipientBox">
            <div class="recipientTop">
              <div><span class="labelStrong">Nom destinataire :</span> ${escapeHtml(colis.nom_destinataire || "Non renseigne")}</div>
              <div><span class="labelStrong">T&#233;l. :</span> ${escapeHtml(recipientPhone)}</div>
            </div>
            <div><span class="labelStrong">Adresse :</span> ${escapeHtml(colis.adresse_livraison || "Non renseignee")}</div>
          </div>

          <table class="productsTable">
            <thead>
              <tr>
                <th>D&#233;signation</th>
                <th>Quantit&#233;</th>
                <th>Montant Total</th>
              </tr>
            </thead>
            <tbody>
              ${renderPrintProductRows(colis.produits, colis.prix)}
            </tbody>
          </table>

          <div class="totalLine">
            <span>Total en TTC :</span>
            <span class="totalValue">${escapeHtml(formatPrintAmount(colis.prix))} DT</span>
          </div>

          <div class="optionRow">
            <div class="optionCell">Esp&#232;ce seulement</div>
            <div class="optionCell">Ouvrir le colis : ${escapeHtml(ouvrirColisLabel)}</div>
          </div>

          <div class="bottomQr">
            <div class="qrLabel">QR suivi livreur</div>
            <div class="qrImageWrap">
              <img class="qrImage" src="${escapeHtml(bottomQrCode)}" alt="QR suivi livreur" />
            </div>
            <div class="scanCode">${escapeHtml(colis.numero_suivi || courierScanCode)}</div>
          </div>

          <div class="footer">
            <div>Si&#232;ge social : Kairouan</div>
            <div>Matricule Fiscale : 1905319K/A/M/000</div>
          </div>
        </div>

        <script>
          window.addEventListener("load", function () {
            window.setTimeout(function () {
              window.print();
            }, 200);
          });
          window.addEventListener("afterprint", function () {
            window.close();
          });
        </script>
      </body>
    </html>
  `;
}

async function printColisSheet(colis, shipperProfile) {
  if (!isApprovedAdminNote(colis?.admin_note)) {
    alert("L'impression n'est disponible qu'apres validation du colis par l'admin.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=980,height=760");
  if (!printWindow) {
    alert("Impossible d'ouvrir la fenetre d'impression. Autorisez les popups puis reessayez.");
    return;
  }

  let nextPrintHtml = "";
  try {
    nextPrintHtml = await buildPrintDocumentHtml(colis, shipperProfile);
  } catch (err) {
    console.error("Erreur QR:", err);
    printWindow.close();
    alert("Impossible de generer le QR code pour l'impression.");
    return;
  }

  printWindow.document.write(nextPrintHtml);
  printWindow.document.close();
  printWindow.focus();
}

export default function TousColis() {
  const navigate = useNavigate();
  const [colisList, setColisList] = useState([]);
  const [shipperProfile, setShipperProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("tous");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [colisData, profileRes] = await Promise.all([
        colisService.getAll(),
        api.get("/auth/me"),
      ]);
      setColisList(Array.isArray(colisData) ? colisData : []);
      setShipperProfile(profileRes?.data || null);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await colisService.delete(id);
      setColisList((prev) => prev.filter((colis) => colis.id !== id));
      setDeleteConfirm(null);
    } catch {
      alert("Erreur suppression");
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return colisList.filter((colis) => {
      const statusKey = effectiveStatusKey(colis);
      const matchStatut = filterStatut === "tous" || statusKey === filterStatut;
      const matchSearch =
        query === "" ||
        colis.numero_suivi?.toLowerCase().includes(query) ||
        colis.nom_destinataire?.toLowerCase().includes(query) ||
        colis.adresse_livraison?.toLowerCase().includes(query) ||
        colis.barcode_value?.toLowerCase().includes(query) ||
        deriveDestinationLabel(colis).toLowerCase().includes(query);
      return matchStatut && matchSearch;
    });
  }, [colisList, filterStatut, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / COLIS_PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * COLIS_PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * COLIS_PAGE_SIZE, filtered.length);
  const paginatedColis = filtered.slice(
    (safePage - 1) * COLIS_PAGE_SIZE,
    safePage * COLIS_PAGE_SIZE
  );
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <div style={{ minHeight: "100vh", background: "var(--page-bg)", color: "var(--text-primary)", fontFamily: "system-ui, Arial, sans-serif" }}>
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
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#7aa2ff", boxShadow: "0 0 0 6px rgba(122,162,255,0.15)" }} />
          <span style={{ fontWeight: 900 }}>MZ Logistic</span>
          <span style={{ opacity: 0.4, margin: "0 4px" }}>|</span>
          <span style={{ opacity: 0.7, fontSize: "0.9rem" }}>Mes colis</span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <ThemeToggleButton compact />
          <button
            onClick={() => navigate("/expediteur/dashboard")}
            style={{ background: "var(--surface-card)", border: "1px solid var(--border-soft)", color: "var(--text-primary)", borderRadius: 12, padding: "10px 16px", cursor: "pointer", fontWeight: 700 }}
          >
            Retour
          </button>
        </div>
      </header>

      <div style={{ padding: "24px 28px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 900 }}>Mes colis</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: "0.88rem" }}>
            {loading ? "Chargement..." : `${colisList.length} colis au total`}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Rechercher par numero, code barre, nom, ville..."
            style={{ flex: 1, minWidth: 240, borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface-panel-soft)", color: "var(--text-primary)", padding: "10px 14px", outline: "none", fontSize: "0.9rem" }}
          />

          {STATUS_FILTERS.map((statusKey) => {
            const info =
              statusKey === "tous"
                ? { label: "Tous", color: "var(--accent-soft)", bg: "rgba(110,168,255,0.15)", border: "rgba(110,168,255,0.35)" }
                : STATUS_LABELS[statusKey];
            const active = filterStatut === statusKey;
            return (
              <button
                key={statusKey}
                onClick={() => {
                  setFilterStatut(statusKey);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "9px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  background: active ? info.bg : "rgba(255,255,255,.04)",
                  border: active ? `1px solid ${info.border}` : "1px solid rgba(255,255,255,.10)",
                  color: active ? info.color : "var(--text-muted)",
                }}
              >
                {info.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p style={{ textAlign: "center", opacity: 0.6, paddingTop: 60 }}>Chargement...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60, opacity: 0.6 }}>
            <div style={{ fontSize: "3rem" }}>?</div>
            <p>Aucun colis trouve</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))", gap: 14 }}>
              {paginatedColis.map((colis) => (
                <ColisCard
                  key={colis.id}
                  colis={colis}
                  onPrint={() => printColisSheet(colis, shipperProfile)}
                  onEdit={() => navigate(`/expediteur/colis/${colis.id}/modifier`)}
                  onDelete={() => setDeleteConfirm(colis.id)}
                />
              ))}
            </div>

            {filtered.length > COLIS_PAGE_SIZE && (
              <div style={paginationStyle}>
                <div style={paginationInfoStyle}>
                  Affichage {pageStart}-{pageEnd} sur {filtered.length}
                </div>
                <div aria-label="Pagination colis" style={paginationActionsStyle}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                    style={{
                      ...pageButtonStyle,
                      opacity: safePage === 1 ? 0.45 : 1,
                      cursor: safePage === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Precedent
                  </button>

                  {pages.map((page) => {
                    const active = page === safePage;

                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        style={{
                          ...pageButtonStyle,
                          background: active ? "var(--accent-bg)" : "var(--surface-card)",
                          border: active ? "1px solid var(--accent-border)" : "1px solid var(--border-soft)",
                          color: active ? "var(--accent-soft)" : "var(--text-primary)",
                        }}
                      >
                        {page}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setCurrentPage(Math.min(pageCount, safePage + 1))}
                    disabled={safePage === pageCount}
                    style={{
                      ...pageButtonStyle,
                      opacity: safePage === pageCount ? 0.45 : 1,
                      cursor: safePage === pageCount ? "not-allowed" : "pointer",
                    }}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "var(--overlay-bg)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--auth-panel-bg)", border: "1px solid var(--border-soft)", borderRadius: 16, padding: 32, textAlign: "center", maxWidth: 360, width: "90%" }}>
            <div style={{ fontSize: "3rem" }}>Suppr.</div>
            <h3 style={{ margin: "12px 0 8px", color: "var(--text-primary)" }}>Supprimer ce colis ?</h3>
            <p style={{ opacity: 0.7, marginBottom: 24 }}>Cette action est irreversible.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, padding: 12, border: "1px solid var(--border-strong)", borderRadius: 10, background: "var(--surface-card)", color: "var(--text-primary)", cursor: "pointer", fontWeight: 700 }}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{ flex: 1, padding: 12, border: "1px solid var(--danger-border)", borderRadius: 10, background: "rgba(255,95,95,.15)", color: "var(--danger)", cursor: "pointer", fontWeight: 700 }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const paginationStyle = {
  marginTop: 18,
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid var(--border-soft)",
  background: "var(--surface-panel-soft)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const paginationInfoStyle = {
  color: "var(--text-secondary)",
  fontSize: "0.84rem",
  fontWeight: 800,
};

const paginationActionsStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const pageButtonStyle = {
  minWidth: 38,
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 12,
  background: "var(--surface-card)",
  border: "1px solid var(--border-soft)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontWeight: 900,
};

function ColisCard({ colis, onPrint, onEdit, onDelete }) {
  const isAdminApproved = isApprovedAdminNote(colis.admin_note);
  const status = STATUS_LABELS[effectiveStatusKey(colis)] || {
    label: colis.statut,
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.1)",
    border: "rgba(148,163,184,0.3)",
  };
  const stage = STAGE_META[normalizeStage(colis.tracking_stage)] || STAGE_META.pending_pickup;

  return (
    <div style={{ borderRadius: 14, border: "1px solid var(--border-soft)", background: "var(--surface-panel-soft)", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--surface-deep)", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <span style={{ fontFamily: "monospace", color: "var(--accent-soft)", fontSize: "0.85rem", fontWeight: 700 }}>
          #{colis.numero_suivi}
        </span>
        <span style={{ background: status.bg, border: `1px solid ${status.border}`, color: status.color, padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700 }}>
          {status.label}
        </span>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div>
          <div style={{ fontSize: "0.7rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Destinataire</div>
          <div style={{ fontWeight: 700 }}>{colis.nom_destinataire}</div>
          <div style={{ fontSize: "0.82rem", opacity: 0.7 }}>{colis.telephone_destinataire}</div>
        </div>

        <div>
          <div style={{ fontSize: "0.7rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Trajet</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{deriveDepotLabel(colis)} &gt;&gt; {deriveDestinationGovernorate(colis)}</div>
          <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, background: stage.bg, border: `1px solid ${stage.border}`, color: stage.color, borderRadius: 999, padding: "4px 10px", fontSize: "0.72rem", fontWeight: 800 }}>
            {stage.label}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--surface-inset-strong)", borderRadius: 10, padding: 12 }}>
          <div>
            <div style={{ fontSize: "0.68rem", opacity: 0.5, marginBottom: 3 }}>Code barre</div>
            <div style={{ fontWeight: 800, fontFamily: "monospace", fontSize: "0.9rem" }}>{colis.barcode_value || "-"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.68rem", opacity: 0.5, marginBottom: 3 }}>Prix</div>
            <div style={{ fontWeight: 800, color: "var(--success)", fontSize: "0.9rem" }}>{formatMoney(colis.prix)}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.68rem", opacity: 0.5, marginBottom: 3 }}>Poids</div>
            <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{colis.poids} kg</div>
          </div>
          <div>
            <div style={{ fontSize: "0.68rem", opacity: 0.5, marginBottom: 3 }}>Date</div>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", opacity: 0.8 }}>{formatDate(colis.created_at)}</div>
          </div>
        </div>

        {(colis.picked_up_at || colis.warehouse_received_at || colis.out_for_delivery_at || colis.last_delivery_issue_at || colis.returned_at || colis.delivered_at) && (
          <div style={{ display: "grid", gap: 5, fontSize: "0.78rem", opacity: 0.82 }}>
            {colis.picked_up_at && <div>Pris en charge: {formatDateTime(colis.picked_up_at)}</div>}
            {colis.warehouse_received_at && <div>Entre au depot: {formatDateTime(colis.warehouse_received_at)}</div>}
            {colis.out_for_delivery_at && <div>Sorti du depot: {formatDateTime(colis.out_for_delivery_at)}</div>}
            {colis.last_delivery_issue_at && <div>A relivrer: {formatDateTime(colis.last_delivery_issue_at)} - {deliveryIssueReason(colis.last_delivery_issue_reason)}</div>}
            {colis.returned_at && <div>Retour expediteur: {formatDateTime(colis.returned_at)}</div>}
            {colis.delivered_at && <div>Arrive a destination: {formatDateTime(colis.delivered_at)}</div>}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isAdminApproved
            ? "minmax(0, 1fr)"
            : "repeat(2, minmax(0, 1fr))",
          gap: 8,
          padding: 10,
          borderTop: "1px solid var(--border-subtle)",
          marginTop: "auto",
        }}
      >
        {isAdminApproved ? (
          <button
            onClick={onPrint}
            style={{ border: "1px solid rgba(44,203,118,.18)", minHeight: 48, padding: "12px 10px", background: "rgba(44,203,118,.12)", color: "var(--success)", cursor: "pointer", fontWeight: 700, borderRadius: 14 }}
          >
            Imprimer
          </button>
        ) : (
          <>
            <button
              onClick={onEdit}
              style={{ border: "1px solid var(--accent-border)", minHeight: 48, padding: "12px 10px", background: "var(--accent-bg-soft)", color: "var(--accent-soft)", cursor: "pointer", fontWeight: 700, borderRadius: 14 }}
            >
              Modifier
            </button>
            <button
              onClick={onDelete}
              style={{ border: "1px solid var(--danger-border)", minHeight: 48, padding: "12px 10px", background: "var(--danger-bg)", color: "var(--danger)", cursor: "pointer", fontWeight: 700, borderRadius: 14 }}
            >
              Supprimer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
