import { google } from 'googleapis';
import dotenv from 'dotenv';
import { storeTokens, getTokens, clearTokens } from '../utils/cache.js';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.REDIRECT_URI
);

// Define the required scopes
const scopes = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
];

// --- Login Handler ---
export const login = (req, res) => {
    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true,
        prompt: 'consent',
    });
    res.redirect(authorizationUrl);
};

// --- OAuth Callback Handler ---
export const oauthCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Authorization code missing.');
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        await storeTokens(tokens);
        console.log('Tokens obtained and stored:', tokens);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}?auth_status=success`);
    } catch (error) {
        console.error('Error exchanging code for tokens:', error.message);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(
            `${frontendUrl}?auth_status=error&message=${encodeURIComponent(error.message)}`
        );
    }
};

// backend/src/controllers/authController.js
export const checkAuthStatus = async (req, res) => {
    console.log("Backend: /auth/status endpoint hit"); // Add this
    try {
        const tokens = await getTokens();
        console.log("Backend: /auth/status - Received tokens:", tokens); // Add this

        if (tokens && tokens.access_token) {
            console.log("Backend: /auth/status - Sending isAuthenticated: true"); // Add this
            res.status(200).json({ isAuthenticated: true });
        } else {
            console.log("Backend: /auth/status - Sending isAuthenticated: false"); // Add this
            res.status(200).json({ isAuthenticated: false });
        }
    } catch (error) {
        // Log the specific error that occurred HERE
        console.error('Backend: CRITICAL ERROR in checkAuthStatus:', error); // Add this
        res.status(500).json({ // Ensure JSON is sent even on error
            isAuthenticated: false,
            error: 'Internal server error checking auth status',
            details: error.message // Optionally include details (careful with sensitive info)
        });
    }
};

// --- Logout Handler ---
export const logout = async (req, res) => {
    try {
        await clearTokens();
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: 'Internal server error during logout' });
    }
};

// --- Refresh Token Logic ---
export const getRefreshedClient = async () => {
    console.log('getRefreshedClient: Attempting to get tokens...');
    const tokens = await getTokens();
    if (!tokens) {
        console.error('getRefreshedClient: No tokens returned from getTokens.');
        throw new Error('No tokens found. Please authenticate.');
    }
    console.log('getRefreshedClient: Received tokens:', tokens);

    if (!tokens.access_token) {
        console.error('getRefreshedClient: Received tokens object is missing access_token.');
        throw new Error('Invalid token object received. Missing access_token.');
    }

    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.REDIRECT_URI
    );
    client.setCredentials(tokens);
    console.log('getRefreshedClient: Credentials set on client.');

    const bufferSeconds = 60;
    const expiryDate = tokens.expiry_date;
    const needsRefresh = expiryDate
        ? expiryDate <= Date.now() + bufferSeconds * 1000
        : true;

    console.log(
        `getRefreshedClient: Checking token expiry. Expiry Date: ${expiryDate}, Current Time: ${Date.now()}, Needs Refresh: ${needsRefresh}`
    );

    if (needsRefresh) {
        if (tokens.refresh_token) {
            console.log('getRefreshedClient: Access token needs refresh, attempting refresh...');
            try {
                client.setCredentials({ refresh_token: tokens.refresh_token });
                const { credentials } = await client.refreshAccessToken();
                console.log('getRefreshedClient: Tokens refreshed successfully.');
                const newTokens = { ...tokens, ...credentials };
                if (credentials.expiry_date) {
                    newTokens.expiry_date = credentials.expiry_date;
                } else if (credentials.expires_in) {
                    newTokens.expiry_date = Date.now() + credentials.expires_in * 1000;
                }
                await storeTokens(newTokens);
                client.setCredentials(newTokens);
                console.log('getRefreshedClient: Client credentials updated with refreshed tokens.');
            } catch (refreshError) {
                console.error('getRefreshedClient: Error refreshing access token:', refreshError.message);
                await clearTokens();
                throw new Error('Failed to refresh token. Please re-authenticate.');
            }
        } else {
            console.error('getRefreshedClient: Token needs refresh, but no refresh_token is available.');
            await clearTokens();
            throw new Error('Access token expired and no refresh token available. Please re-authenticate.');
        }
    } else {
        console.log('getRefreshedClient: Token is still valid.');
    }

    return client;
};