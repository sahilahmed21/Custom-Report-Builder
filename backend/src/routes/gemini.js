// backend/src/routes/gemini.js
import express from 'express';
import {
    analyzeTopNHybrid,
    getBackgroundJobProgress,
    getAnalysisResultsBatch
} from '../controllers/geminiController.js';

const router = express.Router();

// POST endpoint to start hybrid analysis (immediate + background)
// Receives { topNQueries: string[] }
// Returns { jobId, initialResults: { ... } } with status 202
router.post('/analyze-top-n-hybrid', analyzeTopNHybrid);

// GET endpoint to poll for background job progress
// Uses job ID from URL parameter
// Returns { progress: { total, completed, status, error? } }
router.get('/job-progress/:jobId', getBackgroundJobProgress);

// POST endpoint to fetch available results from cache (for polling)
// Receives { queries: string[] }
// Returns { query1: { intent, category }, ... }
router.post('/get-analysis-batch', getAnalysisResultsBatch);

// Remove old synchronous batch route if present
// router.post('/analyze-batch', analyzeBatchSynchronous);

export default router;