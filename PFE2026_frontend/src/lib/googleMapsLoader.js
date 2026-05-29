import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let configuredKey = null;

export function configureGoogleMapsOnce(key) {
  const nextKey = String(key || "").trim();

  if (!nextKey) {
    throw new Error("Missing Google Maps API key");
  }

  if (configuredKey && configuredKey !== nextKey) {
    throw new Error(
      "Google Maps is already loaded with another API key. Refresh the page after changing the key.",
    );
  }

  if (configuredKey) {
    return;
  }

  setOptions({
    key: nextKey,
    v: "weekly",
  });

  configuredKey = nextKey;
}

export async function loadMapsLibrary() {
  await importLibrary("maps");
  await importLibrary("marker");

  return globalThis.google?.maps ?? null;
}
