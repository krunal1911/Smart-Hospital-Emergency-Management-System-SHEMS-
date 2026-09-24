import express from 'express';
import {
  createEmergencyCase,
  getMyActiveCase,
  searchNearbyHospitalsForCase,
  selectHospitalForCase,
  notifyHospitalOfCase,
  updateCaseLocation,
  progressCaseStatus,
  addCaseUpdate,
  getIncomingCasesForHospital,
  acknowledgeCaseNotification,
  beginTreatment,
  identifyPatient,
  markPatientUnknown,
  convertCaseToPatient,
  getCaseById,
  listHospitalCases,
  listDriverCaseHistory,
  listAllCasesForAdmin,
} from '../controllers/emergencyCaseController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { uploadAccidentPhotos } from '../middleware/upload.js';

const router = express.Router();

// Every route requires an authenticated staff account (driver, hospital, or
// admin). At no point does any route in this file require or accept a
// patient login — that is enforced by never restricting to the 'patient'
// role anywhere below.
router.use(protect);

// --- Ambulance staff (driver role): scene-to-hospital workflow ---
router.post('/', restrictTo('driver'), uploadAccidentPhotos.array('photos', 5), createEmergencyCase);
router.get('/active/mine', restrictTo('driver'), getMyActiveCase);
router.get('/history/mine', restrictTo('driver'), listDriverCaseHistory);
router.get('/:id/nearby-hospitals', restrictTo('driver'), searchNearbyHospitalsForCase);
router.put('/:id/select-hospital', restrictTo('driver'), selectHospitalForCase);
router.post('/:id/notify-hospital', restrictTo('driver'), notifyHospitalOfCase);
router.put('/:id/location', restrictTo('driver'), updateCaseLocation);
router.put('/:id/progress', restrictTo('driver'), progressCaseStatus);

// --- Hospital staff: preparation, treatment, identification, conversion ---
router.get('/hospital/incoming', restrictTo('hospital'), getIncomingCasesForHospital);
router.get('/hospital/all', restrictTo('hospital'), listHospitalCases);
router.put('/:id/acknowledge', restrictTo('hospital'), acknowledgeCaseNotification);
router.put('/:id/begin-treatment', restrictTo('hospital'), beginTreatment);
router.put('/:id/identify', restrictTo('hospital'), identifyPatient);
router.put('/:id/mark-unknown', restrictTo('hospital'), markPatientUnknown);
router.post('/:id/convert-to-patient', restrictTo('hospital'), convertCaseToPatient);

// --- Shared: add a timeline note (driver or hospital) ---
router.post('/:id/updates', restrictTo('driver', 'hospital', 'admin'), addCaseUpdate);

// --- Admin: system-wide visibility ---
router.get('/admin/all', restrictTo('admin'), listAllCasesForAdmin);

// --- Shared: full case detail (driver, hospital, admin) — kept last so it
// doesn't shadow the more specific string routes above ---
router.get('/:id', restrictTo('driver', 'hospital', 'admin'), getCaseById);

export default router;
