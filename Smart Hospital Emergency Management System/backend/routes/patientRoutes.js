import express from 'express';
import { searchHospitals, getHospitalDetails, createBooking, getActiveBooking, getBookingHistory, updateProfile } from '../controllers/patientController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('patient'));

router.get('/hospitals/nearby', searchHospitals);
router.get('/hospitals/:id', getHospitalDetails);
router.post('/emergency/book', createBooking);
router.get('/emergency/active', getActiveBooking);
router.get('/emergency/history', getBookingHistory);
router.put('/profile', updateProfile);

export default router;
