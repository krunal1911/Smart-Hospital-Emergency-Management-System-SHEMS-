import express from 'express';
import {
  getStats,
  getHospitals,
  approveHospital,
  getAmbulances,
  getDrivers,
  getPatients,
  getActiveRequests,
  getAuditLogs
} from '../controllers/adminController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router.get('/stats', getStats);
router.get('/hospitals', getHospitals);
router.post('/hospitals/:id/approve', approveHospital);
router.get('/ambulances', getAmbulances);
router.get('/drivers', getDrivers);
router.get('/patients', getPatients);
router.get('/emergencies/live', getActiveRequests);
router.get('/audit-logs', getAuditLogs);

export default router;
