import Driver from '../models/Driver.js';
import Ambulance from '../models/Ambulance.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import EmergencyCase from '../models/EmergencyCase.js';
import Hospital from '../models/Hospital.js';
import User from '../models/User.js';
import { calculateDistance, calculateETA } from '../utils/distance.js';
import { findAmbulancesNear } from '../utils/geoSearch.js';
import { sendRealtimeNotification, emitToEmergencyRoom, emitToEmergencyCaseRoom, notifyDriversCaseClaimed, broadcastEmergencyToDrivers } from '../sockets/socketManager.js';

export const toggleAvailability = async (req, res) => {
  try {
    const { status } = req.body; // 'available' or 'offline'
    if (!['available', 'offline'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) {
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    driver.status = status;
    await driver.save();

    // Toggle corresponding ambulance availability
    if (driver.currentAmbulance) {
      await Ambulance.findByIdAndUpdate(driver.currentAmbulance, {
        availability: status === 'available',
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Status updated to ${status}.`,
      data: driver,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error toggling availability.', error: error.message });
  }
};

export const getActiveRide = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver || !driver.currentAmbulance) {
      return res.status(200).json({ status: 'success', data: null });
    }

    // Find if there's an active emergency request assigned to this driver's ambulance
    const ride = await EmergencyRequest.findOne({
      ambulance: driver.currentAmbulance,
      status: { $nin: ['completed', 'rejected'] },
    }).populate('hospital');

    res.status(200).json({
      status: 'success',
      data: ride,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving active ride.', error: error.message });
  }
};

export const acceptRide = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await EmergencyRequest.findById(id).populate('hospital');
    if (!request) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    request.status = 'driver_assigned';
    await request.save();

    // Sockets notify hospital and patient
    // NOTE: notifications are addressed by the recipient's *User* account id
    // (the id every client joins its `user_<id>` room under), which for a
    // hospital is `hospital.user` — not the Hospital document's own _id.
    sendRealtimeNotification(request.hospital?.user, {
      title: 'Driver Accepted Ride',
      message: `The driver has accepted the assignment for Emergency #${request._id}.`,
      type: 'emergency',
    });
    sendRealtimeNotification(request.patient, {
      title: 'Ambulance En Route',
      message: `The ambulance driver has accepted your emergency request and is heading your way.`,
      type: 'emergency',
    });
    emitToEmergencyRoom(request._id, 'ride_status_updated', {
      status: 'driver_assigned',
    });

    res.status(200).json({
      status: 'success',
      message: 'Ride request accepted. Prepare for dispatch.',
      data: request,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting ride.', error: error.message });
  }
};

export const rejectRide = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await EmergencyRequest.findById(id).populate('hospital');
    if (!request) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    // Release ambulance and put request back to pending
    const ambulanceId = request.ambulance;
    request.ambulance = null;
    request.status = 'pending'; // Reset back to pending for re-assignment
    await request.save();

    if (ambulanceId) {
      await Ambulance.findByIdAndUpdate(ambulanceId, { status: 'available' });
    }

    const driver = await Driver.findOne({ user: req.user._id });
    if (driver) {
      driver.status = 'available';
      await driver.save();
    }

    // Sockets notify hospital (addressed by its User account id — see note above)
    sendRealtimeNotification(request.hospital?.user, {
      title: 'Driver Declined Assignment',
      message: `Driver declined ride for Emergency #${request._id}. Please re-assign an ambulance.`,
      type: 'alert',
    });
    emitToEmergencyRoom(request._id, 'ride_status_updated', {
      status: 'pending',
    });

    res.status(200).json({
      status: 'success',
      message: 'Ride request rejected. Request sent back to queue.',
      data: request,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting ride.', error: error.message });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const driverLat = parseFloat(lat);
    const driverLng = parseFloat(lng);

    if (isNaN(driverLat) || isNaN(driverLng)) {
      return res.status(400).json({ message: 'Invalid coordinates.' });
    }

    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) {
      return res.status(404).json({ message: 'Driver profile not found.' });
    }

    // Update coordinates in Driver and associated Ambulance
    driver.currentLatitude = driverLat;
    driver.currentLongitude = driverLng;
    await driver.save();

    if (driver.currentAmbulance) {
      await Ambulance.findByIdAndUpdate(driver.currentAmbulance, {
        currentLatitude: driverLat,
        currentLongitude: driverLng,
        // findByIdAndUpdate bypasses Mongoose's pre('save') hooks, so the
        // GeoJSON `location` field (used for $near geospatial search) has
        // to be kept in sync explicitly here too — otherwise this
        // ambulance would silently stop showing up in nearby searches
        // every time the driver's live location updates.
        location: { type: 'Point', coordinates: [driverLng, driverLat] },
      });
    }

    // Calculate updated distance & ETA for active request
    const request = await EmergencyRequest.findOne({
      ambulance: driver.currentAmbulance,
      status: { $nin: ['completed', 'rejected'] },
    });

    let currentDistance = null;
    let currentEta = null;

    if (request) {
      // If driver is moving to patient
      if (request.status === 'driver_assigned' || request.status === 'enroute_to_patient') {
        currentDistance = calculateDistance(driverLat, driverLng, request.patientLatitude, request.patientLongitude);
        currentEta = calculateETA(currentDistance);
      } else if (request.status === 'enroute_to_hospital') {
        // If driver is heading to hospital with patient
        const hospital = await Hospital.findById(request.hospital);
        if (hospital) {
          currentDistance = calculateDistance(driverLat, driverLng, hospital.latitude, hospital.longitude);
          currentEta = calculateETA(currentDistance);
        }
      }

      if (currentDistance !== null) {
        request.distance = currentDistance;
        request.eta = currentEta;
        await request.save();
      }
    }

    res.status(200).json({
      status: 'success',
      distance: currentDistance,
      eta: currentEta,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating location.', error: error.message });
  }
};

export const progressRide = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'enroute_to_patient', 'arrived_at_patient', 'enroute_to_hospital'

    const allowedStages = ['enroute_to_patient', 'arrived_at_patient', 'enroute_to_hospital'];
    if (!allowedStages.includes(status)) {
      return res.status(400).json({ message: 'Invalid journey stage.' });
    }

    const request = await EmergencyRequest.findById(id).populate('hospital');
    if (!request) {
      return res.status(404).json({ message: 'Emergency request not found.' });
    }

    request.status = status;
    await request.save();

    // Sockets notifications for stage progression
    let displayStatus = status.replace(/_/g, ' ');
    sendRealtimeNotification(request.patient, {
      title: 'Ambulance Status Updated',
      message: `The ambulance is now: ${displayStatus}.`,
      type: 'emergency',
    });
    // Addressed by the hospital's User account id — see note in acceptRide above.
    sendRealtimeNotification(request.hospital?.user, {
      title: 'Ambulance Status Updated',
      message: `Emergency #${request._id} is now: ${displayStatus}.`,
      type: 'emergency',
    });
    emitToEmergencyRoom(request._id, 'ride_status_updated', {
      status,
    });

    res.status(200).json({ status: 'success', data: request });
  } catch (error) {
    res.status(500).json({ message: 'Error progressing journey.', error: error.message });
  }
};

export const completeRide = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await EmergencyRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Emergency request not found.' });
    }

    // Complete ride request
    request.status = 'completed';
    request.eta = 0;
    request.distance = 0;
    await request.save();

    // Release vehicle and driver back to available
    if (request.ambulance) {
      await Ambulance.findByIdAndUpdate(request.ambulance, { status: 'available' });
      const ambulance = await Ambulance.findById(request.ambulance);
      if (ambulance) {
        await Driver.findOneAndUpdate({ user: ambulance.driver }, { status: 'available' });
      }
    }

    // Increment Hospital Occupancy / Decrement Available Beds
    // We deduct 1 available bed. We check the complaint to see if they need ICU, Oxygen, or General
    const hospital = await Hospital.findById(request.hospital);
    if (hospital) {
      const complaintLower = request.complaint.toLowerCase();
      if (complaintLower.includes('heart') || complaintLower.includes('icu') || complaintLower.includes('stroke') || complaintLower.includes('breathing')) {
        if (hospital.icuBedsAvailable > 0) {
          hospital.icuBedsAvailable -= 1;
        } else if (hospital.availableBeds > 0) {
          hospital.availableBeds -= 1;
        }
      } else if (complaintLower.includes('oxygen') || complaintLower.includes('covid') || complaintLower.includes('asthma')) {
        if (hospital.oxygenBedsAvailable > 0) {
          hospital.oxygenBedsAvailable -= 1;
        } else if (hospital.availableBeds > 0) {
          hospital.availableBeds -= 1;
        }
      } else {
        if (hospital.availableBeds > 0) {
          hospital.availableBeds -= 1;
        }
      }
      await hospital.save();
    }

    // Sockets notify completion
    sendRealtimeNotification(request.patient, {
      title: 'Emergency Completed',
      message: 'You have safely arrived at the hospital. Emergency booking is marked as completed.',
      type: 'system',
    });
    
    // Also notify hospital user account
    if (hospital) {
      sendRealtimeNotification(hospital.user, {
        title: 'Patient Admitted',
        message: `Ambulance arrived. Emergency #${request._id} is completed.`,
        type: 'system',
      });
    }

    emitToEmergencyRoom(request._id, 'ride_status_updated', {
      status: 'completed',
    });

    res.status(200).json({
      status: 'success',
      message: 'Emergency journey completed. Patient safely admitted.',
      data: request,
    });
  } catch (error) {
    console.error('Complete ride error:', error);
    res.status(500).json({ message: 'Error completing ride.', error: error.message });
  }
};

export const getRideHistory = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver || !driver.currentAmbulance) {
      return res.status(200).json({ status: 'success', data: [] });
    }

    const history = await EmergencyRequest.find({
      ambulance: driver.currentAmbulance,
      status: 'completed',
    })
      .populate('hospital', 'name address contact')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving ride history.', error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, licenseNumber } = req.body;

    const user = await User.findById(req.user._id);
    if (name) user.name = name;
    if (phone) user.phone = phone;
    await user.save();

    const driver = await Driver.findOne({ user: req.user._id });
    if (driver) {
      if (licenseNumber) driver.licenseNumber = licenseNumber;
      await driver.save();
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      user,
      profile: driver,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating driver profile.', error: error.message });
  }
};

