// -----------------------------------------------------------------------
// AUTO-PROVISIONING OF NEARBY DEMO FACILITIES  (currently unused by
// default — kept for optional demo/offline use, see note below)
//
// The original seed data only places hospitals/ambulances around Mumbai,
// so picking a location anywhere else (e.g. Navsari) always returned the
// same 3 far-away facilities with huge distances. This utility fixed that
// by generating a small, realistic set of FAKE hospitals/ambulances
// positioned right around any searched location.
//
// It has since been superseded by backend/utils/geoSearch.js, which
// returns REAL hospitals (via OpenStreetMap) instead of synthetic ones —
// a strictly better fix for the same problem. None of the emergency
// controllers call ensureNearbyFacilities() anymore. This file is kept
// only in case you want a fully offline demo mode (no internet at all)
// where synthetic nearby data is preferable to empty results — wire
// ensureNearbyFacilities(lat, lng) back in wherever that's needed.
//
// It's idempotent per-area: once a location has enough nearby facilities,
// later calls for that same area are a no-op (fast distance check only).
// -----------------------------------------------------------------------

import crypto from 'crypto';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import { calculateDistance } from './distance.js';
import { reverseGeocode } from './geo.js';

const NEARBY_RADIUS_KM = 25;
const MIN_HOSPITALS_NEARBY = 2;
const MIN_AMBULANCES_NEARBY = 2;

const HOSPITAL_NAME_TEMPLATES = [
  '{area} General Hospital',
  '{area} Emergency & Trauma Center',
  '{area} Community Health Center',
  '{area} Multispeciality Hospital',
];

const STATE_CODES = ['MH', 'GJ', 'RJ', 'DL', 'KA', 'TN', 'UP', 'WB', 'MP', 'PB'];

// ~1 degree of latitude is ~111km — converts a km jitter into a degree offset
// so generated facilities land a realistic short drive from the pin, not on
// top of it or absurdly far away.
const randomJitter = (km) => {
  const degRange = km / 111;
  return (Math.random() - 0.5) * 2 * degRange;
};

const randomPhone = () => `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`;

const randomPlate = () => {
  const state = STATE_CODES[Math.floor(Math.random() * STATE_CODES.length)];
  const rto = String(Math.floor(1 + Math.random() * 60)).padStart(2, '0');
  const letters = Array.from({ length: 2 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${state}-${rto}-${letters}-${digits}`;
};

// Best-effort reverse geocoding so generated facilities are named after the
// actual area ("Navsari General Hospital") instead of a generic placeholder,
// and tagged with a real PIN code where available. Delegates to the shared
// implementation in geo.js (used everywhere else in the app too) so there's
// one source of truth instead of duplicated Nominatim-calling logic.
const reverseGeocodeArea = reverseGeocode;

// Creates a throwaway User account to satisfy the required `user`/`driver`
// reference on Hospital/Ambulance documents. Nobody logs in with these —
// they exist purely so the generated facility is a valid, linked record
// that behaves identically to a real hospital/driver everywhere else in
// the app (admin panels, dashboards, etc).
const createDemoUser = async (role, namePrefix) => {
  const id = crypto.randomBytes(4).toString('hex');
  return User.create({
    name: `${namePrefix} ${id}`,
    email: `auto-${role}-${id}@shems.local`,
    password: crypto.randomBytes(12).toString('hex'),
    role,
    phone: randomPhone(),
    isVerified: true,
  });
};

/**
 * Ensures at least MIN_HOSPITALS_NEARBY approved hospitals and
 * MIN_AMBULANCES_NEARBY available ambulances exist within NEARBY_RADIUS_KM
 * of (lat, lng). Generates whatever's missing, positioned near that exact
 * point. Safe to call on every search — cheap no-op once an area is covered.
 */
export const ensureNearbyFacilities = async (lat, lng) => {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return;

  const [approvedHospitals, availableAmbulances] = await Promise.all([
    Hospital.find({ isApproved: true }),
    Ambulance.find({ status: 'available', availability: true }),
  ]);

  const hospitalsNearby = approvedHospitals.filter(
    (h) => calculateDistance(lat, lng, h.latitude, h.longitude) <= NEARBY_RADIUS_KM
  );
  const ambulancesNearby = availableAmbulances.filter(
    (a) => calculateDistance(lat, lng, a.currentLatitude, a.currentLongitude) <= NEARBY_RADIUS_KM
  );

  const needHospitals = Math.max(0, MIN_HOSPITALS_NEARBY - hospitalsNearby.length);
  const needAmbulances = Math.max(0, MIN_AMBULANCES_NEARBY - ambulancesNearby.length);

  if (needHospitals === 0 && needAmbulances === 0) return;

  const { area, pincode } = await reverseGeocodeArea(lat, lng);

  const newHospitals = [];
  for (let i = 0; i < needHospitals; i++) {
    const hUser = await createDemoUser('hospital', `${area} Hospital Admin`);
    const name = HOSPITAL_NAME_TEMPLATES[i % HOSPITAL_NAME_TEMPLATES.length].replace('{area}', area);

    const totalBeds = 40 + Math.floor(Math.random() * 40);
    const icuBedsTotal = 8 + Math.floor(Math.random() * 10);
    const oxygenBedsTotal = 10 + Math.floor(Math.random() * 15);
    const emergencyBedsTotal = 6 + Math.floor(Math.random() * 8);

    const hospital = await Hospital.create({
      user: hUser._id,
      name,
      address: `${area} (auto-generated demo listing)`,
      contact: randomPhone(),
      emergencyContact: randomPhone(),
      totalBeds,
      availableBeds: Math.floor(totalBeds * (0.2 + Math.random() * 0.5)),
      icuBedsTotal,
      icuBedsAvailable: Math.floor(icuBedsTotal * (0.2 + Math.random() * 0.5)),
      oxygenBedsTotal,
      oxygenBedsAvailable: Math.floor(oxygenBedsTotal * (0.2 + Math.random() * 0.5)),
      emergencyBedsTotal,
      emergencyBedsAvailable: Math.max(1, Math.floor(emergencyBedsTotal * (0.3 + Math.random() * 0.5))),
      hasTraumaCenter: Math.random() > 0.5,
      doctorsAvailable: 3 + Math.floor(Math.random() * 10),
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      latitude: lat + randomJitter(4),
      longitude: lng + randomJitter(4),
      isApproved: true,
      autoGenerated: true,
      pincode,
    });
    newHospitals.push(hospital);
  }

  // Ambulances require a hospitalAssigned — use a nearby hospital (existing
  // or just-created above), so this is always satisfiable.
  const assignableHospitals = [...hospitalsNearby, ...newHospitals];
  for (let i = 0; i < needAmbulances; i++) {
    const dUser = await createDemoUser('driver', `${area} Ambulance Driver`);

    let vehicleNumber = randomPlate();
    // eslint-disable-next-line no-await-in-loop
    while (await Ambulance.findOne({ vehicleNumber })) {
      vehicleNumber = randomPlate();
    }

    const assignedHospital = assignableHospitals[i % assignableHospitals.length];

    await Ambulance.create({
      vehicleNumber,
      driver: dUser._id,
      driverContact: randomPhone(),
      status: 'available',
      currentLatitude: lat + randomJitter(3),
      currentLongitude: lng + randomJitter(3),
      hospitalAssigned: assignedHospital._id,
      availability: true,
      autoGenerated: true,
      pincode,
    });
  }
};

export default ensureNearbyFacilities;
