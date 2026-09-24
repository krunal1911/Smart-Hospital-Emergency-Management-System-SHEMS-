// -----------------------------------------------------------------------
// GEOCODING + EXTERNAL HOSPITAL SEARCH
//
// Built on the free, keyless OpenStreetMap stack:
//   - Nominatim  -> turns a PIN code into coordinates (geocoding) and a
//                   coordinate into an area name/pincode (reverse geocoding)
//   - Overpass   -> finds real hospitals near a coordinate (POI search)
//
// No API key is required for either, which is why they're used here
// instead of Google Places (which needs a billed API key this project
// doesn't have). If you have a Google Places API key and want to switch,
// see the note at the bottom of this file.
//
// Both are free public services with real rate limits (Nominatim: ~1
// request/second; Overpass: shared server capacity). Every function here:
//   - has a timeout, so a slow/unreachable service can never hang a request
//   - never throws — failures return null/[] so callers can fall back
//     gracefully instead of the whole search breaking
//   - caches geocoding results in memory, since the same PIN codes get
//     searched over and over in real usage
// -----------------------------------------------------------------------

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'SHEMS-Emergency-Module/1.0';

const geocodeCache = new Map(); // pincode -> { lat, lng, label, cachedAt }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — a PIN code's coordinates don't change

const fetchWithTimeout = async (url, timeoutMs = 6000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Converts a PIN code or place name (e.g., 'Valsad', 'Bandra', '396002',
 * 'Pramukh shivalay abrama valsad') into coordinates.
 * Returns { lat, lng, label } on success, or null. Never throws.
 *
 * Strategy (each step only runs if the previous returned nothing):
 *  1. 6-digit Indian PIN → Nominatim postal search
 *  2. Full query + India (e.g. "Pramukh shivalay abrama valsad, India")
 *  3. Last word(s) extracted as city/area (e.g. "valsad, India")
 *  4. Global fallback (no country restriction)
 */
export const geocodeLocation = async (queryInput) => {
  const query = (queryInput || '').trim();
  if (!query) return null;

  const cacheKey = query.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const tryQuery = async (url) => {
    try {
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) return null;
      const results = await res.json();
      if (!results || results.length === 0) return null;
      const r = results[0];
      return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: r.display_name };
    } catch {
      return null;
    }
  };

  try {
    let resolved = null;

    // 1. 6-digit Indian PIN code
    if (/^[1-9][0-9]{5}$/.test(query)) {
      resolved = await tryQuery(
        `${NOMINATIM_BASE}/search?format=json&limit=1&countrycodes=in&postalcode=${encodeURIComponent(query)}`
      );
    }

    // 2. Full query + India
    if (!resolved) {
      resolved = await tryQuery(
        `${NOMINATIM_BASE}/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(`${query}, India`)}`
      );
    }

    // 3. Extract city/area from the query (last 1-2 meaningful words)
    //    e.g. "Pramukh shivalay abrama valsad" → try "valsad" and "abrama valsad"
    if (!resolved) {
      const words = query.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        // Try last word alone (usually the city name)
        const cityOnly = words[words.length - 1];
        resolved = await tryQuery(
          `${NOMINATIM_BASE}/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(`${cityOnly}, India`)}`
        );

        // Try last 2 words
        if (!resolved && words.length > 2) {
          const lastTwo = words.slice(-2).join(' ');
          resolved = await tryQuery(
            `${NOMINATIM_BASE}/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(`${lastTwo}, India`)}`
          );
        }
      }
    }

    // 4. Global fallback (no country restriction)
    if (!resolved) {
      resolved = await tryQuery(
        `${NOMINATIM_BASE}/search?format=json&limit=1&q=${encodeURIComponent(query)}`
      );
    }

    if (!resolved) return null;

    const entry = { ...resolved, cachedAt: Date.now() };
    geocodeCache.set(cacheKey, entry);
    return entry;
  } catch (err) {
    console.error(`[geo] geocodeLocation(${query}) failed:`, err.message);
    return null;
  }
};

export const geocodePincode = geocodeLocation;

