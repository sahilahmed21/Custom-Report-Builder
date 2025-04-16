// backend/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import listEndpoints from 'express-list-endpoints'; // Keep if you added it for debugging
import authRoutes from './src/routes/auth.js';
import gscRoutes from './src/routes/gsc.js';
import geminiRoutes from './src/routes/gemini.js';

dotenv.config(); // Load .env file values into process.env

const app = express();

// *** FIX: Define the port variable correctly ***
// Read the port from the environment variable provided by Render/hosting
// Fallback to 5000 for local development if process.env.PORT is not set
const port = process.env.PORT || 5000;
// *** END FIX ***

// --- Middleware ---
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Read from env
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- Routes ---
app.use('/auth', authRoutes);
app.use('/gsc', gscRoutes);
app.use('/gemini', geminiRoutes);

// Basic root route
app.get('/', (req, res) => {
    res.send('Custom Report Builder Backend is running!');
});

// --- Error Handling Middleware (Keep at the end) ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    if (err.type === 'entity.too.large') {
        res.status(413).json({ error: 'Request payload is too large.' });
    } else if (res.headersSent) {
        return next(err);
    } else {
        res.status(err.status || 500).json({
            error: 'An unexpected server error occurred.',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// --- Server Start ---
// *** FIX: Use the defined lowercase 'port' variable ***
app.listen(port, () => {
    // Log the actual port the server is listening on
    console.log(`Backend server listening on port ${port}`);
    // Log registered routes if you kept that debugging code
    // console.log('Registered Routes:');
    // console.log(listEndpoints(app));
});