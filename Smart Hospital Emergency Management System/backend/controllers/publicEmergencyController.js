// -----------------------------------------------------------------------
// PUBLIC EMERGENCY CONTROLLER
//
// Every function in this file is reachable WITHOUT login. It exists so a
// patient, bystander, family member, or police officer can get emergency
// help immediately after an accident, with no account, no password, and
// no form to fill in first.
//
// Core rule enforced throughout: never require identity before help.
// A caseNumber + accessToken pair (handed back only to the reporter's own
// browser at creation time) is used instead of a login, purely so a
// stranger can't browse other people's cases by guessing case numbers.
// -----------------------------------------------------------------------

import crypto from 'crypto';
import mongoose from 'mongoose';
import EmergencyCase from '../models/EmergencyCase.js';
import EmergencyCaseUpdate from '../models/EmergencyCaseUpdate.js';
import HospitalNotification from '../models/HospitalNotification.js';
import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import User from '../models/User.js';
import Driver from '../models/Driver.js';

import { calculateDistance, calculateETA } from '../utils/distance.js';
import { generateCaseNumber } from '../utils/caseId.js';
import { findHospitalsNear, findAmbulancesNear } from '../utils/geoSearch.js';
import { geocodePincode } from '../utils/geo.js';
import { calculateTriageScore } from '../utils/triage.js';
import {
  emitToHospital,
  emitToEmergencyCaseRoom,
  sendRealtimeNotification,
  broadcastEmergencyToDrivers,
} from '../sockets/socketManager.js';

// Indian PIN codes are 6 digits and never start with 0.
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

// Look up a case by caseNumber and verify the caller holds the matching
// accessToken. Returns the case (with accessToken selected) or null.
const findCaseForReporter = async (caseNumber, token) => {
  if (!caseNumber || !token) return null;
  const emergencyCase = await EmergencyCase.findOne({ caseNumber }).select('+accessToken');
  if (!emergencyCase || emergencyCase.accessToken !== token) return null;
  return emergencyCase;
};