/**
 * Reverse-geocodes a coordinate into a best-effort area name + PIN code.
 * Returns { area: 'Local', pincode: '' } if unavailable. Never throws.
 */
export const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetchWithTimeout(`${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`, 5000);
    if (!res.ok) return { area: 'Local', pincode: '' };
    const data = await res.json();
    const addr = data.address || {};
    const area = addr.city || addr.town || addr.village || addr.county || addr.state_district || addr.state || 'Local';
    const rawPincode = (addr.postcode || '').trim();
    const pincode = /^[1-9][0-9]{5}$/.test(rawPincode) ? rawPincode : '';
    return { area, pincode };
  } catch (err) {
    return { area: 'Local', pincode: '' };
  }
};

const overpassCache = new Map(); // key -> { results, cachedAt }
const OVERPASS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

/**
 * Queries OpenStreetMap's Overpass API for real hospitals within
 * `radiusMeters` of (lat, lng). Returns [] on any failure — treat that as
 * "no external data available right now", not "no hospitals exist".
 * Never throws.
 */
export const searchOverpassHospitals = async (lat, lng, radiusMeters) => {
  // Round coordinates to ~1km precision grid for cache keying
  const gridKey = `${lat.toFixed(2)}_${lng.toFixed(2)}_${radiusMeters}`;
  const cached = overpassCache.get(gridKey);
  if (cached && Date.now() - cached.cachedAt < OVERPASS_CACHE_TTL_MS) {
    return cached.results;
  }

  // A 50km radius in a dense city (Mumbai, Delhi...) can return thousands
  // of elements — give Overpass more time than the 5/10km cases need, both
  // in the query itself and in our own fetch timeout, so a large-radius
  // search doesn't get cut off and wrongly look like "no hospitals".
  const overpassTimeoutSec = radiusMeters >= 20000 ? 20 : 10;
  const fetchTimeoutMs = radiusMeters >= 20000 ? 15000 : 9000;
  const query = `[out:json][timeout:${overpassTimeoutSec}];(node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});way["amenity"="hospital"](around:${radiusMeters},${lat},${lng});node["healthcare"="hospital"](around:${radiusMeters},${lat},${lng}););out center tags;`;

  try {
    const res = await fetchWithTimeout(`${OVERPASS_BASE}?data=${encodeURIComponent(query)}`, fetchTimeoutMs);
    if (!res.ok) return cached ? cached.results : [];
    const data = await res.json();
    const elements = data.elements || [];

    const formatted = elements
      .map((el) => {
        // Nodes have lat/lon directly; ways/relations only have a center point.
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (elLat == null || elLng == null) return null;

        const tags = el.tags || {};
        const name = tags.name || tags['name:en'] || 'Unnamed Hospital';
        const addressParts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean);

        return {
          externalId: `osm-${el.type}-${el.id}`,
          name,
          address: addressParts.length > 0 ? addressParts.join(', ') : '',
          phone: tags.phone || tags['contact:phone'] || '',
          lat: elLat,
          lng: elLng,
          pincode: tags['addr:postcode'] || '',
        };
      })
      .filter(Boolean);

    overpassCache.set(gridKey, { results: formatted, cachedAt: Date.now() });
    return formatted;
  } catch (err) {
    console.error('[geo] searchOverpassHospitals failed:', err.message);
    return cached ? cached.results : [];
  }
};

// A universal Google Maps deep link that opens directly on a coordinate —
// works whether or not the place has a matching name in Google's index.
export const buildGoogleMapsUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

// -----------------------------------------------------------------------
// Switching to Google Places API later:
// If you obtain a billed Google Cloud API key with Places API enabled,
// replace searchOverpassHospitals's implementation with a call to
// `https://maps.googleapis.com/maps/api/place/nearbysearch/json
//   ?location=${lat},${lng}&radius=${radiusMeters}&type=hospital&key=${API_KEY}`
// and map the `results[]` array to the same { name, address, phone, lat,
// lng, pincode } shape used above — geoSearch.js doesn't need to change.
// -----------------------------------------------------------------------
