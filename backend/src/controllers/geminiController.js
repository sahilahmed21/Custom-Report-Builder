// backend/src/controllers/geminiController.js
import { analyzeQueryIntent } from '../services/geminiService.js';
import {
    getGeminiAnalysis, storeGeminiAnalysis,
    initJobStatus, incrementJobProgress, finalizeJobStatus, getJobStatus // Keep needed job functions
    // REMOVED: clearJobData import
} from '../utils/cache.js';
import { sleep } from '../utils/sleep.js';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';

// --- Configuration ---
const IMMEDIATE_BATCH_SIZE = 10; // Number of queries to analyze synchronously first
const GEMINI_CONCURRENCY_LIMIT = 2; // Keep at 1 for simplicity and rate limiting
const THROTTLE_DELAY_MS = 3000; // 5 seconds delay between requests (keeps under 15 RPM)

// --- Background Processing Function (Simulated with setTimeout) ---
const processRemainingInBackground = async (jobId, backgroundQueries) => {
    console.log(`[Job ${jobId}] Starting background processing for ${backgroundQueries.length} queries.`);
    const limit = pLimit(GEMINI_CONCURRENCY_LIMIT); // Still useful for structure
    let hasFailedCritically = false;
    let processedCount = 0;

    // Use a simple loop with delays instead of Promise.all for simulation
    for (const query of backgroundQueries) {
        try {
            await limit(async () => { // Use limit mainly for potential future concurrency > 1
                const logPrefix = `[Job ${jobId} BG ${processedCount + 1}/${backgroundQueries.length}] Query: "${query}" -`;
                // console.log(`${logPrefix} Processing start.`); // Reduce log noise

                if (!query || typeof query !== 'string' || query.trim() === '') {
                    console.warn(`${logPrefix} Skipping invalid/empty query.`);
                } else {
                    let analysis = null;
                    try {
                        analysis = await getGeminiAnalysis(query);
                        if (analysis) {
                            // console.log(`${logPrefix} Cache HIT.`); // Reduce log noise
                            // Result already cached, no need to add again
                        } else {
                            console.log(`${logPrefix} Cache MISS. Calling Gemini...`);
                            analysis = await analyzeQueryIntent(query); // Call the service
                            // console.log(`${logPrefix} Gemini call finished. Result:`, analysis); // Reduce log noise

                            if (analysis && analysis.intent && analysis.category && !analysis.error) {
                                console.log(`${logPrefix} Gemini SUCCESS.`);
                                // Store only needed fields { intent, category }
                                const resultToStore = { intent: analysis.intent, category: analysis.category };
                                await storeGeminiAnalysis(query, resultToStore);
                            } else {
                                console.warn(`${logPrefix} Gemini FAILED or invalid result. Result:`, analysis);
                                // Don't cache errors/failures
                            }
                        }
                    } catch (singleQueryError) {
                        console.error(`${logPrefix} INNER CATCH block error:`, singleQueryError);
                        hasFailedCritically = true; // Mark potential issue
                    }
                }
                // Increment progress *after* attempt
                await incrementJobProgress(jobId);
                processedCount++;
                // console.log(`${logPrefix} Throttling...`); // Reduce log noise
                await sleep(THROTTLE_DELAY_MS); // Throttle after each attempt
                // console.log(`${logPrefix} Processing end.`); // Reduce log noise
            });
        } catch (loopError) {
            // Catch errors from p-limit itself if any occur
            console.error(`[Job ${jobId} BG] Error in processing loop for query "${query}":`, loopError);
            hasFailedCritically = true;
            // Still try to increment progress to avoid getting stuck
            try { await incrementJobProgress(jobId); } catch (incErr) { }
            processedCount++;
            await sleep(THROTTLE_DELAY_MS); // Still throttle
        }
    } // End of loop

    console.log(`[Job ${jobId}] Background processing loop finished for ${backgroundQueries.length} queries.`);
    await finalizeJobStatus(jobId, hasFailedCritically ? 'failed' : 'completed');
};


