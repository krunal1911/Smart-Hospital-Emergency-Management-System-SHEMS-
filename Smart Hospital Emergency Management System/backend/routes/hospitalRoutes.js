import express from 'express';
import {
  getStats,
  updateBeds,
  getRequests,
  acceptRequest,
  rejectRequest,
  getAmbulances,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance,
  getDrivers,
  getUnassignedDrivers,
  getPatientRecords,
  updateProfile
} from '../controllers/hospitalController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('hospital'));

router.get('/stats', getStats);
router.put('/beds', updateBeds);
router.get('/requests', getRequests);
router.post('/requests/:id/accept', acceptRequest);
router.post('/requests/:id/reject', rejectRequest);

// Ambulance Management
router.get('/ambulances', getAmbulances);
router.post('/ambulances', createAmbulance);
router.put('/ambulances/:id', updateAmbulance);
router.delete('/ambulances/:id', deleteAmbulance);

// Driver Management
router.get('/drivers', getDrivers);
router.get('/drivers/unassigned', getUnassignedDrivers);

// Patients & Records
router.get('/patient-records', getPatientRecords);
router.put('/profile', updateProfile);

export default router;
