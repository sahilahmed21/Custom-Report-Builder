// backend/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
// import listEndpoints from 'express-list-endpoints'; // Uncomment if needed for debugging routes

// Import your routes
import authRoutes from './src/routes/auth.js';
import gscRoutes from './src/routes/gsc.js';
import geminiRoutes from './src/routes/gemini.js';

// Load .env file values into process.env VERY EARLY
dotenv.config();

const app = express();

// Define the port, prioritizing the host environment's variable (like Render's)
const port = process.env.PORT || 5000;

// --- CORS Configuration ---
// Define allowed origins
const allowedOrigins = [
    process.env.FRONTEND_URL,    // Read from environment variable (e.g., https://your-app.vercel.app)
    'http://localhost:3000'     // Allow your local frontend development server
];

// Ensure FRONTEND_URL is loaded correctly
const frontendUrl = process.env.FRONTEND_URL;
console.log(`CORS Config: Allowing origin = ${frontendUrl}`); // Log the URL being used

if (!frontendUrl) {
    console.warn("WARNING: FRONTEND_URL environment variable not set. CORS might block deployed frontend.");
}

const corsOptions = {
    // Directly use the environment variable.
    // If it's missing, CORS might fail for the deployed app,
    // but localhost might still work if the browser doesn't enforce CORS for it.
    origin: frontendUrl,
    credentials: true
};

// Apply CORS middleware *BEFORE* any routes
app.use(cors(corsOptions));
// --- End CORS Configuration ---

// --- Other Middleware ---
// Apply body parsing middleware AFTER CORS
app.use(express.json({ limit: '10mb' })); // Support JSON bodies
app.use(express.urlencoded({ limit: '10mb', extended: true })); // Support URL-encoded bodies

// --- API Routes ---
// Apply your API routes AFTER middleware
app.use('/auth', authRoutes);
app.use('/gsc', gscRoutes);
app.use('/gemini', geminiRoutes);

// --- Basic Root Route (for health check/info) ---
app.get('/', (req, res) => {
    res.send('Custom Report Builder Backend is running!');
});

// --- Global Error Handling Middleware (Keep this LAST) ---
app.use((err, req, res, next) => {
    console.error("Global Error Handler Caught:", err.stack || err); // Log the full error stack

    // Handle specific known errors if needed
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request payload is too large.' });
    }
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Access denied by CORS policy.' });
    }

    // Avoid sending response if headers already sent
    if (res.headersSent) {
        return next(err);
    }

    // Generic error response
    res.status(err.status || 500).json({
        error: 'An unexpected server error occurred.',
        // Conditionally include error message in development for easier debugging
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// --- Server Start ---
app.listen(port, () => {
    // Use the 'port' variable defined earlier
    console.log(`Backend server listening on port ${port}`);

    // Uncomment to log registered routes on startup if needed
    // try {
    //     console.log('Registered Routes:');
    //     console.log(listEndpoints(app));
    // } catch (e) {
    //     console.warn("Could not list endpoints (ensure express-list-endpoints is installed if needed).");
    // }
});