// --- Hybrid Analysis Endpoint ---
export const analyzeTopNHybrid = async (req, res) => {
    console.log("Backend: /analyze-top-n-hybrid endpoint hit.");
    // Expecting { topNQueries: string[] }
    const { topNQueries } = req.body;

    // --- Input Validation ---
    if (!Array.isArray(topNQueries)) {
        return res.status(400).json({ error: "Request body must contain an array 'topNQueries'." });
    }
    const totalQueries = topNQueries.length;
    console.log(`Backend: Received ${totalQueries} Top N queries.`);

    if (totalQueries === 0) {
        return res.status(200).json({ jobId: null, initialResults: {} }); // Nothing to do
    }

    // Split into immediate and background batches
    const immediateQueries = topNQueries.slice(0, IMMEDIATE_BATCH_SIZE);
    const backgroundQueries = topNQueries.slice(IMMEDIATE_BATCH_SIZE);
    const immediateResults = {};
    const jobId = uuidv4(); // Generate Job ID for the background portion

    console.log(`Backend: Processing ${immediateQueries.length} immediate, queueing ${backgroundQueries.length} for background (Job ID: ${jobId}).`);

    // --- 1. Process Immediate Batch Synchronously (but throttled) ---
    const limitImmediate = pLimit(GEMINI_CONCURRENCY_LIMIT); // Concurrency 1
    let immediateCounter = 0;
    try {
        const immediatePromises = immediateQueries.map((query) =>
            limitImmediate(async () => {
                immediateCounter++;
                const logPrefix = `[Immediate ${immediateCounter}/${immediateQueries.length}] Query: "${query}" -`;
                // console.log(`${logPrefix} Processing start.`); // Reduce log noise

                if (!query || typeof query !== 'string' || query.trim() === '') { /* Skip */ }
                else {
                    let analysis = null;
                    try {
                        analysis = await getGeminiAnalysis(query);
                        if (analysis) {
                            // console.log(`${logPrefix} Cache HIT.`); // Reduce log noise
                            immediateResults[query] = analysis;
                        } else {
                            console.log(`${logPrefix} Cache MISS. Calling Gemini...`);
                            analysis = await analyzeQueryIntent(query); // Call the service
                            // console.log(`${logPrefix} Gemini call finished. Result:`, analysis); // Reduce log noise
                            if (analysis && analysis.intent && analysis.category && !analysis.error) {
                                console.log(`${logPrefix} Gemini SUCCESS.`);
                                immediateResults[query] = { intent: analysis.intent, category: analysis.category };
                                await storeGeminiAnalysis(query, immediateResults[query]);
                            } else {
                                console.warn(`${logPrefix} Gemini FAILED or invalid result. Result:`, analysis);
                                immediateResults[query] = { intent: 'Analysis Error', category: 'Error' };
                            }
                        }
                    } catch (e) {
                        console.error(`${logPrefix} INNER CATCH error:`, e);
                        immediateResults[query] = { intent: 'Processing Error', category: 'Error' };
                    }
                }
                // console.log(`${logPrefix} Throttling...`); // Reduce log noise
                await sleep(THROTTLE_DELAY_MS); // Throttle even immediate ones
                // console.log(`${logPrefix} Processing end.`); // Reduce log noise
            })
        );
        await Promise.all(immediatePromises);
        console.log(`Backend: Finished immediate batch processing for ${immediateQueries.length} queries.`);

    } catch (error) {
        console.error("Backend: Error during immediate batch processing:", error);
        // Log error but continue to queue background tasks
    }

    // --- 2. Initialize & Start Background Job (if any) ---
    if (backgroundQueries.length > 0) {
        await initJobStatus(jobId, backgroundQueries.length); // Init with count of BACKGROUND queries
        // Start background processing but DO NOT await it
        processRemainingInBackground(jobId, backgroundQueries)
            .catch(err => {
                console.error(`[Job ${jobId}] processRemainingInBackground promise rejected unexpectedly:`, err);
                // Attempt to mark job as failed if the async function itself errors out early
                finalizeJobStatus(jobId, 'failed', 'Background process failed to start').catch(() => { });
            });
        console.log(`Backend: Background job ${jobId} initiated for ${backgroundQueries.length} queries.`);
    } else {
        console.log("Backend: No background queries to process.");
        // Still create a job entry but mark it completed immediately
        await initJobStatus(jobId, 0); // Init job with 0 total
        await finalizeJobStatus(jobId, 'completed'); // Mark as completed immediately
    }

    // --- 3. Return Immediate Response ---
    console.log(`Backend: Returning immediate results for ${Object.keys(immediateResults).length} queries and Job ID: ${jobId}`);
    // Send 202 Accepted because background processing might still be ongoing (or starting)
    res.status(202).json({ jobId: jobId, initialResults: immediateResults });
};


// --- Endpoint to Get Background Job Progress ---
export const getBackgroundJobProgress = async (req, res) => {
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: "Job ID parameter is required." });
    // console.log(`getBackgroundJobProgress: Request received for job ${jobId}`); // Reduce log noise

    try {
        const status = await getJobStatus(jobId);
        if (!status) {
            // console.log(`getBackgroundJobProgress: Job ${jobId} status not found.`); // Reduce log noise
            return res.status(404).json({ error: "Job not found or expired." });
        }
        // console.log(`getBackgroundJobProgress: Returning status for job ${jobId}:`, status); // Reduce log noise
        res.status(200).json({ progress: status }); // Return progress object
    } catch (error) {
        console.error(`Error fetching status for job ${jobId}:`, error);
        res.status(500).json({ error: "Failed to retrieve job status." });
    }
};


// --- Endpoint to Get Batched Analysis Results (from Cache) ---
// This remains the same as before, used by polling
export const getAnalysisResultsBatch = async (req, res) => {
    const { queries } = req.body;
    if (!Array.isArray(queries)) return res.status(400).json({ error: 'Request body must contain an array "queries".' });
    if (queries.length === 0) return res.status(200).json({});

    // console.log(`getAnalysisResultsBatch: Received request for ${queries.length} queries.`); // Reduce log noise
    try {
        const resultsMap = {};
        const BATCH_SIZE = 100;
        let foundCount = 0;
        for (let i = 0; i < queries.length; i += BATCH_SIZE) {
            const batch = queries.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (query) => {
                if (query && typeof query === 'string' && query.trim() !== '') {
                    const analysis = await getGeminiAnalysis(query);
                    if (analysis) {
                        resultsMap[query] = analysis;
                        foundCount++;
                    }
                }
            });
            await Promise.all(promises);
        }
        // console.log(`getAnalysisResultsBatch: Returning results for ${foundCount}/${queries.length} queries found in cache.`); // Reduce log noise
        res.status(200).json(resultsMap);
    } catch (error) {
        console.error('Error in getAnalysisResultsBatch controller:', error);
        res.status(500).json({ error: 'An internal server error occurred fetching analysis results.' });
    }
};