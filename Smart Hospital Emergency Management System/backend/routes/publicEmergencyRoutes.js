import express from 'express';
import { emergencyRateLimiter } from '../middleware/rateLimiter.js';
import {
  sosCreateCase,
  listNearbyAmbulances,
  requestAmbulance,
  listNearbyHospitals,
  selectAndNotifyHospital,
  getPublicCaseStatus,
  searchByPincode,
} from '../controllers/publicEmergencyController.js';

const router = express.Router();

// Apply rate limiter middleware to protect public endpoints
router.use(emergencyRateLimiter({ windowMs: 60 * 1000, max: 40 }));

router.get('/search-by-pincode', searchByPincode);
router.post('/sos', sosCreateCase);
router.get('/:caseNumber/ambulances', listNearbyAmbulances);
router.post('/:caseNumber/request-ambulance', requestAmbulance);
router.get('/:caseNumber/hospitals', listNearbyHospitals);
router.post('/:caseNumber/select-hospital', selectAndNotifyHospital);
router.get('/:caseNumber/status', getPublicCaseStatus);

export default router;
