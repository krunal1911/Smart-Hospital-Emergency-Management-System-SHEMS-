// -----------------------------------------------------------------------
// VERIFICATION SCRIPT — run this after starting your MongoDB and seeding
// data, to confirm the PIN-code search actually works for real Indian
// PIN codes end-to-end (geocode -> geospatial search -> results).
//
// This exists because the sandbox this feature was built in has no
// network access, so live calls to Nominatim/Overpass couldn't be made
// during development. Run this yourself once, locally, where you DO have
// internet, to get a real pass/fail report.
//
// Usage:
//   cd backend
//   npm run test:pincodes
// -----------------------------------------------------------------------

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import { geocodePincode } from './geo.js';
import { findHospitalsNear, findAmbulancesNear } from './geoSearch.js';

dotenv.config();

const TEST_PINCODES = [
  { pincode: '380015', city: 'Ahmedabad' },
  { pincode: '380061', city: 'Ahmedabad' },
  { pincode: '395007', city: 'Surat' },
  { pincode: '390007', city: 'Vadodara' },
  { pincode: '360001', city: 'Rajkot' },
  { pincode: '110001', city: 'New Delhi' },
  { pincode: '560001', city: 'Bengaluru' },
  { pincode: '400001', city: 'Mumbai' },
  { pincode: '700001', city: 'Kolkata' },
  { pincode: '500001', city: 'Hyderabad' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkmark = (ok) => (ok ? '✓' : '✗');

const runOne = async ({ pincode, city }) => {
  const row = { pincode, city, checks: {}, notes: [] };

  // Step 1/2: geocode
  const geocoded = await geocodePincode(pincode);
  row.checks.geocoded = !!geocoded;
  if (!geocoded) {
    row.notes.push('Geocoding failed — check internet connection / Nominatim availability.');
    return row;
  }
  row.resolvedLocation = geocoded;

  // Step 3-5/7: geospatial search
  const [hospitalResult, ambulanceResult] = await Promise.all([
    findHospitalsNear(geocoded.lat, geocoded.lng),
    findAmbulancesNear(geocoded.lat, geocoded.lng),
  ]);
  row.hospitalResult = hospitalResult;
  row.ambulanceResult = ambulanceResult;

  // ✓ Hospitals are returned
  row.checks.hospitalsReturned = hospitalResult.hospitals.length > 0;
  // ✓ Distances are calculated
  row.checks.distancesCalculated =
    hospitalResult.hospitals.length === 0 || hospitalResult.hospitals.every((h) => typeof h.distance === 'number' && !Number.isNaN(h.distance));
  // ✓ Maps open correctly (URL well-formed)
  row.checks.mapsUrlValid =
    hospitalResult.hospitals.length === 0 || hospitalResult.hospitals.every((h) => /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(h.googleMapsUrl));
  // ✓ Empty results handled properly / no false "No hospitals found"
  //   i.e. if hospitals is empty, `exhausted` must be true (we really did
  //   try all 4 radii, this isn't a premature/incorrect empty result)
  row.checks.noFalseEmpty = hospitalResult.hospitals.length > 0 || hospitalResult.exhausted === true;

  if (!row.checks.hospitalsReturned) {
    row.notes.push(`No hospitals found even after expanding to ${hospitalResult.radiusKm} km. This can legitimately happen in very remote areas, but is worth double-checking manually on a map for a real city PIN code.`);
  }
  if (ambulanceResult.ambulances.length === 0) {
    row.notes.push(`No ambulances found within ${ambulanceResult.radiusKm} km (database-only — expected unless you've seeded/registered ambulances near ${city}).`);
  }

  return row;
};

const printReport = (rows) => {
  console.log('\n===================== PIN CODE SEARCH VERIFICATION =====================\n');
  for (const row of rows) {
    console.log(`PIN ${row.pincode} (${row.city})`);
    if (!row.checks.geocoded) {
      console.log(`  ${checkmark(false)} Geocoded to coordinates`);
      row.notes.forEach((n) => console.log(`    - ${n}`));
      console.log('');
      continue;
    }
    console.log(`  ${checkmark(true)} Geocoded to (${row.resolvedLocation.lat}, ${row.resolvedLocation.lng})`);
    console.log(`  ${checkmark(row.checks.hospitalsReturned)} Hospitals returned (${row.hospitalResult.hospitals.length} found within ${row.hospitalResult.radiusKm} km)`);
    console.log(`  ${checkmark(row.checks.distancesCalculated)} Distances calculated for every result`);
    console.log(`  ${checkmark(row.checks.mapsUrlValid)} Google Maps links well-formed`);
    console.log(`  ${checkmark(row.checks.noFalseEmpty)} No false "No hospitals found" (empty only after all radii exhausted)`);
    console.log(`  ${row.ambulanceResult.ambulances.length > 0 ? '✓' : 'ℹ'} Ambulances: ${row.ambulanceResult.ambulances.length} found within ${row.ambulanceResult.radiusKm} km`);
    if (row.hospitalResult.hospitals.length > 0) {
      const top3 = row.hospitalResult.hospitals.slice(0, 3);
      top3.forEach((h) => console.log(`      - ${h.name} (${h.distance} km, source: ${h.source})`));
    }
    row.notes.forEach((n) => console.log(`    - ${n}`));
    console.log('');
  }

  const allPass = rows.every((r) => r.checks.geocoded && r.checks.hospitalsReturned && r.checks.distancesCalculated && r.checks.mapsUrlValid && r.checks.noFalseEmpty);
  console.log('==========================================================================');
  console.log(allPass ? 'ALL CHECKS PASSED for all 10 PIN codes.' : 'SOME CHECKS FAILED — see ✗ marks above.');
  console.log('==========================================================================\n');

  return allPass;
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart-hospital-ems');
  await Promise.all([Hospital.init(), Ambulance.init()]);
  console.log('[verify] Connected to database. Testing 10 PIN codes (this respects Nominatim rate limits, so it will take ~1-2 minutes)...\n');

  const rows = [];
  for (const entry of TEST_PINCODES) {
    // eslint-disable-next-line no-await-in-loop
    const row = await runOne(entry);
    rows.push(row);
    // eslint-disable-next-line no-await-in-loop
    await sleep(1200); // stay under Nominatim's ~1 req/sec policy across the whole run
  }

  const allPass = printReport(rows);
  await mongoose.disconnect();
  process.exit(allPass ? 0 : 1);
};

run().catch((err) => {
  console.error('[verify] Fatal error:', err);
  process.exit(1);
});
