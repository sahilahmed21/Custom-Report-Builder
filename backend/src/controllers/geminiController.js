// backend/src/controllers/geminiController.js
import { analyzeQueryIntent } from '../services/geminiService.js';
import {
    getGeminiAnalysis, storeGeminiAnalysis,
    initJobStatus, incrementJobProgress, finalizeJobStatus, getJobStatus // Correct job functions
} from '../utils/cache.js';
import { sleep } from '../utils/sleep.js';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';

// --- Configuration ---
const MAX_SAMPLE_SIZE = 100; // Max queries targeted by sampling
const MEDIUM_CLICK_SAMPLE_PERCENT = 0.30; // 30%
const LOW_CLICK_SAMPLE_PERCENT = 0.05;   // 5%
const GEMINI_CONCURRENCY_LIMIT = 2; // Keep LOW (1 or 2) to respect rate limits
const THROTTLE_DELAY_MS = 4500; // ~4.5 seconds per request (~13 req/min, safer buffer)

// Fisher-Yates (Knuth) Shuffle Algorithm - Helper function
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
}

// --- Background Processing Function ---
// NOTE: This runs async without top-level await. Error handling inside is crucial.
const processJobInBackground = async (jobId, queriesToAnalyze) => {
    console.log(`[Job ${jobId}] Starting background analysis for ${queriesToAnalyze.length} queries.`);
    const limit = pLimit(GEMINI_CONCURRENCY_LIMIT);
    let hasFailed = false; // Flag if any individual query analysis fails critically

    try {
        const analysisPromises = queriesToAnalyze.map((query) =>
            limit(async () => {
                if (!query || typeof query !== 'string' || query.trim() === '') {
                    console.warn(`[Job ${jobId}] Skipping invalid query:`, query);
                    await incrementJobProgress(jobId); // Count invalid query as "processed"
                    return;
                };

                let analysis = null;
                let success = false;
                try {
                    // 1. Check Cache
                    analysis = await getGeminiAnalysis(query);
                    if (analysis) {
                        console.log(`[Job ${jobId}] Cache HIT for query "${query}"`);
                        success = true; // Already done
                    } else {
                        // 2. If not cached, call Gemini Service
                        console.log(`[Job ${jobId}] Cache MISS, analyzing query "${query}"`);
                        analysis = await analyzeQueryIntent(query); // Actual API call

                        // 3. If analysis successful, store in main cache
                        // Check for various error/null states before caching
                        if (analysis &&
                            analysis.intent !== 'API Error' &&
                            analysis.intent !== 'Parsing Error' &&
                            analysis.intent !== 'Blocked by Safety Filter' &&
                            analysis.intent !== 'Processing Error' &&
                            analysis.intent !== 'Analysis Disabled' &&
                            analysis.intent !== 'Unknown Error' &&
                            analysis.intent !== 'Unknown' // Added Unknown check
                        ) {
                            await storeGeminiAnalysis(query, analysis);
                            success = true;
                            console.log(`[Job ${jobId}] Successfully analyzed and cached "${query}"`);
                        } else {
                            console.warn(`[Job ${jobId}] Analysis failed, disabled, or unknown for query "${query}", result:`, analysis);
                            // We still count it as "processed" but don't cache the error state here
                            // The getAnalysisResultsBatch will simply not find it in cache later
                        }
                    }
                } catch (singleQueryError) {
                    // Catch errors specifically from analyzeQueryIntent or cache interaction
                    console.error(`[Job ${jobId}] CRITICAL Error processing query "${query}":`, singleQueryError);
                    hasFailed = true; // Mark job as having encountered issues
                } finally {
                    // 4. Increment progress regardless of success/failure/cache hit
                    await incrementJobProgress(jobId);
                    // 5. Throttle DELAY after every attempt (success, fail, or cache hit)
                    console.log(`[Job ${jobId}] Throttling for ${THROTTLE_DELAY_MS}ms after processing "${query}"`);
                    await sleep(THROTTLE_DELAY_MS);
                }
            })
        );

        await Promise.all(analysisPromises); // Wait for all throttled tasks to attempt completion

        console.log(`[Job ${jobId}] Finished processing loop for ${queriesToAnalyze.length} queries.`);
        // Finalize status based on whether critical errors occurred during processing
        await finalizeJobStatus(jobId, hasFailed ? 'failed' : 'completed');

    } catch (jobError) {
        // Catch errors related to the overall job setup or Promise.all failure
        console.error(`[Job ${jobId}] Unhandled error during background processing orchestration:`, jobError);
        await finalizeJobStatus(jobId, 'failed', jobError.message || 'Unknown background processing error');
    }
};


