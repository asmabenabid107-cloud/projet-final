export function normalizeAdminNote(note) {
  return String(note || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isApprovedAdminNote(note) {
  const normalized = normalizeAdminNote(note);
  return normalized === "accepte" || normalized.includes("accept");
}

export function isRejectedAdminNote(note) {
  const normalized = normalizeAdminNote(note);
  return normalized === "refuse" || normalized.includes("refus");
}

export function adminNoteLabel(note) {
  if (isApprovedAdminNote(note)) return "Accepte";
  if (isRejectedAdminNote(note)) return "Refuse";
  return note || "";
}
