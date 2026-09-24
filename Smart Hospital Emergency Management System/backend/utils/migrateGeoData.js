// -----------------------------------------------------------------------
// MIGRATION: Backfill `location` (GeoJSON) and `pincode` on existing
// Hospital / Ambulance records.
//
// Two independent steps:
//
//   Step A — Backfill `location` from latitude/longitude.
//     This is the field MongoDB's $near geospatial queries actually run
//     against (see models/Hospital.js, models/Ambulance.js, and
//     utils/geoSearch.js). Any hospital/ambulance that existed before this
//     field was added won't show up in ANY nearby search — map-based,
//     PIN-code-based, or the patient dashboard — until this runs.
//     Pure computation, no network call, instant, safe to re-run.
//
//   Step B — Backfill `pincode` via reverse geocoding (needs internet).
//     Informational/display only — not required for search to work, but
//     nice to have filled in. Rate-limited to Nominatim's ~1 req/sec
//     policy, so this step can take a while on a large table.
//
// Usage:
//   cd backend
//   npm run migrate:geo
//
// Safe to re-run at any time.
// -----------------------------------------------------------------------

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import { reverseGeocode } from './geo.js';

dotenv.config();

const REQUEST_DELAY_MS = 1100; // stay well under Nominatim's public rate limit
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const backfillLocations = async () => {
  console.log('[MIGRATION] Step A: backfilling geospatial `location` field...');

  const hospitals = await Hospital.find({});
  let hospitalsFixed = 0;
  for (const hospital of hospitals) {
    const expected = [hospital.longitude, hospital.latitude];
    const current = hospital.location?.coordinates;
    const alreadyCorrect = current && current[0] === expected[0] && current[1] === expected[1];
    if (!alreadyCorrect) {
      hospital.location = { type: 'Point', coordinates: expected };
      // eslint-disable-next-line no-await-in-loop
      await hospital.save();
      hospitalsFixed++;
    }
  }

  const ambulances = await Ambulance.find({});
  let ambulancesFixed = 0;
  for (const ambulance of ambulances) {
    const expected = [ambulance.currentLongitude, ambulance.currentLatitude];
    const current = ambulance.location?.coordinates;
    const alreadyCorrect = current && current[0] === expected[0] && current[1] === expected[1];
    if (!alreadyCorrect) {
      ambulance.location = { type: 'Point', coordinates: expected };
      // eslint-disable-next-line no-await-in-loop
      await ambulance.save();
      ambulancesFixed++;
    }
  }

  console.log(`[MIGRATION] Step A done. Fixed location on ${hospitalsFixed} hospital(s), ${ambulancesFixed} ambulance(s).`);
};

const backfillPincodes = async () => {
  console.log('[MIGRATION] Step B: backfilling `pincode` via reverse geocoding (needs internet)...');

  const hospitalsToFix = await Hospital.find({ pincode: '' });
  const ambulancesToFix = await Ambulance.find({ pincode: '' });
  console.log(`[MIGRATION] ${hospitalsToFix.length} hospital(s) and ${ambulancesToFix.length} ambulance(s) need a pincode.`);

  let updated = 0;
  let skipped = 0;

  for (const hospital of hospitalsToFix) {
    // eslint-disable-next-line no-await-in-loop
    const { pincode } = await reverseGeocode(hospital.latitude, hospital.longitude);
    if (pincode) {
      hospital.pincode = pincode;
      // eslint-disable-next-line no-await-in-loop
      await hospital.save();
      console.log(`[MIGRATION] Hospital "${hospital.name}" -> ${pincode}`);
      updated++;
    } else {
      console.warn(`[MIGRATION] Could not resolve a pincode for hospital "${hospital.name}". Leave blank and set manually if needed.`);
      skipped++;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(REQUEST_DELAY_MS);
  }

  for (const ambulance of ambulancesToFix) {
    // eslint-disable-next-line no-await-in-loop
    const { pincode } = await reverseGeocode(ambulance.currentLatitude, ambulance.currentLongitude);
    if (pincode) {
      ambulance.pincode = pincode;
      // eslint-disable-next-line no-await-in-loop
      await ambulance.save();
      console.log(`[MIGRATION] Ambulance "${ambulance.vehicleNumber}" -> ${pincode}`);
      updated++;
    } else {
      console.warn(`[MIGRATION] Could not resolve a pincode for ambulance "${ambulance.vehicleNumber}". Leave blank and set manually if needed.`);
      skipped++;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`[MIGRATION] Step B done. Updated ${updated} record(s), skipped ${skipped} (no internet / no match — safe to re-run later).`);
};

const migrate = async () => {
  await backfillLocations();
  await backfillPincodes();
  console.log('[MIGRATION] All done.');
};

// If run directly from terminal
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrateGeoData.js')) {
  mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart-hospital-ems')
    .then(async () => {
      await Promise.all([Hospital.init(), Ambulance.init()]);
      await migrate();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[MIGRATION] Database connection error:', err);
      process.exit(1);
    });
}

export default migrate;
