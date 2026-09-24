import EmergencyCase from '../models/EmergencyCase.js';
import EmergencyCaseUpdate from '../models/EmergencyCaseUpdate.js';
import AmbulanceTrackingLog from '../models/AmbulanceTrackingLog.js';
import HospitalNotification from '../models/HospitalNotification.js';
import Hospital from '../models/Hospital.js';
import Ambulance from '../models/Ambulance.js';
import Driver from '../models/Driver.js';
import Patient from '../models/Patient.js';
import { calculateDistance, calculateETA } from '../utils/distance.js';
import { generateCaseNumber } from '../utils/caseId.js';
import { findDbHospitalsNear } from '../utils/geoSearch.js';
import {
  emitToHospital,
  emitToEmergencyCaseRoom,
  sendRealtimeNotification,
} from '../sockets/socketManager.js';

// Helper: resolve the Ambulance + Driver profile tied to the logged-in driver user
const resolveAmbulanceForDriver = async (userId) => {
  const driver = await Driver.findOne({ user: userId });
  if (!driver || !driver.currentAmbulance) return { driver: null, ambulance: null };
  const ambulance = await Ambulance.findById(driver.currentAmbulance);
  return { driver, ambulance };
};

// -----------------------------------------------------------------------
// 1. AMBULANCE STAFF: Create Emergency Case at the accident scene
//    No patient login/registration is involved anywhere in this call.
// -----------------------------------------------------------------------
export const createEmergencyCase = async (req, res) => {
  try {
    const { lat, lng, accidentAddress, accidentTime, patientCondition, conditionNotes, ambulanceStaffNotes } = req.body;

    const accidentLat = parseFloat(lat);
    const accidentLng = parseFloat(lng);

    if (isNaN(accidentLat) || isNaN(accidentLng)) {
      return res.status(400).json({ message: 'GPS location (lat, lng) is required to open an emergency case.' });
    }
    if (!patientCondition) {
      return res.status(400).json({ message: 'Patient condition is required.' });
    }

    const { ambulance } = await resolveAmbulanceForDriver(req.user._id);
    if (!ambulance) {
      return res.status(400).json({ message: 'No ambulance is currently assigned to your account.' });
    }

    // Accident photos (optional) uploaded via multer -> req.files
    const photoUrls = (req.files || []).map((f) => `/uploads/emergency-cases/${f.filename}`);

    // Guarantee a unique, human-readable temporary case ID
    let caseNumber = generateCaseNumber();
    // Extremely unlikely, but re-roll on collision
    while (await EmergencyCase.findOne({ caseNumber })) {
      caseNumber = generateCaseNumber();
    }

    const emergencyCase = await EmergencyCase.create({
      caseNumber,
      createdBy: req.user._id,
      ambulance: ambulance._id,
      accidentLatitude: accidentLat,
      accidentLongitude: accidentLng,
      accidentAddress: accidentAddress || '',
      accidentTime: accidentTime ? new Date(accidentTime) : new Date(),
      patientCondition,
      conditionNotes: conditionNotes || '',
      ambulanceStaffNotes: ambulanceStaffNotes || '',
      photos: photoUrls,
      status: 'created',
    });

    // Keep the ambulance's live position anchored to the scene immediately
    ambulance.currentLatitude = accidentLat;
    ambulance.currentLongitude = accidentLng;
    ambulance.status = 'busy';
    ambulance.availability = false;
    await ambulance.save();

    await AmbulanceTrackingLog.create({
      emergencyCase: emergencyCase._id,
      ambulance: ambulance._id,
      latitude: accidentLat,
      longitude: accidentLng,
    });

    res.status(201).json({
      status: 'success',
      message: 'Emergency case created. Search for a nearby hospital next.',
      data: emergencyCase,
    });
  } catch (error) {
    console.error('Error creating emergency case:', error);
    res.status(500).json({ message: 'Error creating emergency case.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 2. AMBULANCE STAFF: Get their currently open (unconverted/unclosed) case
// -----------------------------------------------------------------------
export const getMyActiveCase = async (req, res) => {
  try {
    const { ambulance } = await resolveAmbulanceForDriver(req.user._id);
    if (!ambulance) {
      return res.status(200).json({ status: 'success', data: null });
    }

    const activeCase = await EmergencyCase.findOne({
      ambulance: ambulance._id,
      status: { $nin: ['converted', 'closed'] },
    })
      .populate('hospital')
      .sort({ createdAt: -1 });

    res.status(200).json({ status: 'success', data: activeCase });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving active case.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 3. AMBULANCE STAFF: Nearby hospital search with ICU / trauma / ETA info
// -----------------------------------------------------------------------
export const searchNearbyHospitalsForCase = async (req, res) => {
  try {
    const { id } = req.params;
    const emergencyCase = await EmergencyCase.findById(id);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found.' });
    }

    // Geospatial search, expanding radius (5 -> 10 -> 20 -> 50 km) until
    // results are found — see utils/geoSearch.js. Database-only (not
    // merged with OpenStreetMap) because this list feeds
    // selectHospitalForCase below, which needs a real Hospital document
    // with bed data and a hospital account behind it — an external
    // OpenStreetMap listing can't be assigned a case.
    const { hospitals, radiusKm, exhausted } = await findDbHospitalsNear(
      emergencyCase.accidentLatitude,
      emergencyCase.accidentLongitude
    );

    let hospitalList = hospitals.map((h) => {
      const dist = calculateDistance(
        emergencyCase.accidentLatitude,
        emergencyCase.accidentLongitude,
        h.latitude,
        h.longitude
      );
      const eta = calculateETA(dist);
      return {
        _id: h._id,
        name: h.name,
        address: h.address,
        contact: h.contact,
        emergencyContact: h.emergencyContact,
        distance: dist,
        eta,
        generalBedsAvailable: h.availableBeds,
        icuBedsAvailable: h.icuBedsAvailable,
        icuBedsTotal: h.icuBedsTotal,
        oxygenBedsAvailable: h.oxygenBedsAvailable,
        emergencyBedsAvailable: h.emergencyBedsAvailable,
        emergencyBedsTotal: h.emergencyBedsTotal,
        hasTraumaCenter: h.hasTraumaCenter,
        doctorsAvailable: h.doctorsAvailable,
        rating: h.rating,
        latitude: h.latitude,
        longitude: h.longitude,
      };
    });

    hospitalList.sort((a, b) => a.distance - b.distance);

    res.status(200).json({
      status: 'success',
      results: hospitalList.length,
      searchRadiusKm: radiusKm,
      message: exhausted ? 'No hospitals found within 50 km of this location.' : undefined,
      data: hospitalList,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching nearby hospitals.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 4. AMBULANCE STAFF: Select the hospital for this case
// -----------------------------------------------------------------------
export const selectHospitalForCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { hospitalId } = req.body;

    const emergencyCase = await EmergencyCase.findById(id);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found.' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found.' });
    }

    const ambulance = await Ambulance.findById(emergencyCase.ambulance);

    const dist = calculateDistance(
      ambulance.currentLatitude,
      ambulance.currentLongitude,
      hospital.latitude,
      hospital.longitude
    );
    const eta = calculateETA(dist);

    emergencyCase.hospital = hospital._id;
    emergencyCase.distance = dist;
    emergencyCase.eta = eta;
    emergencyCase.status = 'hospital_selected';
    await emergencyCase.save();

    res.status(200).json({
      status: 'success',
      message: 'Hospital selected. Notify the hospital next.',
      data: emergencyCase,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error selecting hospital.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 5. AMBULANCE STAFF: Notify the selected hospital immediately
// -----------------------------------------------------------------------
export const notifyHospitalOfCase = async (req, res) => {
  try {
    const { id } = req.params;
    const emergencyCase = await EmergencyCase.findById(id).populate('hospital');
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found.' });
    }
    if (!emergencyCase.hospital) {
      return res.status(400).json({ message: 'Select a hospital before notifying.' });
    }

    const ambulance = await Ambulance.findById(emergencyCase.ambulance);

    const hospitalNotification = await HospitalNotification.create({
      hospital: emergencyCase.hospital._id,
      emergencyCase: emergencyCase._id,
      patientCondition: emergencyCase.patientCondition,
      eta: emergencyCase.eta,
      distance: emergencyCase.distance,
      ambulanceLatitude: ambulance.currentLatitude,
      ambulanceLongitude: ambulance.currentLongitude,
    });

    emergencyCase.status = 'hospital_notified';
    await emergencyCase.save();

    // Real-time push to the hospital's dashboard so doctors can prepare
    emitToHospital(emergencyCase.hospital._id, 'new_emergency_case', {
      caseId: emergencyCase._id,
      caseNumber: emergencyCase.caseNumber,
      patientCondition: emergencyCase.patientCondition,
      eta: emergencyCase.eta,
      distance: emergencyCase.distance,
      ambulanceLocation: {
        lat: ambulance.currentLatitude,
        lng: ambulance.currentLongitude,
      },
      accidentTime: emergencyCase.accidentTime,
      notificationId: hospitalNotification._id,
    });

    // Also drop a generic notification into the hospital account's bell feed
    sendRealtimeNotification(emergencyCase.hospital.user, {
      title: 'Incoming Emergency Case',
      message: `Case ${emergencyCase.caseNumber}: ${emergencyCase.patientCondition.replace(/_/g, ' ')} patient, ETA ${emergencyCase.eta} min.`,
      type: 'emergency',
    });

    res.status(200).json({
      status: 'success',
      message: 'Hospital notified. Doctors can now prepare for arrival.',
      data: emergencyCase,
    });
  } catch (error) {
    console.error('Error notifying hospital:', error);
    res.status(500).json({ message: 'Error notifying hospital.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 6. AMBULANCE STAFF: Push live GPS updates while en route
// -----------------------------------------------------------------------
export const updateCaseLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    const driverLat = parseFloat(lat);
    const driverLng = parseFloat(lng);
    if (isNaN(driverLat) || isNaN(driverLng)) {
      return res.status(400).json({ message: 'Invalid coordinates.' });
    }

    const emergencyCase = await EmergencyCase.findById(id);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found.' });
    }

    const ambulance = await Ambulance.findById(emergencyCase.ambulance);
    ambulance.currentLatitude = driverLat;
    ambulance.currentLongitude = driverLng;
    await ambulance.save();

    await AmbulanceTrackingLog.create({
      emergencyCase: emergencyCase._id,
      ambulance: ambulance._id,
      latitude: driverLat,
      longitude: driverLng,
    });

    let currentDistance = emergencyCase.distance;
    let currentEta = emergencyCase.eta;

    if (emergencyCase.hospital) {
      const hospital = await Hospital.findById(emergencyCase.hospital);
      if (hospital) {
        currentDistance = calculateDistance(driverLat, driverLng, hospital.latitude, hospital.longitude);
        currentEta = calculateETA(currentDistance);
        emergencyCase.distance = currentDistance;
        emergencyCase.eta = currentEta;
        await emergencyCase.save();
      }
    }

    emitToEmergencyCaseRoom(emergencyCase._id, 'case_location_updated', {
      lat: driverLat,
      lng: driverLng,
      distance: currentDistance,
      eta: currentEta,
      status: emergencyCase.status,
    });

    // Keep the hospital dashboard's live ETA in sync too
    if (emergencyCase.hospital) {
      emitToHospital(emergencyCase.hospital, 'emergency_case_location_updated', {
        caseId: emergencyCase._id,
        lat: driverLat,
        lng: driverLng,
        distance: currentDistance,
        eta: currentEta,
      });
    }

    res.status(200).json({ status: 'success', distance: currentDistance, eta: currentEta });
  } catch (error) {
    res.status(500).json({ message: 'Error updating case location.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 7. AMBULANCE STAFF: Progress the case (enroute_to_hospital / arrived)
// -----------------------------------------------------------------------
export const progressCaseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['enroute_to_hospital', 'arrived_at_hospital'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid case stage.' });
    }

    const emergencyCase = await EmergencyCase.findById(id).populate('hospital');
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found.' });
    }

    emergencyCase.status = status;
    if (status === 'arrived_at_hospital') {
      emergencyCase.arrivedAt = new Date();
    }
    await emergencyCase.save();

    if (emergencyCase.hospital) {
      emitToHospital(emergencyCase.hospital._id, 'emergency_case_status_updated', {
        caseId: emergencyCase._id,
        status,
      });
      sendRealtimeNotification(emergencyCase.hospital.user, {
        title: status === 'arrived_at_hospital' ? 'Ambulance Has Arrived' : 'Ambulance En Route',
        message: `Case ${emergencyCase.caseNumber} is now: ${status.replace(/_/g, ' ')}.`,
        type: 'emergency',
      });
    }

    emitToEmergencyCaseRoom(emergencyCase._id, 'case_status_updated', { status });

    res.status(200).json({ status: 'success', data: emergencyCase });
  } catch (error) {
    res.status(500).json({ message: 'Error updating case status.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 8. Add a free-text update (available to ambulance staff and hospital)
// -----------------------------------------------------------------------
export const addCaseUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, type } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Update message is required.' });
    }

    const emergencyCase = await EmergencyCase.findById(id);
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found.' });
    }

    const update = await EmergencyCaseUpdate.create({
      emergencyCase: emergencyCase._id,
      updatedBy: req.user._id,
      updatedByRole: req.user.role,
      type: type || 'note',
      message,
    });

    emitToEmergencyCaseRoom(emergencyCase._id, 'case_update_added', update);
    if (emergencyCase.hospital) {
      emitToHospital(emergencyCase.hospital, 'emergency_case_update_added', {
        caseId: emergencyCase._id,
        update,
      });
    }

    res.status(201).json({ status: 'success', data: update });
  } catch (error) {
    res.status(500).json({ message: 'Error adding case update.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 9. HOSPITAL: Incoming cases feed (for pre-arrival preparation)
// -----------------------------------------------------------------------
export const getIncomingCasesForHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    const cases = await EmergencyCase.find({
      hospital: hospital._id,
      status: { $in: ['hospital_selected', 'hospital_notified', 'enroute_to_hospital', 'arrived_at_hospital'] },
    })
      .populate('ambulance')
      .populate('createdBy', 'name phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ status: 'success', data: cases });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching incoming emergency cases.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 10. HOSPITAL: Acknowledge a notification (doctors are now preparing)
// -----------------------------------------------------------------------
export const acknowledgeCaseNotification = async (req, res) => {
  try {
    const { id } = req.params; // EmergencyCase id
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    const notification = await HospitalNotification.findOneAndUpdate(
      { emergencyCase: id, hospital: hospital._id },
      { acknowledged: true, acknowledgedBy: req.user._id, acknowledgedAt: new Date() },
      { new: true, sort: { createdAt: -1 } }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found for this case.' });
    }

    res.status(200).json({ status: 'success', data: notification });
  } catch (error) {
    res.status(500).json({ message: 'Error acknowledging notification.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 11. HOSPITAL: Begin treatment immediately — NEVER gated by login,
//     registration, identity, or payment.
// -----------------------------------------------------------------------
export const beginTreatment = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    const emergencyCase = await EmergencyCase.findOne({ _id: id, hospital: hospital._id });
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found for this hospital.' });
    }

    emergencyCase.status = 'in_treatment';
    emergencyCase.treatmentStartedAt = new Date();
    await emergencyCase.save();

    await EmergencyCaseUpdate.create({
      emergencyCase: emergencyCase._id,
      updatedBy: req.user._id,
      updatedByRole: 'hospital',
      type: 'status',
      message: 'Emergency treatment started. Patient identification will be collected once stable.',
    });

    emitToEmergencyCaseRoom(emergencyCase._id, 'case_status_updated', { status: 'in_treatment' });

    res.status(200).json({
      status: 'success',
      message: 'Treatment started. No registration, identity, or payment was required.',
      data: emergencyCase,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error starting treatment.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 12. HOSPITAL: Record patient identification once stable (optional)
// -----------------------------------------------------------------------
export const identifyPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      patientName,
      patientPhone,
      approxAge,
      gender,
      bloodGroup,
      address,
      identifiedByName,
      identifiedByPhone,
      identifiedByRelation,
    } = req.body;

    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    const emergencyCase = await EmergencyCase.findOne({ _id: id, hospital: hospital._id });
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found for this hospital.' });
    }

    emergencyCase.identification = {
      ...emergencyCase.identification.toObject(),
      isIdentified: true,
      markedUnknown: false,
      patientName: patientName || '',
      patientPhone: patientPhone || '',
      approxAge: approxAge !== undefined ? approxAge : null,
      gender: gender || '',
      bloodGroup: bloodGroup || '',
      address: address || '',
      identifiedByName: identifiedByName || '',
      identifiedByPhone: identifiedByPhone || '',
      identifiedByRelation: identifiedByRelation || '',
      identifiedAt: new Date(),
      recordedBy: req.user._id,
    };
    if (emergencyCase.status !== 'in_treatment') {
      emergencyCase.status = 'identified';
    }
    await emergencyCase.save();

    await EmergencyCaseUpdate.create({
      emergencyCase: emergencyCase._id,
      updatedBy: req.user._id,
      updatedByRole: 'hospital',
      type: 'identification',
      message: `Patient identified as ${patientName || 'Unknown'} (informant: ${identifiedByRelation || 'unspecified'}).`,
    });

    res.status(200).json({ status: 'success', message: 'Identification recorded.', data: emergencyCase });
  } catch (error) {
    res.status(500).json({ message: 'Error recording identification.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 13. HOSPITAL: Explicitly mark the case as an unknown patient
//     (nobody available to identify them)
// -----------------------------------------------------------------------
export const markPatientUnknown = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    const emergencyCase = await EmergencyCase.findOne({ _id: id, hospital: hospital._id });
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found for this hospital.' });
    }

    emergencyCase.identification.markedUnknown = true;
    emergencyCase.identification.isIdentified = false;
    await emergencyCase.save();

    await EmergencyCaseUpdate.create({
      emergencyCase: emergencyCase._id,
      updatedBy: req.user._id,
      updatedByRole: 'hospital',
      type: 'identification',
      message: 'No one was available to identify the patient. Case kept as Unknown Patient.',
    });

    res.status(200).json({ status: 'success', message: 'Case marked as Unknown Patient.', data: emergencyCase });
  } catch (error) {
    res.status(500).json({ message: 'Error marking patient unknown.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 14. HOSPITAL: Convert the temporary case into a permanent Patient record,
//     preserving the full treatment/case history via sourceEmergencyCase.
// -----------------------------------------------------------------------
export const convertCaseToPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    const emergencyCase = await EmergencyCase.findOne({ _id: id, hospital: hospital._id });
    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found for this hospital.' });
    }
    if (emergencyCase.convertedPatient) {
      return res.status(400).json({ message: 'This case has already been converted to a patient record.' });
    }

    const idInfo = emergencyCase.identification;

    const patient = await Patient.create({
      user: null, // Walk-in patient: no login account required or created
      isWalkIn: true,
      sourceEmergencyCase: emergencyCase._id,
      fullName: idInfo?.patientName || 'Unknown Patient',
      gender: idInfo?.gender || 'unknown',
      approxAge: idInfo?.approxAge ?? null,
      bloodGroup: idInfo?.bloodGroup || 'unknown',
      address: idInfo?.address || '',
      phone: idInfo?.patientPhone || '',
      emergencyContactName: idInfo?.identifiedByName || '',
      emergencyContactPhone: idInfo?.identifiedByPhone || '',
      latitude: emergencyCase.accidentLatitude,
      longitude: emergencyCase.accidentLongitude,
    });

    emergencyCase.convertedPatient = patient._id;
    emergencyCase.convertedAt = new Date();
    emergencyCase.convertedBy = req.user._id;
    emergencyCase.status = 'converted';
    await emergencyCase.save();

    await EmergencyCaseUpdate.create({
      emergencyCase: emergencyCase._id,
      updatedBy: req.user._id,
      updatedByRole: 'hospital',
      type: 'status',
      message: `Case converted into permanent patient record (${patient._id}). Full case and treatment history preserved.`,
    });

    res.status(201).json({
      status: 'success',
      message: 'Emergency case converted into a permanent patient record.',
      data: { patient, emergencyCase },
    });
  } catch (error) {
    console.error('Error converting case to patient:', error);
    res.status(500).json({ message: 'Error converting case to patient record.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 15. Shared: Get a single case with its full timeline (driver/hospital/admin)
// -----------------------------------------------------------------------
export const getCaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const emergencyCase = await EmergencyCase.findById(id)
      .populate('hospital')
      .populate('createdBy', 'name phone')
      .populate({ path: 'ambulance', populate: { path: 'driver', select: 'name phone' } })
      .populate('convertedPatient');

    if (!emergencyCase) {
      return res.status(404).json({ message: 'Emergency case not found.' });
    }

    const updates = await EmergencyCaseUpdate.find({ emergencyCase: id })
      .populate('updatedBy', 'name role')
      .sort({ createdAt: 1 });

    const trackingLog = await AmbulanceTrackingLog.find({ emergencyCase: id }).sort({ recordedAt: 1 });

    res.status(200).json({
      status: 'success',
      data: { case: emergencyCase, updates, trackingLog },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching emergency case.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 16. HOSPITAL: Full case history for this hospital
// -----------------------------------------------------------------------
export const listHospitalCases = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    const cases = await EmergencyCase.find({ hospital: hospital._id })
      .populate('createdBy', 'name phone')
      .populate('convertedPatient')
      .sort({ createdAt: -1 });

    res.status(200).json({ status: 'success', data: cases });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching hospital emergency cases.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 17. AMBULANCE STAFF: Case history for this driver's ambulance
// -----------------------------------------------------------------------
export const listDriverCaseHistory = async (req, res) => {
  try {
    const { ambulance } = await resolveAmbulanceForDriver(req.user._id);
    if (!ambulance) {
      return res.status(200).json({ status: 'success', data: [] });
    }

    const cases = await EmergencyCase.find({ ambulance: ambulance._id })
      .populate('hospital', 'name address contact')
      .sort({ createdAt: -1 });

    res.status(200).json({ status: 'success', data: cases });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching case history.', error: error.message });
  }
};

// -----------------------------------------------------------------------
// 18. ADMIN: All emergency cases, system-wide
// -----------------------------------------------------------------------
export const listAllCasesForAdmin = async (req, res) => {
  try {
    const cases = await EmergencyCase.find()
      .populate('hospital', 'name')
      .populate('createdBy', 'name phone')
      .populate('ambulance', 'vehicleNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ status: 'success', data: cases });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all emergency cases.', error: error.message });
  }
};