// --- Endpoint to Trigger Analysis ---
export const analyzeIntentsProgressive = async (req, res) => {
    const { queryData } = req.body; // Expecting Array<{ query: string, clicks: number, ... }>

    // --- Input validation ---
    if (!Array.isArray(queryData) || queryData.length === 0) return res.status(400).json({ error: 'Request body must contain a non-empty array "queryData".' });
    if (!queryData[0]?.query || typeof queryData[0]?.clicks === 'undefined') return res.status(400).json({ error: '"queryData" items must include "query" and "clicks".' });

    console.log(`analyzeIntentsProgressive: Received ${queryData.length} queries.`);

    try {
        // --- Tiered Sampling Logic ---
        const validQueryData = queryData.filter(item => item && typeof item.query === 'string' && typeof item.clicks === 'number');
        const highClickQueries = validQueryData.filter(q => q.clicks > 5);
        const mediumClickQueries = validQueryData.filter(q => q.clicks >= 2 && q.clicks <= 5);
        const lowClickQueries = validQueryData.filter(q => q.clicks < 2);
        const sampledQueriesSet = new Set();

        // Add High Clicks (100%) - respecting MAX_SAMPLE_SIZE
        let highAdded = 0;
        for (const item of highClickQueries) {
            if (sampledQueriesSet.size < MAX_SAMPLE_SIZE) {
                if (!sampledQueriesSet.has(item.query)) {
                    sampledQueriesSet.add(item.query);
                    highAdded++;
                }
            } else break;
        }
        console.log(`analyzeIntentsProgressive: Added ${highAdded} High Click queries. Sample size: ${sampledQueriesSet.size}`);

        // Add Medium Clicks (Sampled %) - respecting MAX_SAMPLE_SIZE
        if (sampledQueriesSet.size < MAX_SAMPLE_SIZE && mediumClickQueries.length > 0) {
            const targetMediumCount = Math.ceil(mediumClickQueries.length * MEDIUM_CLICK_SAMPLE_PERCENT);
            const shuffledMedium = shuffleArray([...mediumClickQueries]);
            let mediumAdded = 0;
            for (const item of shuffledMedium) {
                if (sampledQueriesSet.size < MAX_SAMPLE_SIZE && mediumAdded < targetMediumCount) {
                    if (!sampledQueriesSet.has(item.query)) {
                        sampledQueriesSet.add(item.query);
                        mediumAdded++;
                    }
                } else break;
            }
            console.log(`analyzeIntentsProgressive: Added ${mediumAdded} Medium Click queries (target ${targetMediumCount}). Sample size: ${sampledQueriesSet.size}`);
        }

        // Add Low Clicks (Sampled %) - respecting MAX_SAMPLE_SIZE
        if (sampledQueriesSet.size < MAX_SAMPLE_SIZE && lowClickQueries.length > 0) {
            const targetLowCount = Math.ceil(lowClickQueries.length * LOW_CLICK_SAMPLE_PERCENT);
            const shuffledLow = shuffleArray([...lowClickQueries]);
            let lowAdded = 0;
            for (const item of shuffledLow) {
                if (sampledQueriesSet.size < MAX_SAMPLE_SIZE && lowAdded < targetLowCount) {
                    if (!sampledQueriesSet.has(item.query)) {
                        sampledQueriesSet.add(item.query);
                        lowAdded++;
                    }
                } else break;
            }
            console.log(`analyzeIntentsProgressive: Added ${lowAdded} Low Click queries (target ${targetLowCount}). Sample size: ${sampledQueriesSet.size}`);
        }

        const queriesToAnalyze = Array.from(sampledQueriesSet);
        console.log(`analyzeIntentsProgressive: Tiered sampling selected ${queriesToAnalyze.length} queries to analyze.`);

        if (queriesToAnalyze.length === 0) {
            return res.status(200).json({ jobId: null, message: "No queries selected for analysis based on sampling criteria." });
        }

        // --- Create Job & Start Background Processing ---
        const jobId = uuidv4();
        await initJobStatus(jobId, queriesToAnalyze.length);

        // Call the background process but DO NOT await it
        processJobInBackground(jobId, queriesToAnalyze);

        // Return Job ID immediately
        console.log(`analyzeIntentsProgressive: Started job ${jobId}. Returning 202 Accepted.`);
        res.status(202).json({ jobId });

    } catch (error) {
        console.error('Error in analyzeIntentsProgressive controller:', error);
        res.status(500).json({ error: 'An internal server error occurred starting intent analysis.' });
    }
};

// --- Endpoint to Get Job Status ---
export const getAnalysisJobStatus = async (req, res) => {
    const { jobId } = req.params;
    if (!jobId) {
        return res.status(400).json({ error: "Job ID parameter is required." });
    }
    console.log(`getAnalysisJobStatus: Request received for job ${jobId}`);

    try {
        const status = await getJobStatus(jobId);
        if (!status) {
            console.log(`getAnalysisJobStatus: Job ${jobId} not found.`);
            return res.status(404).json({ error: "Job not found or expired." });
        }
        console.log(`getAnalysisJobStatus: Returning status for job ${jobId}:`, status);
        res.status(200).json({ progress: status });
    } catch (error) {
        console.error(`Error fetching status for job ${jobId}:`, error);
        res.status(500).json({ error: "Failed to retrieve job status." });
    }
};


// --- Endpoint to Get Batched Analysis Results (from main cache) ---
export const getAnalysisResultsBatch = async (req, res) => {
    const { queries } = req.body; // Expecting { queries: string[] }

    if (!Array.isArray(queries)) {
        return res.status(400).json({ error: 'Request body must contain an array "queries".' });
    }

    if (queries.length === 0) {
        return res.status(200).json({}); // Return empty object if no queries requested
    }

    console.log(`getAnalysisResultsBatch: Received request for ${queries.length} queries.`);

    try {
        const resultsMap = {};
        // Fetch results concurrently (adjust if needed for Redis performance)
        const promises = queries.map(async (query) => {
            if (query && typeof query === 'string') {
                const analysis = await getGeminiAnalysis(query); // Check main cache
                if (analysis) {
                    resultsMap[query] = analysis;
                }
            }
        });
        await Promise.all(promises);

        console.log(`getAnalysisResultsBatch: Returning results for ${Object.keys(resultsMap).length} queries found in cache.`);
        res.status(200).json(resultsMap);

    } catch (error) {
        console.error('Error in getAnalysisResultsBatch controller:', error);
        res.status(500).json({ error: 'An internal server error occurred fetching analysis results.' });
    }
};