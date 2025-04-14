// backend/src/routes/gemini.js
import express from 'express';
import {
    analyzeIntentsProgressive, // Renamed function for clarity
    getAnalysisJobStatus,
    getAnalysisResultsBatch
} from '../controllers/geminiController.js';
// Potentially add middleware for authentication/authorization if needed later

const router = express.Router();

// POST endpoint to start the progressive analysis job
// Receives { queryData: [{ query, clicks }] }
// Returns { jobId } with status 202
router.post('/analyze-progressive', analyzeIntentsProgressive);

// GET endpoint to poll for job status
// Uses job ID from URL parameter
// Returns { progress: { total, completed, status, error? } }
router.get('/job-status/:jobId', getAnalysisJobStatus);

// POST endpoint to fetch available results from cache
// Receives { queries: string[] }
// Returns { query1: { intent, category }, query2: { intent, category }, ... }
router.post('/get-analysis-batch', getAnalysisResultsBatch);

export default router;