// First-Responder Acceptance Lock: Driver claims broadcasted EmergencyCase
export const claimEmergencyCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    // The client used to be relied on to echo back the list of driver IDs
    // that were originally broadcast to, but it never actually had that
    // list (the SOS broadcast payload doesn't include it), so this was
    // always empty and the "case claimed by X" pop-up never reached the
    // other nearby drivers. Recompute the nearby candidate list ourselves
    // instead — it's the same query the SOS broadcast used to build it.
    const { candidateDriverUserIds: clientCandidateIds } = req.body;

    const driver = await Driver.findOne({ user: req.user._id }).populate('currentAmbulance');
    if (!driver || !driver.currentAmbulance) {
      return res.status(400).json({ message: 'No active ambulance assigned to your profile.' });
    }

    const emergencyCase = await EmergencyCase.findById(caseId);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found.' });
    }

    // Race-condition lock check: verify case hasn't already been claimed
    if (emergencyCase.ambulance && String(emergencyCase.ambulance) !== String(driver.currentAmbulance._id)) {
      const claimingDriverUser = await User.findById(req.user._id);
      return res.status(409).json({
        status: 'error',
        message: `Case ${emergencyCase.caseNumber} was already accepted by another ambulance responder.`,
      });
    }

    // Claim & assign ambulance
    emergencyCase.ambulance = driver.currentAmbulance._id;
    if (emergencyCase.status === 'created') {
      emergencyCase.status = 'ambulance_dispatched';
    }
    await emergencyCase.save();

    // Mark ambulance as busy (matches the Ambulance schema's status enum —
    // 'dispatched' isn't a valid value there, so writing it silently left
    // the ambulance in a state other code couldn't recognize as busy).
    await Ambulance.findByIdAndUpdate(driver.currentAmbulance._id, { status: 'busy', availability: false });

    // 1. Notify patient & case room that driver has accepted
    emitToEmergencyCaseRoom(emergencyCase._id, 'ambulance_accepted', {
      caseNumber: emergencyCase.caseNumber,
      status: emergencyCase.status,
      ambulance: {
        _id: driver.currentAmbulance._id,
        vehicleNumber: driver.currentAmbulance.vehicleNumber,
        driverContact: driver.phone || driver.currentAmbulance.driverContact,
        driverName: req.user.name,
      },
    });

    // 2. Notify the rest of the nearby candidate drivers that this case was
    // just claimed, so their pop-ups dismiss and show who took it. Prefer
    // whatever the client sent (kept for backwards compatibility); fall
    // back to recomputing "who's nearby" ourselves, since the client
    // realistically never has this list.
    let candidateDriverUserIds = Array.isArray(clientCandidateIds) ? clientCandidateIds : [];
    if (candidateDriverUserIds.length === 0) {
      try {
        const nearby = await findAmbulancesNear(emergencyCase.accidentLatitude, emergencyCase.accidentLongitude);
        const nearbyAmbIds = nearby.ambulances.slice(0, 6).map((a) => a._id);
        const nearbyAmbDocs = await Ambulance.find({ _id: { $in: nearbyAmbIds } }).select('driver');
        candidateDriverUserIds = nearbyAmbDocs.map((a) => String(a.driver)).filter(Boolean);
      } catch (lookupErr) {
        console.error('[claimEmergencyCase] Candidate lookup error:', lookupErr.message);
      }
    }

    if (candidateDriverUserIds.length > 0) {
      notifyDriversCaseClaimed(
        candidateDriverUserIds,
        req.user._id,
        req.user.name,
        driver.currentAmbulance.vehicleNumber,
        emergencyCase.caseNumber
      );
    }

    res.status(200).json({
      status: 'success',
      message: `Successfully accepted dispatch for Emergency #${emergencyCase.caseNumber}.`,
      data: {
        case: emergencyCase,
        ambulance: driver.currentAmbulance,
      },
    });
  } catch (error) {
    console.error('[claimEmergencyCase] Error:', error);
    res.status(500).json({ message: 'Error claiming emergency case.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// DECLINE Emergency Case broadcast
// Driver explicitly declines a broadcast dispatch.
// 1. Adds this ambulance to declinedBy list
// 2. Finds the next best available ambulance (not already declined)
// 3. Notifies the patient's socket room with a new ambulance list
// -----------------------------------------------------------------------
export const declineEmergencyCase = async (req, res) => {
  try {
    const { caseId } = req.params;

    const driver = await Driver.findOne({ user: req.user._id }).populate('currentAmbulance');
    if (!driver || !driver.currentAmbulance) {
      return res.status(400).json({ message: 'No ambulance profile found.' });
    }

    const emergencyCase = await EmergencyCase.findById(caseId);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Case not found.' });
    }

    // Already accepted by someone else — nothing to decline
    if (emergencyCase.ambulance) {
      return res.status(200).json({ status: 'success', message: 'Case already assigned.' });
    }

    // Add this ambulance to declined list (avoid duplicates)
    const ambId = driver.currentAmbulance._id;
    if (!emergencyCase.declinedBy.map(String).includes(String(ambId))) {
      emergencyCase.declinedBy.push(ambId);
      await emergencyCase.save();
    }

    // Find next available ambulances near the accident (excluding declined ones)
    const { findAmbulancesNear } = await import('../utils/geoSearch.js');
    const nearby = await findAmbulancesNear(
      emergencyCase.accidentLatitude,
      emergencyCase.accidentLongitude
    );

    const declinedIds = emergencyCase.declinedBy.map(String);
    const freshAmbulances = nearby.ambulances
      .filter(a => !declinedIds.includes(String(a._id)))
      .slice(0, 6)
      .map(a => ({
        _id: a._id,
        vehicleNumber: a.vehicleNumber,
        distanceKm: a.distanceKm || a.distance,
        eta: a.eta || Math.ceil((a.distanceKm || a.distance || 5) * 3),
        driverContact: a.driverContact,
        ambulanceType: a.ambulanceType || 'BLS',
      }));

    // Notify the patient's case room that this ambulance declined
    const { getIO } = await import('../sockets/socketManager.js');
    const ioInstance = getIO();
    if (ioInstance) {
      ioInstance.to(`case_${caseId}`).emit('ambulance_declined', {
        declinedVehicle: driver.currentAmbulance.vehicleNumber,
        message: `Ambulance ${driver.currentAmbulance.vehicleNumber} is unavailable. Please select another ambulance.`,
        availableAmbulances: freshAmbulances,
        caseId,
      });
    }

    // Re-broadcast to ALL remaining nearby candidate drivers (not just the
    // single closest one) so the "first to accept wins" cascade actually
    // reaches everyone who could respond — repeats every time a driver
    // declines, same as the very first SOS broadcast.
    if (freshAmbulances.length > 0) {
      const freshAmbIds = freshAmbulances.map((a) => a._id);
      // Ambulance.driver already stores the User _id directly (see
      // models/Ambulance.js) — no need to populate/re-resolve it.
      const freshAmbDocs = await Ambulance.find({ _id: { $in: freshAmbIds } }).select('driver');
      const nextDriverUserIds = freshAmbDocs.map((a) => String(a.driver)).filter(Boolean);

      broadcastEmergencyToDrivers(nextDriverUserIds, {
        caseId: emergencyCase._id,
        caseNumber: emergencyCase.caseNumber,
        accidentLatitude: emergencyCase.accidentLatitude,
        accidentLongitude: emergencyCase.accidentLongitude,
        accidentAddress: emergencyCase.accidentAddress,
        patientCondition: emergencyCase.patientCondition,
        triageCategory: emergencyCase.triageCategory,
        triageScore: emergencyCase.triageScore,
        createdAt: emergencyCase.createdAt,
        reason: 'reassigned',
        message: `Ambulance ${driver.currentAmbulance.vehicleNumber} is busy — please respond immediately if you can reach this location.`,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Case declined. Patient has been notified.',
      availableAmbulances: freshAmbulances,
    });
  } catch (error) {
    console.error('[declineEmergencyCase] Error:', error);
    res.status(500).json({ message: 'Error declining case.', error: error.message });
  }
};

