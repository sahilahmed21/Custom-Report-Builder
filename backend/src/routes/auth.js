// backend/src/routes/auth.js
import express from 'express';
import { login, oauthCallback, checkAuthStatus, logout } from '../controllers/authController.js';

const router = express.Router();

// Redirects user to Google's consent screen
router.get('/login', login);

// Handles the callback from Google after user consent
router.get('/callback', oauthCallback);

// Endpoint for frontend to check if user is authenticated (tokens exist)
router.get('/status', checkAuthStatus);

// Endpoint to clear stored tokens (logout)
router.post('/logout', logout);


export default router;