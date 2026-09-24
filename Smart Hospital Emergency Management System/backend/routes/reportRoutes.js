import express from 'express';
import { exportPDFReport, exportExcelReport } from '../controllers/reportController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('hospital', 'admin'));

router.get('/export/pdf', exportPDFReport);
router.get('/export/excel', exportExcelReport);

export default router;
