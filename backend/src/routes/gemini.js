// backend/src/routes/gemini.js
import express from 'express';
import {
    analyzeIntentsProgressive, // Renamed/New trigger
    getAnalysisJobStatus,      // New status endpoint
    getAnalysisResultsBatch    // New results endpoint
} from '../controllers/geminiController.js';

const router = express.Router();

// Route to START the progressive analysis and get a Job ID
router.post('/analyze-progressive', analyzeIntentsProgressive);

// Route to get the status (progress) of an analysis job
router.get('/job-status/:jobId', getAnalysisJobStatus);

// Route to get the actual analysis results for a batch of queries (checks cache)
router.post('/get-analysis-batch', getAnalysisResultsBatch);

export default router;