// -----------------------------------------------------------------------
// 1. PUBLIC: Raise an SOS / Emergency Help request.
//    Only a location is required. Everything else — condition, name,
//    phone — is optional so a panicking bystander is never blocked.
// -----------------------------------------------------------------------
export const sosCreateCase = async (req, res) => {
  try {
    const { lat, lng, accidentAddress, patientCondition, conditionNotes, reporterName, reporterPhone, reporterRelation, pincode, symptoms, vitals } = req.body;

    const accidentLat = parseFloat(lat);
    const accidentLng = parseFloat(lng);
    if (isNaN(accidentLat) || isNaN(accidentLng)) {
      return res.status(400).json({ message: 'Location (lat, lng) is required to raise an SOS. Please allow location access or enter it manually.' });
    }

    // PIN code is optional, but if provided it must be a valid 6-digit
    // Indian PIN code — it drives exact-match nearby search for this case.
    let accidentPincode = '';
    if (pincode) {
      if (!PINCODE_REGEX.test(String(pincode).trim())) {
        return res.status(400).json({ message: 'Please enter a valid 6-digit PIN code.' });
      }
      accidentPincode = String(pincode).trim();
    }

    let caseNumber = generateCaseNumber();
    while (await EmergencyCase.findOne({ caseNumber })) {
      caseNumber = generateCaseNumber();
    }
    const accessToken = crypto.randomBytes(16).toString('hex');

    // Calculate Clinical Triage Category
    const triageResult = calculateTriageScore({
      symptoms: symptoms || [patientCondition],
      vitals,
      conditionNotes: conditionNotes || '',
    });

    const emergencyCase = await EmergencyCase.create({
      caseNumber,
      accessToken,
      source: 'public',
      createdBy: null,
      ambulance: null,
      accidentLatitude: accidentLat,
      accidentLongitude: accidentLng,
      accidentAddress: accidentAddress || '',
      accidentPincode,
      patientCondition: patientCondition || 'unknown',
      conditionNotes: conditionNotes || '',
      reporterName: reporterName || '',
      reporterPhone: reporterPhone || '',
      reporterRelation: reporterRelation || '',
      triageCategory: triageResult.triageCategory,
      triageScore: triageResult.triageScore,
      recommendedBedType: triageResult.recommendedBedType,
      status: 'created',
    });

    // Broadcast real-time emergency pop-up alert to ALL driver accounts and nearby ambulances
    try {
      const allDriverUsers = await User.find({ role: 'driver' }).select('_id');
      const nearbyAmbs = await findAmbulancesNear(accidentLat, accidentLng);
      const top4Ambs = nearbyAmbs.ambulances.slice(0, 4);
      const ambIds = top4Ambs.map((a) => a._id);
      const dbAmbs = await Ambulance.find({ _id: { $in: ambIds } }).select('driver');

      const driverUserIds = Array.from(new Set([
        ...allDriverUsers.map((u) => String(u._id)),
        ...dbAmbs.map((a) => String(a.driver)).filter(Boolean)
      ]));

      const dispatchPayload = {
        caseId: emergencyCase._id,
        caseNumber: emergencyCase.caseNumber,
        accidentLatitude: accidentLat,
        accidentLongitude: accidentLng,
        accidentAddress: accidentAddress || 'Near ' + (accidentPincode || 'Location'),
        patientCondition: emergencyCase.patientCondition,
        triageCategory: emergencyCase.triageCategory,
        triageScore: emergencyCase.triageScore,
        createdAt: emergencyCase.createdAt,
      };

      console.log(`[SOS] Broadcasting to ${driverUserIds.length} driver(s):`, driverUserIds);
      broadcastEmergencyToDrivers(driverUserIds, dispatchPayload);

      // Fallback: also broadcast to the shared 'all_drivers' global room
      const { getIO } = await import('../sockets/socketManager.js');
      const ioInstance = getIO();
      if (ioInstance) {
        ioInstance.emit('new_emergency_dispatch_broadcast', dispatchPayload);
        console.log('[SOS] Also emitted global broadcast to all connected sockets');
      }
    } catch (bErr) {
      console.error('[sosCreateCase] Broadcast error:', bErr.message);
    }

    res.status(201).json({
      status: 'success',
      message: 'Emergency case created. Searching for nearby ambulances...',
      data: {
        caseNumber: emergencyCase.caseNumber,
        accessToken,
        caseId: emergencyCase._id,
        status: emergencyCase.status,
        triageCategory: emergencyCase.triageCategory,
        triageScore: emergencyCase.triageScore,
        recommendedBedType: emergencyCase.recommendedBedType,
        detectedFlags: triageResult.detectedFlags,
        accidentPincode: emergencyCase.accidentPincode,
      },
    });
  } catch (error) {
    console.error('Error creating public emergency case:', error);
    res.status(500).json({ message: 'Error creating emergency case.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 2. PUBLIC: Nearby available ambulances for this case.
// -----------------------------------------------------------------------
export const listNearbyAmbulances = async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const { token } = req.query;

    const emergencyCase = await findCaseForReporter(caseNumber, token);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found or access token invalid.' });
    }

    // Expanding-radius geospatial search (5 -> 10 -> 20 -> 50 km), backed
    // by MongoDB's $near on the indexed `location` field — see
    // utils/geoSearch.js. Only reports empty after all radii are tried.
    const { radiusKm, ambulances, exhausted } = await findAmbulancesNear(
      emergencyCase.accidentLatitude,
      emergencyCase.accidentLongitude
    );

    res.status(200).json({
      status: 'success',
      results: ambulances.length,
      searchRadiusKm: radiusKm,
      message: exhausted ? 'No ambulances found within 50 km of this location.' : undefined,
      data: ambulances,
    });
  } catch (error) {
    console.error('[listNearbyAmbulances] error:', error);
    res.status(500).json({ message: 'Error searching nearby ambulances.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 3. PUBLIC: Request an ambulance — assigns it to this case immediately.
// -----------------------------------------------------------------------
export const requestAmbulance = async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const { token } = req.query;
    const { ambulanceId } = req.body;

    const emergencyCase = await findCaseForReporter(caseNumber, token);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found or access token invalid.' });
    }
    if (emergencyCase.ambulance) {
      return res.status(400).json({ message: 'An ambulance has already been requested for this case.' });
    }

    const ambulance = await Ambulance.findOne({ _id: ambulanceId, status: 'available', availability: true });
    if (!ambulance) {
      return res.status(400).json({ message: 'That ambulance is no longer available. Please pick another one.' });
    }

    const dist = calculateDistance(
      emergencyCase.accidentLatitude,
      emergencyCase.accidentLongitude,
      ambulance.currentLatitude,
      ambulance.currentLongitude
    );
    const eta = calculateETA(dist);

    ambulance.status = 'busy';
    ambulance.availability = false;
    await ambulance.save();

    emergencyCase.ambulance = ambulance._id;
    emergencyCase.status = 'ambulance_dispatched';
    await emergencyCase.save();

    await EmergencyCaseUpdate.create({
      emergencyCase: emergencyCase._id,
      updatedByRole: 'public',
      type: 'status',
      message: `Ambulance ${ambulance.vehicleNumber} requested by reporter. ETA ${eta} min.`,
    });

    // Let the driver know immediately
    sendRealtimeNotification(ambulance.driver, {
      title: 'New Emergency Pickup',
      message: `Case ${emergencyCase.caseNumber}: pickup requested near ${emergencyCase.accidentAddress || 'reported location'}.`,
      type: 'emergency',
    });
    emitToEmergencyCaseRoom(emergencyCase._id, 'case_status_updated', { status: 'ambulance_dispatched' });

    res.status(200).json({
      status: 'success',
      message: 'Ambulance requested and on the way.',
      data: {
        caseNumber: emergencyCase.caseNumber,
        status: emergencyCase.status,
        ambulance: {
          vehicleNumber: ambulance.vehicleNumber,
          driverContact: ambulance.driverContact,
          eta,
          distance: dist,
        },
      },
    });
  } catch (error) {
    console.error('Error requesting ambulance:', error);
    res.status(500).json({ message: 'Error requesting ambulance.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 4. PUBLIC: Nearby hospitals with live emergency/ICU/trauma bed info.
// -----------------------------------------------------------------------
export const listNearbyHospitals = async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const { token } = req.query;

    const emergencyCase = await findCaseForReporter(caseNumber, token);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found or access token invalid.' });
    }

    // Expanding-radius geospatial search (5 -> 10 -> 20 -> 50 km), merging
    // our own approved hospitals ($near on the indexed `location` field)
    // with real hospitals from OpenStreetMap — see utils/geoSearch.js.
    // Only reports empty after all radii are tried.
    const { radiusKm, hospitals, exhausted } = await findHospitalsNear(
      emergencyCase.accidentLatitude,
      emergencyCase.accidentLongitude
    );

    res.status(200).json({
      status: 'success',
      results: hospitals.length,
      searchRadiusKm: radiusKm,
      message: exhausted ? 'No hospitals found within 50 km of this location.' : undefined,
      data: hospitals,
    });
  } catch (error) {
    console.error('[listNearbyHospitals] error:', error);
    res.status(500).json({ message: 'Error searching nearby hospitals.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 5. PUBLIC: Select a hospital and notify it in the same step — every
//    second matters, so this does not require two separate button taps.
// -----------------------------------------------------------------------
export const selectAndNotifyHospital = async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const { token } = req.query;
    const { hospitalId } = req.body;

    const emergencyCase = await findCaseForReporter(caseNumber, token);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found or access token invalid.' });
    }

    // Nearby-hospital results can include real hospitals sourced from
    // OpenStreetMap (source: 'openstreetmap'), which have no account in
    // this system to notify — the frontend hides "Select & Notify" for
    // those and shows "Call" / "Directions" instead. This guard rejects
    // it cleanly (400) if it ever reaches the backend anyway, instead of
    // Mongoose throwing an opaque CastError trying to read it as an
    // ObjectId.
    if (!mongoose.isValidObjectId(hospitalId)) {
      return res.status(400).json({
        message: 'This hospital is an external listing and cannot be notified directly — please call it instead.',
      });
    }

    const hospital = await Hospital.findOne({ _id: hospitalId, isApproved: true });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found.' });
    }

    const originLat = emergencyCase.accidentLatitude;
    const originLng = emergencyCase.accidentLongitude;
    const dist = calculateDistance(originLat, originLng, hospital.latitude, hospital.longitude);
    const eta = calculateETA(dist);

    emergencyCase.hospital = hospital._id;
    emergencyCase.distance = dist;
    emergencyCase.eta = eta;
    emergencyCase.status = 'hospital_notified';
    await emergencyCase.save();

    const hospitalNotification = await HospitalNotification.create({
      hospital: hospital._id,
      emergencyCase: emergencyCase._id,
      patientCondition: emergencyCase.patientCondition,
      eta,
      distance: dist,
    });

    await EmergencyCaseUpdate.create({
      emergencyCase: emergencyCase._id,
      updatedByRole: 'public',
      type: 'status',
      message: `${hospital.name} selected and notified by reporter. ETA ${eta} min.`,
    });

    emitToHospital(hospital._id, 'new_emergency_case', {
      caseId: emergencyCase._id,
      caseNumber: emergencyCase.caseNumber,
      patientCondition: emergencyCase.patientCondition,
      eta,
      distance: dist,
      accidentTime: emergencyCase.accidentTime,
      notificationId: hospitalNotification._id,
      source: 'public',
    });
    sendRealtimeNotification(hospital.user, {
      title: 'Incoming Emergency Case (Public SOS)',
      message: `Case ${emergencyCase.caseNumber}: ${(emergencyCase.patientCondition || 'unknown').replace(/_/g, ' ')} patient, ETA ${eta} min.`,
      type: 'emergency',
    });
    emitToEmergencyCaseRoom(emergencyCase._id, 'case_status_updated', { status: 'hospital_notified' });

    res.status(200).json({
      status: 'success',
      message: `${hospital.name} has been notified and is preparing for arrival.`,
      data: { caseNumber: emergencyCase.caseNumber, status: emergencyCase.status, hospital: hospital.name, eta, distance: dist },
    });
  } catch (error) {
    console.error('Error selecting/notifying hospital:', error);
    res.status(500).json({ message: 'Error notifying hospital.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 6. PUBLIC: Poll case status (no login) so the reporter can watch
//    progress — ambulance en route, hospital notified, treatment started.
// -----------------------------------------------------------------------
export const getPublicCaseStatus = async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const { token } = req.query;

    const emergencyCase = await findCaseForReporter(caseNumber, token);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found or access token invalid.' });
    }

    await emergencyCase.populate('hospital', 'name address contact emergencyContact latitude longitude');
    await emergencyCase.populate({ path: 'ambulance', select: 'vehicleNumber driverContact currentLatitude currentLongitude' });

    res.status(200).json({
      status: 'success',
      data: {
        caseNumber: emergencyCase.caseNumber,
        status: emergencyCase.status,
        patientCondition: emergencyCase.patientCondition,
        hospital: emergencyCase.hospital,
        ambulance: emergencyCase.ambulance,
        distance: emergencyCase.distance,
        eta: emergencyCase.eta,
        treatmentStartedAt: emergencyCase.treatmentStartedAt,
        createdAt: emergencyCase.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving case status.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 7. PUBLIC: Search hospitals & ambulances by PIN code.
//
//    This does NOT query the database by a `pincode` field (that was the
//    bug in the previous version — most pincodes only have 1-2 hospitals
//    registered directly against them, so an exact-match query returned
//    empty almost every time). Instead:
//
//      Step 1: validate the 6-digit PIN code
//      Step 2: geocode it to real coordinates (Nominatim)
//      Step 3/4/5: geospatial search around those coordinates, merging our
//                  own DB with real OpenStreetMap hospitals, sorted by
//                  distance, with Google Maps links
//      Step 7: expand 5 -> 10 -> 20 -> 50 km until something is found
//
//    Usable BEFORE an SOS case exists (e.g. from the "Search by PIN Code"
//    box on the intro screen) — no caseNumber/token needed, this only
//    returns publicly-visible facility info.
// -----------------------------------------------------------------------
export const searchByPincode = async (req, res) => {
  try {
    const searchInput = String(req.query.query || req.query.pincode || '').trim();

    if (!searchInput) {
      return res.status(400).json({ message: 'Please enter a city, area, landmark, or 6-digit PIN code to search.' });
    }

    const geocoded = await geocodePincode(searchInput);
    if (!geocoded) {
      return res.status(502).json({
        message: `Could not resolve "${searchInput}" to a location right now. Please check spelling or enter a 6-digit PIN code / landmark.`,
      });
    }

    const [hospitalResult, ambulanceResult] = await Promise.all([
      findHospitalsNear(geocoded.lat, geocoded.lng),
      findAmbulancesNear(geocoded.lat, geocoded.lng),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        pincode: searchInput,
        resolvedLocation: { lat: geocoded.lat, lng: geocoded.lng, label: geocoded.label },
        hospitals: hospitalResult.hospitals,
        hospitalSearchRadiusKm: hospitalResult.radiusKm,
        ambulances: ambulanceResult.ambulances,
        ambulanceSearchRadiusKm: ambulanceResult.radiusKm,
        hospitalMessage: hospitalResult.exhausted ? `No hospitals found within 50 km of ${searchInput}.` : null,
        ambulanceMessage: ambulanceResult.exhausted ? `No ambulances found within 50 km of ${searchInput}.` : null,
      },
    });
  } catch (error) {
    console.error('[searchByPincode] error:', error);
    res.status(500).json({ message: 'Error searching location.', error: error.message });
  }
};
