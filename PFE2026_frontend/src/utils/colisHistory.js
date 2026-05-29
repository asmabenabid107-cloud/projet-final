export function normalizeHistoryText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isPickupHistoryEvent(event) {
  const kind = normalizeHistoryText(event?.kind || event?.status || event?.statut);
  const title = normalizeHistoryText(event?.title);

  return (
    kind === "pickup" ||
    kind === "picked_up" ||
    title.includes("colis recupere chez l expediteur") ||
    title.includes("pris chez expediteur") ||
    title.includes("recupere chez expediteur") ||
    title.includes("en cours d enlevement")
  );
}

function isWarehouseInEvent(event) {
  const kind = normalizeHistoryText(event?.kind || event?.status || event?.statut);
  const title = normalizeHistoryText(event?.title);

  return (
    kind === "warehouse_in" ||
    title.includes("colis depose au depot") ||
    title.includes("entree depot") ||
    title.includes("recevoir au depot")
  );
}

function isWarehouseOutEvent(event) {
  const kind = normalizeHistoryText(event?.kind || event?.status || event?.statut);
  const title = normalizeHistoryText(event?.title);

  return (
    kind === "warehouse_out" ||
    title.includes("colis sorti du depot") ||
    title.includes("sortie depot")
  );
}

function stripCourierNameFromNote(note) {
  return String(note || "").replace(/\s+par\s+Livreur\b[^.]*(?=\.)/gi, "");
}

export function sanitizeHistoryEvent(event) {
  if (!event || isPickupHistoryEvent(event)) return null;

  if (isWarehouseInEvent(event)) {
    return {
      ...event,
      title: "Colis depose au depot",
      note: "Le colis est arrive au depot.",
    };
  }

  if (isWarehouseOutEvent(event)) {
    return {
      ...event,
      title: "Colis sorti du depot",
      note: "Le colis a quitte le depot pour la livraison.",
    };
  }

  return {
    ...event,
    note: stripCourierNameFromNote(event.note),
  };
}
