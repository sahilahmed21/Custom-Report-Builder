// backend/src/routes/gsc.js
import express from 'express';
import { getProperties, getReport } from '../controllers/gscController.js';
// import { authMiddleware } from '../middleware/authMiddleware.js'; // Add later if needed for route protection

const router = express.Router();

// Route to get the list of GSC properties for the authenticated user
// Might add authMiddleware here later
router.get('/properties', getProperties);

// Route to fetch report data (for Step 6)
// Might add authMiddleware here later
router.post('/report', getReport);


export default router;