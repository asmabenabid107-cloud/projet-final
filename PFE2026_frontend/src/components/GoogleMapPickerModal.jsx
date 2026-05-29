import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import {
  configureGoogleMapsOnce,
  loadMapsLibrary,
} from "../lib/googleMapsLoader.js";

const DEFAULT_CENTER = { lat: 36.8065, lng: 10.1815 };

function normalizeSearchValue(value) {
  return String(value || "").trim();
}

function parseCoordinateSearch(value) {
  const cleaned = normalizeSearchValue(value)
    .replace(/[()]/g, " ")
    .replace(/\b(lat|latitude|lng|long|longitude)\b/gi, " ")
    .replace(/[=:]/g, " ")
    .trim();

  const match = cleaned.match(
    /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/,
  );

  if (!match) {
    return null;
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return {
      error: "Coordonnees invalides. Exemple valide: 36.8065,10.1815.",
    };
  }

  return { lat, lng };
}

function geocodeAddress(geocoder, address) {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address, region: "TN" }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        resolve(results[0]);
        return;
      }

      if (status === "ZERO_RESULTS") {
        reject(new Error("Aucun resultat trouve pour cette adresse."));
        return;
      }

      reject(new Error(`Recherche Google Maps impossible (${status}).`));
    });
  });
}

