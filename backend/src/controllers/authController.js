import { google } from 'googleapis';
import dotenv from 'dotenv';
import { storeTokens, getTokens, clearTokens } from '../utils/cache.js';

dotenv.config();

// Ensure required environment variables are present
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.REDIRECT_URI) {
    console.error("FATAL ERROR: Missing Google OAuth environment variables (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)");
    // Optionally exit process if these are critical for startup
    // process.exit(1);
}

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
    'openid' // Added openid scope, often useful/required
];

// --- Login Handler ---
export const login = (req, res) => {
    console.log("Backend: /auth/login endpoint hit. Generating Auth URL..."); // Log entry
    try {
        const authorizationUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline', // Essential for getting refresh_token
            scope: scopes,
            include_granted_scopes: true,
            prompt: 'consent', // Force consent screen for refresh token
        });
        console.log("Backend: /auth/login - Redirecting to Google Auth URL."); // Log redirect
        res.redirect(authorizationUrl);
    } catch (error) {
        console.error("Backend: /auth/login - Error generating auth URL:", error);
        res.status(500).send("Error initiating login flow.");
    }
};

// --- OAuth Callback Handler ---
export const oauthCallback = async (req, res) => {
    const { code, error: googleError, error_description: googleErrorDesc } = req.query;
    console.log("Backend: /auth/callback endpoint hit."); // Log entry
    console.log("Backend: /auth/callback - Received query params:", req.query); // Log query params

    // Handle errors returned from Google
    if (googleError) {
        console.error(`Backend: /auth/callback - Error received from Google: ${googleError} - ${googleErrorDesc}`);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}?auth_status=error&message=${encodeURIComponent(googleErrorDesc || googleError)}`);
    }

    if (!code || typeof code !== 'string') { // Check type as well
        console.error("Backend: /auth/callback - Authorization code missing or invalid.");
        return res.status(400).send('Authorization code missing or invalid.');
    }

    try {
        console.log("Backend: /auth/callback - Attempting to exchange code for tokens...");
        const { tokens } = await oauth2Client.getToken(code);
        console.log("Backend: /auth/callback - Tokens received from Google:", tokens); // Log raw tokens

        if (!tokens || !tokens.access_token) {
            console.error("Backend: /auth/callback - Invalid tokens received from Google (missing access_token).");
            throw new Error("Failed to obtain valid tokens from Google.");
        }

        console.log("Backend: /auth/callback - Attempting to store tokens...");
        await storeTokens(tokens); // This function now has internal logging
        // Log moved inside storeTokens for more accuracy
        // console.log('Backend: /auth/callback - Tokens obtained and stored:', tokens);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        console.log(`Backend: /auth/callback - Redirecting to frontend: ${frontendUrl}?auth_status=success`);
        res.redirect(`${frontendUrl}?auth_status=success`);

    } catch (error) {
        // Catch errors from getToken or storeTokens
        console.error('Backend: /auth/callback - Error during token exchange or storage:', error.message || error);
        // Check if the error includes specific Google API error details
        if (error.response && error.response.data) {
            console.error('Backend: /auth/callback - Google API Error Data:', error.response.data);
        }
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const errorMessage = error.message || 'Failed to process authentication callback.';
        res.redirect(`${frontendUrl}?auth_status=error&message=${encodeURIComponent(errorMessage)}`);
    }
};

// --- Check Authentication Status Handler ---
export const checkAuthStatus = async (req, res) => {
    console.log("Backend: /auth/status endpoint hit"); // Log entry
    try {
        console.log("Backend: /auth/status - Calling getTokens()..."); // Log before call
        const tokens = await getTokens(); // Calls getTokens (which has internal logging)
        // Log moved inside getTokens for more accuracy
        // console.log("Backend: /auth/status - Received tokens:", tokens);

        if (tokens && tokens.access_token) {
            console.log("Backend: /auth/status - Found valid tokens. Sending isAuthenticated: true");
            res.status(200).json({ isAuthenticated: true });
        } else {
            console.log("Backend: /auth/status - No valid tokens found by getTokens. Sending isAuthenticated: false");
            res.status(200).json({ isAuthenticated: false });
        }
    } catch (error) {
        // This catch is primarily for unexpected errors *within* checkAuthStatus itself,
        // as getTokens() is designed to return null on failure rather than throw.
        console.error('Backend: /auth/status - CRITICAL UNEXPECTED ERROR:', error);
        res.status(500).json({
            isAuthenticated: false,
            error: 'Internal server error checking auth status',
            details: error.message // Careful with sensitive details in production
        });
    }
};

// --- Logout Handler ---
export const logout = async (req, res) => {
    console.log("Backend: /auth/logout endpoint hit"); // Log entry
    try {
        console.log("Backend: /auth/logout - Calling clearTokens()..."); // Log before call
        await clearTokens(); // This function now has internal logging
        console.log("Backend: /auth/logout - clearTokens finished. Sending success response.");
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Backend: /auth/logout - Error during clearTokens:', error);
        res.status(500).json({ error: 'Internal server error during logout' });
    }
};

// --- Get Authenticated Client (with Refresh Logic) ---
export const getRefreshedClient = async () => {
    console.log('getRefreshedClient: Attempting to get tokens...');
    const tokens = await getTokens(); // Uses the updated getTokens with logging

    if (!tokens) {
        // This log is important if subsequent operations fail
        console.error('getRefreshedClient: No tokens returned from getTokens() when trying to create authenticated client.');
        throw new Error('No tokens found. Please authenticate.');
    }
    // Log tokens minimally here for security in production logs
    console.log('getRefreshedClient: Received tokens (structure check). Has access_token:', !!tokens.access_token, 'Has refresh_token:', !!tokens.refresh_token);

    // Validate structure again
    if (!tokens.access_token) {
        console.error('getRefreshedClient: Retrieved tokens object is missing access_token.');
        throw new Error('Invalid token object received. Missing access_token.');
    }

    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.REDIRECT_URI
    );
    try {
        client.setCredentials(tokens);
        console.log('getRefreshedClient: Initial credentials set on client.');
    } catch (setCredsError) {
        console.error('getRefreshedClient: Error setting credentials on OAuth2 client:', setCredsError);
        throw new Error('Failed to initialize Google client with tokens.');
    }


    // Check expiry (ensure expiry_date is a number)
    const bufferSeconds = 60; // Refresh 60 seconds before actual expiry
    const expiryDate = typeof tokens.expiry_date === 'number' ? tokens.expiry_date : 0;
    const needsRefresh = expiryDate ? expiryDate <= (Date.now() + bufferSeconds * 1000) : true; // Refresh if expiry is missing or past

    console.log(
        `getRefreshedClient: Checking token expiry. Expiry Date: ${expiryDate} (${expiryDate ? new Date(expiryDate).toISOString() : 'N/A'}), Current Time: ${Date.now()}, Needs Refresh: ${needsRefresh}`
    );

    if (needsRefresh) {
        if (tokens.refresh_token) {
            console.log('getRefreshedClient: Access token needs refresh, attempting refresh using refresh_token...');
            try {
                // Ensure only refresh token is set for the refresh call
                client.setCredentials({ refresh_token: tokens.refresh_token });
                const { credentials } = await client.refreshAccessToken();
                console.log('getRefreshedClient: Tokens refreshed successfully via API.');

                // Combine old tokens (like refresh_token if not returned) with new ones
                const newTokens = { ...tokens, ...credentials };
                // Recalculate expiry_date if only expires_in is returned
                if (!newTokens.expiry_date && newTokens.expires_in) {
                    newTokens.expiry_date = Date.now() + newTokens.expires_in * 1000;
                    console.log(`getRefreshedClient: Calculated new expiry_date: ${newTokens.expiry_date}`);
                }

                console.log('getRefreshedClient: Attempting to store refreshed tokens...');
                await storeTokens(newTokens); // Store the updated tokens
                client.setCredentials(newTokens); // Set the full new credentials on the client for immediate use
                console.log('getRefreshedClient: Client credentials updated with refreshed tokens.');
                return client; // Return the client with new credentials

            } catch (refreshError) {
                console.error('getRefreshedClient: Error refreshing access token:', refreshError.message || refreshError);
                // Check for specific errors like invalid_grant (refresh token revoked)
                if (refreshError.response && refreshError.response.data) {
                    console.error('getRefreshedClient: Google API Refresh Error Data:', refreshError.response.data);
                    if (refreshError.response.data.error === 'invalid_grant') {
                        console.warn('getRefreshedClient: Refresh token invalid or revoked. Clearing tokens.');
                        await clearTokens();
                        throw new Error('Authentication invalid (refresh token revoked). Please re-authenticate.');
                    }
                }
                // Don't clear tokens for potentially transient refresh errors
                // await clearTokens();
                throw new Error('Failed to refresh token. Please try again later or re-authenticate.');
            }
        } else {
            console.error('getRefreshedClient: Token needs refresh, but no refresh_token is available. Clearing tokens.');
            await clearTokens(); // Clear invalid session
            throw new Error('Access token expired and no refresh token available. Please re-authenticate.');
        }
    } else {
        console.log('getRefreshedClient: Token is still valid.');
        return client; // Return the client with existing, valid credentials
    }
};