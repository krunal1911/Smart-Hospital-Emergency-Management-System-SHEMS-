// -----------------------------------------------------------------------
// GEOSPATIAL "NEARBY" SEARCH — the real replacement for both the old
// full-table Haversine scan and the broken exact-pincode-field match.
//
// For any (lat, lng):
//   1. Query our own DB with MongoDB's $near (needs the 2dsphere index on
//      `location` — see models/Hospital.js and models/Ambulance.js).
//   2. For hospitals, ALSO query OpenStreetMap's Overpass API for real
//      hospitals in the same radius, and merge the two lists (de-duping
//      anything that's clearly the same physical hospital in both).
//   3. If nothing is found at 5 km, automatically retry at 10 km, then
//      20 km, then 50 km. Only after all four attempts come back empty do
//      we report "no results" — never before.
//
// Ambulances are database-only: unlike hospitals, there is no public
// geocoding service that indexes "ambulances near me" as real-world
// points of interest, so there's nothing external to merge in there.
// -----------------------------------------------------------------------

import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import { calculateDistance, calculateETA } from './distance.js';
import { searchOverpassHospitals, buildGoogleMapsUrl } from './geo.js';

export const SEARCH_RADII_KM = [5, 10, 20, 50];

const kmToMeters = (km) => km * 1000;
const round2 = (n) => Math.round(n * 100) / 100;

const normalizeName = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Treats a DB hospital and an OSM hospital as the same physical place if
// they're within ~300m of each other AND one name contains the other
// (handles "City Hospital" vs "City Hospital & Trauma Center"). When
// that happens we keep the DB entry, since it has live bed-availability
// data an OSM record never will.
const isSameHospital = (dbHospital, osmHospital) => {
  const distanceKm = calculateDistance(dbHospital.latitude, dbHospital.longitude, osmHospital.lat, osmHospital.lng);
  if (distanceKm > 0.3) return false;
  const a = normalizeName(dbHospital.name);
  const b = normalizeName(osmHospital.name);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
};

const formatDbHospital = (h, originLat, originLng) => {
  const distance = calculateDistance(originLat, originLng, h.latitude, h.longitude);
  return {
    _id: h._id,
    name: h.name,
    address: h.address,
    contact: h.contact || null,
    emergencyContact: h.emergencyContact || null,
    distance: round2(distance),
    eta: calculateETA(distance),
    generalBedsAvailable: h.availableBeds,
    icuBedsAvailable: h.icuBedsAvailable,
    icuBedsTotal: h.icuBedsTotal,
    emergencyBedsAvailable: h.emergencyBedsAvailable,
    emergencyBedsTotal: h.emergencyBedsTotal,
    hasTraumaCenter: h.hasTraumaCenter,
    rating: h.rating,
    googleMapsUrl: buildGoogleMapsUrl(h.latitude, h.longitude),
    source: 'database',
  };
};

const formatOsmHospital = (osm, originLat, originLng) => {
  const distance = calculateDistance(originLat, originLng, osm.lat, osm.lng);
  return {
    _id: osm.externalId,
    name: osm.name,
    address: osm.address || 'Address not available',
    contact: osm.phone || null,
    emergencyContact: osm.phone || null,
    distance: round2(distance),
    eta: calculateETA(distance),
    // OpenStreetMap doesn't carry live bed-availability data — these stay
    // null on purpose (the frontend shows "Not available" rather than a
    // misleading 0).
    generalBedsAvailable: null,
    icuBedsAvailable: null,
    icuBedsTotal: null,
    emergencyBedsAvailable: null,
    emergencyBedsTotal: null,
    hasTraumaCenter: null,
    rating: null,
    googleMapsUrl: buildGoogleMapsUrl(osm.lat, osm.lng),
    source: 'openstreetmap',
  };
};