export default function GoogleMapPickerModal({
  open,
  onClose,
  onPick,
  apiKey,
}) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const [backendApiKey, setBackendApiKey] = useState("");
  const [loadingKey, setLoadingKey] = useState(false);
  const [runtimeError, setRuntimeError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState({
    tone: "info",
    message: "",
  });
  const key = String(apiKey || backendApiKey || "").trim();
  const error =
    open && !loadingKey && !key
      ? "Ajoutez d abord une cle Google Maps valide."
      : runtimeError;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && open) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || key) {
      return undefined;
    }

    let cancelled = false;
    setLoadingKey(true);
    setRuntimeError("");

    api
      .get("/admin/settings/google-maps")
      .then((response) => {
        if (cancelled) {
          return;
        }

        setBackendApiKey(String(response.data?.api_key || "").trim());
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setBackendApiKey("");
        setRuntimeError(
          String(
            err?.response?.data?.detail ||
              err?.message ||
              "Impossible de recuperer la cle Google Maps depuis le backend.",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingKey(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, key]);

  useEffect(() => {
    if (open) {
      setSearchFeedback({ tone: "info", message: "" });
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    if (!key || loadingKey) {
      return undefined;
    }

    let cancelled = false;

    async function initOrShow() {
      setRuntimeError("");

      configureGoogleMapsOnce(key);
      const maps = await loadMapsLibrary();

      if (cancelled || !maps || !mapDivRef.current) {
        return;
      }

      if (!geocoderRef.current && maps.Geocoder) {
        geocoderRef.current = new maps.Geocoder();
      }

      if (!mapRef.current) {
        mapRef.current = new maps.Map(mapDivRef.current, {
          center: DEFAULT_CENTER,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        mapRef.current.addListener("click", (event) => {
          const lat = event.latLng?.lat();
          const lng = event.latLng?.lng();

          if (lat == null || lng == null) {
            return;
          }

          setMarker(lat, lng);
          onPick?.(lat, lng);
        });
      }

      window.setTimeout(() => {
        if (!mapRef.current) {
          return;
        }

        const center = mapRef.current.getCenter();
        maps.event.trigger(mapRef.current, "resize");
        if (center) {
          mapRef.current.setCenter(center);
        }
      }, 80);
    }

    initOrShow().catch((err) => {
      if (!cancelled) {
        setRuntimeError(
          String(err?.message || err || "Google Maps failed to load"),
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, key, loadingKey, onPick]);

  function centerOnMyLocation() {
    if (!navigator.geolocation || !mapRef.current) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        mapRef.current.setCenter({ lat, lng });
        mapRef.current.setZoom(13);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function setMarker(lat, lng) {
    const maps = globalThis.google?.maps;

    if (!maps || !mapRef.current) {
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new maps.Marker({
        map: mapRef.current,
        position: { lat, lng },
      });
    } else {
      markerRef.current.setPosition({ lat, lng });
    }
  }

  function selectLocation(lat, lng, label) {
    if (mapRef.current) {
      mapRef.current.setCenter({ lat, lng });
      mapRef.current.setZoom(14);
    }

    setMarker(lat, lng);
    setSearchFeedback({
      tone: "success",
      message: `${label} selectionne: ${lat.toFixed(6)},${lng.toFixed(6)}.`,
    });
    onPick?.(lat, lng);
  }

  async function handleSearchSubmit(event) {
    event.preventDefault();

    const query = normalizeSearchValue(searchTerm);
    if (!query) {
      setSearchFeedback({
        tone: "warning",
        message: "Saisissez une adresse ou des coordonnees lat,lng.",
      });
      return;
    }

    const coordinates = parseCoordinateSearch(query);
    if (coordinates?.error) {
      setSearchFeedback({ tone: "warning", message: coordinates.error });
      return;
    }

    if (coordinates) {
      selectLocation(coordinates.lat, coordinates.lng, "Coordonnees");
      return;
    }

    if (!geocoderRef.current) {
      setSearchFeedback({
        tone: "warning",
        message: "Le service de recherche Google Maps n est pas encore pret.",
      });
      return;
    }

    setSearching(true);
    setSearchFeedback({
      tone: "info",
      message: "Recherche de l adresse dans Google Maps...",
    });

    try {
      const result = await geocodeAddress(geocoderRef.current, query);
      const location = result.geometry?.location;
      const lat = location?.lat();
      const lng = location?.lng();

      if (lat == null || lng == null) {
        throw new Error("Adresse trouvee, mais sans coordonnees utilisables.");
      }

      selectLocation(lat, lng, result.formatted_address || query);
    } catch (err) {
      setSearchFeedback({
        tone: "warning",
        message: String(err?.message || err || "Recherche impossible."),
      });
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className={`plannerOverlay ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="plannerBackdrop" onClick={onClose} />

      <div className="plannerModal" role="dialog" aria-modal="true">
        <div className="plannerModalTop">
          <div>
            <div className="plannerModalTitle">Choisir un arret</div>
            <div className="plannerModalHint">
              Recherchez une ville, une adresse ou des coordonnees, puis
              validez. Appuyez sur <span className="plannerKbd">Esc</span> pour
              fermer.
            </div>
          </div>

          <div className="plannerMiniRow">
            <button type="button" onClick={centerOnMyLocation}>
              Me localiser
            </button>
            <button type="button" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>

        {error ? (
          <div className="plannerPlaceholder">
            <div className="plannerPlaceholderTitle">
              Carte Google indisponible
            </div>
            <div className="plannerPlaceholderText">{error}</div>
          </div>
        ) : loadingKey ? (
          <div className="plannerPlaceholder">
            <div className="plannerPlaceholderTitle">
              Chargement de la carte Google
            </div>
            <div className="plannerPlaceholderText">
              Recuperation de la cle Google Maps depuis le backend...
            </div>
          </div>
        ) : (
          <>
            <form className="plannerSearchBar" onSubmit={handleSearchSubmit}>
              <input
                className="routePlannerInput plannerSearchInput"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                type="text"
                placeholder="Tunis, Kairouan, ou 36.8065,10.1815"
              />
              <button type="submit" disabled={searching}>
                {searching ? "Recherche..." : "Rechercher et ajouter"}
              </button>
            </form>
            {searchFeedback.message ? (
              <div className={`plannerSearchStatus ${searchFeedback.tone}`}>
                {searchFeedback.message}
              </div>
            ) : null}
            <div ref={mapDivRef} className="plannerPickerMap" />
          </>
        )}
      </div>
    </div>
  );
}
