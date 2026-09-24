import express from 'express';
import {
  toggleAvailability,
  getActiveRide,
  acceptRide,
  rejectRide,
  updateLocation,
  progressRide,
  completeRide,
  getRideHistory,
  updateProfile,
  claimEmergencyCase,
  declineEmergencyCase,
} from '../controllers/driverController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('driver'));

router.put('/availability', toggleAvailability);
router.get('/active-ride', getActiveRide);
router.post('/ride/:id/accept', acceptRide);
router.post('/ride/:id/reject', rejectRide);
router.post('/claim-case/:caseId', claimEmergencyCase);
router.post('/decline-case/:caseId', declineEmergencyCase);
router.put('/location', updateLocation);
router.put('/ride/:id/step', progressRide);
router.post('/ride/:id/complete', completeRide);
router.get('/history', getRideHistory);
router.put('/profile', updateProfile);

export default router;