/**
 * Database-only progressive-radius hospital search (no OpenStreetMap
 * merge). Used directly by flows where only OUR OWN registered hospitals
 * are valid choices — e.g. a driver assigning a case to a hospital, or a
 * patient booking a bed — since those need a real Hospital document with
 * a bed count and an account behind it, not an arbitrary external listing.
 * `findHospitalsNear` (below) builds on this and adds OpenStreetMap
 * results for the public-facing "what's around me" preview.
 */
export const findDbHospitalsNear = async (lat, lng) => {
  for (const radiusKm of SEARCH_RADII_KM) {
    const maxDistance = kmToMeters(radiusKm);
    // eslint-disable-next-line no-await-in-loop
    const hospitals = await Hospital.find({
      isApproved: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxDistance,
        },
      },
    });
    if (hospitals.length > 0) {
      return { radiusKm, hospitals, exhausted: false };
    }
  }
  return { radiusKm: SEARCH_RADII_KM[SEARCH_RADII_KM.length - 1], hospitals: [], exhausted: true };
};

/**
 * Finds hospitals near (lat, lng). Merges our own approved hospitals with
 * real hospitals from OpenStreetMap, expanding the search radius through
 * SEARCH_RADII_KM until at least one result is found (or all radii are
 * exhausted). Returns { radiusKm, hospitals, exhausted }.
 */
export const findHospitalsNear = async (lat, lng) => {
  for (const radiusKm of SEARCH_RADII_KM) {
    const maxDistance = kmToMeters(radiusKm);

    // eslint-disable-next-line no-await-in-loop
    const [dbHospitals, osmHospitals] = await Promise.all([
      Hospital.find({
        isApproved: true,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: maxDistance,
          },
        },
      }),
      searchOverpassHospitals(lat, lng, maxDistance),
    ]);

    const dbResults = dbHospitals.map((h) => formatDbHospital(h, lat, lng));

    const unmatchedOsm = osmHospitals.filter((osm) => !dbHospitals.some((db) => isSameHospital(db, osm)));
    const osmResults = unmatchedOsm.map((osm) => formatOsmHospital(osm, lat, lng));

    const merged = [...dbResults, ...osmResults].sort((a, b) => a.distance - b.distance);

    if (merged.length > 0) {
      return { radiusKm, hospitals: merged, exhausted: false };
    }
  }

  return { radiusKm: SEARCH_RADII_KM[SEARCH_RADII_KM.length - 1], hospitals: [], exhausted: true };
};

import ensureNearbyFacilities from './autoProvision.js';

/**
 * Finds available ambulances near (lat, lng) via $near, expanding the
 * radius the same way as findHospitalsNear. Database-only — see the
 * file-level comment for why there's no external source to merge here.
 * Returns { radiusKm, ambulances, exhausted }.
 */
export const findAmbulancesNear = async (lat, lng) => {
  // Ensure at least demo ambulances exist in the requested area
  await ensureNearbyFacilities(lat, lng);

  for (const radiusKm of SEARCH_RADII_KM) {
    const maxDistance = kmToMeters(radiusKm);

    // eslint-disable-next-line no-await-in-loop
    const dbAmbulances = await Ambulance.find({
      status: 'available',
      availability: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxDistance,
        },
      },
    }).populate('hospitalAssigned', 'name');

    if (dbAmbulances.length > 0) {
      const results = dbAmbulances
        .map((a) => {
          const distance = calculateDistance(lat, lng, a.currentLatitude, a.currentLongitude);
          return {
            _id: a._id,
            vehicleNumber: a.vehicleNumber,
            driverContact: a.driverContact,
            baseHospital: a.hospitalAssigned ? a.hospitalAssigned.name : null,
            distance: round2(distance),
            eta: calculateETA(distance),
            googleMapsUrl: buildGoogleMapsUrl(a.currentLatitude, a.currentLongitude),
            source: 'database',
          };
        })
        .sort((a, b) => a.distance - b.distance);

      return { radiusKm, ambulances: results, exhausted: false };
    }
  }

  return { radiusKm: SEARCH_RADII_KM[SEARCH_RADII_KM.length - 1], ambulances: [], exhausted: true };
};
