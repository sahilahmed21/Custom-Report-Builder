// backend/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './src/routes/auth.js';
import gscRoutes from './src/routes/gsc.js';
import geminiRoutes from './src/routes/gemini.js'; // Ensure this uses the updated routes file
import listEndpoints from 'express-list-endpoints'; // Import the library

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// --- Middleware ORDER MATTERS ---

// 1. CORS (Allow requests from frontend)
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// 2. Body Parsers (with increased limit)
app.use(express.json({ limit: '10mb' })); // Ensure this is high enough
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- Routes ---
app.use('/auth', authRoutes);
app.use('/gsc', gscRoutes);
app.use('/gemini', geminiRoutes); // Mount the updated Gemini routes

// Basic root route
app.get('/', (req, res) => {
    res.send('Custom Report Builder Backend is running!');
});

// --- Error Handling Middleware (Keep at the end) ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err); // Log stack trace
    if (err.type === 'entity.too.k large') {
        res.status(413).json({ error: 'Request payload is too large.' });
    } else if (res.headersSent) {
        return next(err);
    } else {
        res.status(err.status || 500).json({ // <-- Sends JSON on error now
            error: 'An unexpected server error occurred.',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});
// --- Server Start & Route Logging ---
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
    console.log('Registered Routes:');
    // Log all registered endpoints
    console.log(listEndpoints(app));
});

