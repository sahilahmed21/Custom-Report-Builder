// backend/server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './src/routes/auth.js';
import gscRoutes from './src/routes/gsc.js'; // Import GSC routes

import geminiRoutes from './src/routes/gemini.js'; // Import Gemini routes

// import geminiRoutes from './src/routes/gemini.js'; // Add later

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ limit: '10mb', extended: true })); // Also increase for URL-encoded if needed

// Routes
app.use('/auth', authRoutes);
app.use('/gsc', gscRoutes); // Use GSC routes

app.use('/gemini', geminiRoutes); // Use Gemini routes


app.get('/', (req, res) => {
    res.send('Custom Report Builder Backend is running!');
});

app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err); // Log the actual error object
    // Check for specific error types
    if (err.type === 'entity.too.large') {
        res.status(413).json({ error: 'Request payload is too large.' }); // Send specific 413 error
    } else {
        // Generic error response
        res.status(err.status || 500).send('Something broke!'); // Keep generic message for others
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});