// backend/src/routes/gemini.js
import express from 'express';
import { analyzeIntents } from '../controllers/geminiController.js';
// import { authMiddleware } from '../middleware/authMiddleware.js'; // Consider adding auth later if needed

const router = express.Router();

// Route to analyze intents for a list of queries
// POST because we are sending a body and potentially modifying cache state
// Might add authMiddleware later to ensure only logged-in users can use it
router.post('/analyze', analyzeIntents);

export default router;