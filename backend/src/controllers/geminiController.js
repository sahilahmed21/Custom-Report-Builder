// backend/src/controllers/geminiController.js
import { analyzeQueryIntent } from '../services/geminiService.js';
import {
    getGeminiAnalysis, storeGeminiAnalysis,
    initJobStatus, incrementJobProgress, finalizeJobStatus, getJobStatus
} from '../utils/cache.js';
import { sleep } from '../utils/sleep.js';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';

// --- Configuration ---
// Tiered Sampling Settings (Adjust as needed)
const MAX_SAMPLE_SIZE = 200; // Increase slightly? Max queries targeted by sampling. Needs balancing with cost/time.
const HIGH_CLICK_THRESHOLD = 5;   // Queries with > 5 clicks
const MEDIUM_CLICK_THRESHOLD = 2; // Queries with >= 2 and <= 5 clicks
const MEDIUM_CLICK_SAMPLE_PERCENT = 0.30; // Analyze 30% of medium click queries
const LOW_CLICK_SAMPLE_PERCENT = 0.05;   // Analyze 5% of low click queries (< 2 clicks)

// Gemini API Interaction Settings
const GEMINI_CONCURRENCY_LIMIT = 2; // Keep LOW (1 or 2 recommended) to respect rate limits & avoid errors
const THROTTLE_DELAY_MS = 3500;    // ~3.5 seconds per request (~17 req/min). Increase if hitting rate limits.

// Helper: Fisher-Yates (Knuth) Shuffle Algorithm
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex > 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// --- Background Processing Function (Runs Asynchronously) ---
const processJobInBackground = async (jobId, queriesToAnalyze) => {
    console.log(`[Job ${jobId}] Starting background analysis for ${queriesToAnalyze.length} sampled queries.`);
    const limit = pLimit(GEMINI_CONCURRENCY_LIMIT);
    let hasFailedCritically = false; // Flag if any *unexpected* error occurs

    try {
        const analysisPromises = queriesToAnalyze.map((query) =>
            limit(async () => {
                if (!query || typeof query !== 'string' || query.trim() === '') {
                    console.warn(`[Job ${jobId}] Skipping invalid query:`, query);
                    await incrementJobProgress(jobId); // Count invalid query as "processed"
                    return; // Skip processing this invalid query
                }

                let analysisResult = null;
                try {
                    // 1. Check Cache first
                    analysisResult = await getGeminiAnalysis(query);
                    if (analysisResult) {
                        console.log(`[Job ${jobId}] Cache HIT for query: "${query}"`);
                        // No API call needed, result is already cached
                    } else {
                        // 2. If not cached, call Gemini Service
                        console.log(`[Job ${jobId}] Cache MISS, analyzing query: "${query}"`);
                        analysisResult = await analyzeQueryIntent(query); // Actual API call

                        // 3. Store valid results in cache
                        // Only cache successful, non-error states returned by analyzeQueryIntent
                        if (analysisResult &&
                            analysisResult.intent !== 'API Error' &&
                            analysisResult.intent !== 'Parsing Error' &&
                            analysisResult.intent !== 'Blocked by Safety Filter' && // Add other specific non-cacheable states if needed
                            analysisResult.intent !== null && analysisResult.category !== null // Ensure it's not a null result from service init failure
                        ) {
                            await storeGeminiAnalysis(query, analysisResult);
                            console.log(`[Job ${jobId}] Successfully analyzed and cached: "${query}"`);
                        } else {
                            console.warn(`[Job ${jobId}] Analysis failed, blocked, or invalid for query "${query}", result:`, analysisResult);
                            // Do NOT cache error/null/blocked states here.
                            // getAnalysisResultsBatch will simply not find them later.
                        }
                    }
                } catch (singleQueryError) {
                    // Catch unexpected errors during cache check or API call for a single query
                    console.error(`[Job ${jobId}] CRITICAL Error processing query "${query}":`, singleQueryError);
                    hasFailedCritically = true; // Mark job as potentially failed due to unexpected issues
                    // Don't cache anything for this query on critical failure
                } finally {
                    // 4. Increment progress REGARDLESS of cache hit, success, or failure
                    await incrementJobProgress(jobId);
                    // 5. Throttle DELAY *after every attempt* to stay within rate limits
                    console.log(`[Job ${jobId}] Throttling for ${THROTTLE_DELAY_MS}ms after processing "${query}"`);
                    await sleep(THROTTLE_DELAY_MS);
                }
            })
        );

        // Wait for all limited & throttled promises to settle
        await Promise.all(analysisPromises);

        console.log(`[Job ${jobId}] Finished processing loop for ${queriesToAnalyze.length} queries.`);
        // Finalize status based on whether critical errors occurred
        await finalizeJobStatus(jobId, hasFailedCritically ? 'failed' : 'completed');

    } catch (jobError) {
        // Catch errors related to the overall job setup or Promise.all failure
        console.error(`[Job ${jobId}] FATAL Error during background processing orchestration:`, jobError);
        try {
            // Attempt to mark the job as failed in Redis even if orchestration failed
            await finalizeJobStatus(jobId, 'failed', jobError.message || 'Unknown background processing error');
        } catch (finalizeError) {
            console.error(`[Job ${jobId}] Additionally failed to finalize job status after orchestration error:`, finalizeError);
        }
    }
};

// --- Endpoint to Trigger Analysis (Receives Full List, Samples, Starts Job) ---
export const analyzeIntentsProgressive = async (req, res) => {
    console.log("Backend: /analyze-progressive endpoint hit.");
    console.log("Backend: Parsed req.body TYPE:", typeof req.body);
    // console.log("Backend: Parsed req.body:", req.body); // Keep this commented for now to reduce log noise unless needed

    // Expecting { queryData: Array<{ query: string, clicks: number }> }
    if (!req.body || typeof req.body !== 'object') {
        console.error("Backend: FATAL - Invalid or missing request body object.");
        return res.status(400).json({ error: 'Invalid or missing request body.' });
    }

    const { queryData } = req.body;

    // --- DETAILED Input validation ---
    console.log("Backend: VALIDATION - Type of queryData:", typeof queryData);

    if (!Array.isArray(queryData)) {
        console.error("Backend: VALIDATION FAILED - queryData is not an array. Received type:", typeof queryData);
        return res.status(400).json({ error: 'Request body must contain an array "queryData".' });
    }
    console.log("Backend: VALIDATION - queryData is an array. Length:", queryData.length);

    // Check structure of the FIRST item *if* the array is not empty
    if (queryData.length > 0) {
        const firstItem = queryData[0];
        console.log("Backend: VALIDATION - Type of queryData[0]:", typeof firstItem);
        console.log("Backend: VALIDATION - Value of queryData[0]:", JSON.stringify(firstItem)); // Stringify to ensure structure is logged

        // The specific check that was failing previously:
        if (typeof firstItem?.query !== 'string' || typeof firstItem?.clicks !== 'number') {
            console.warn("Backend: VALIDATION FAILED - First item in queryData has unexpected structure.");
            console.warn("Backend: VALIDATION FAILED - Expected { query: string, clicks: number }, Received:", JSON.stringify(firstItem));
            return res.status(400).json({ error: 'Items in "queryData" array must include a string "query" and a number "clicks".' });
        }
        console.log("Backend: VALIDATION - First item structure check passed.");
    } else {
        console.log("Backend: VALIDATION - queryData array is empty. Passing validation.");
        // Allow empty array to proceed, sampling logic will handle it.
    }

    // If we reach here, basic validation passed.
    console.log(`analyzeIntentsProgressive: Basic validation passed for ${queryData.length} items.`);

    try {
        // --- Tiered Sampling Logic ---
        const validQueryData = queryData.filter(item => // Filter based on the *received* data
            item && typeof item.query === 'string' && item.query.trim() !== '' && typeof item.clicks === 'number' && item.clicks >= 0
        );
        // Log if filtering removed items due to structure issues *after* the initial check
        if (validQueryData.length !== queryData.length) {
            console.warn(`analyzeIntentsProgressive: Filtered out ${queryData.length - validQueryData.length} items due to invalid structure/values during sampling prep.`);
        }
        console.log(`analyzeIntentsProgressive: Processing ${validQueryData.length} valid queries for sampling.`);

        // Separate queries based on click thresholds
        const highClickQueries = validQueryData.filter(q => q.clicks > HIGH_CLICK_THRESHOLD);
        const mediumClickQueries = validQueryData.filter(q => q.clicks >= MEDIUM_CLICK_THRESHOLD && q.clicks <= HIGH_CLICK_THRESHOLD);
        const lowClickQueries = validQueryData.filter(q => q.clicks < MEDIUM_CLICK_THRESHOLD);

        const sampledQueriesSet = new Set(); // Use a Set to automatically handle duplicates

        // 1. Add High Clicks (100%) - respecting MAX_SAMPLE_SIZE
        for (const item of highClickQueries) {
            if (sampledQueriesSet.size >= MAX_SAMPLE_SIZE) break;
            sampledQueriesSet.add(item.query);
        }
        console.log(`analyzeIntentsProgressive: Added ${sampledQueriesSet.size} High Click queries. Current sample size: ${sampledQueriesSet.size}`);

        // 2. Add Medium Clicks (Sampled %) - respecting MAX_SAMPLE_SIZE
        if (sampledQueriesSet.size < MAX_SAMPLE_SIZE && mediumClickQueries.length > 0) {
            const targetMediumCount = Math.max(1, Math.ceil(mediumClickQueries.length * MEDIUM_CLICK_SAMPLE_PERCENT));
            const shuffledMedium = shuffleArray([...mediumClickQueries]);
            let mediumAdded = 0;
            for (const item of shuffledMedium) {
                if (sampledQueriesSet.size >= MAX_SAMPLE_SIZE) break;
                if (!sampledQueriesSet.has(item.query)) {
                    if (mediumAdded < targetMediumCount) {
                        sampledQueriesSet.add(item.query);
                        mediumAdded++;
                    } else {
                        if (sampledQueriesSet.size < MAX_SAMPLE_SIZE / 2) continue;
                        else break;
                    }
                }
            }
            console.log(`analyzeIntentsProgressive: Added ${mediumAdded} Medium Click queries (target ${targetMediumCount}). Current sample size: ${sampledQueriesSet.size}`);
        }

        // 3. Add Low Clicks (Sampled %) - respecting MAX_SAMPLE_SIZE
        if (sampledQueriesSet.size < MAX_SAMPLE_SIZE && lowClickQueries.length > 0) {
            const targetLowCount = Math.max(1, Math.ceil(lowClickQueries.length * LOW_CLICK_SAMPLE_PERCENT));
            const shuffledLow = shuffleArray([...lowClickQueries]);
            let lowAdded = 0;
            for (const item of shuffledLow) {
                if (sampledQueriesSet.size >= MAX_SAMPLE_SIZE) break;
                if (!sampledQueriesSet.has(item.query)) {
                    if (lowAdded < targetLowCount) {
                        sampledQueriesSet.add(item.query);
                        lowAdded++;
                    } else {
                        break;
                    }
                }
            }
            console.log(`analyzeIntentsProgressive: Added ${lowAdded} Low Click queries (target ${targetLowCount}). Final sample size: ${sampledQueriesSet.size}`);
        }

        const queriesToAnalyze = Array.from(sampledQueriesSet);
        console.log(`analyzeIntentsProgressive: Tiered sampling selected ${queriesToAnalyze.length} unique queries to analyze.`);

        if (queriesToAnalyze.length === 0) {
            console.log("analyzeIntentsProgressive: No queries selected for analysis after sampling.");
            return res.status(200).json({ jobId: null, message: "No queries met sampling criteria for analysis." });
        }

        // --- Create Job & Start Background Processing ---
        const jobId = uuidv4();
        await initJobStatus(jobId, queriesToAnalyze.length);

        processJobInBackground(jobId, queriesToAnalyze)
            .catch(err => {
                console.error(`[Job ${jobId}] processJobInBackground promise rejected unexpectedly:`, err);
            });

        console.log(`analyzeIntentsProgressive: Started background job ${jobId}. Returning 202 Accepted.`);
        res.status(202).json({ jobId });

    } catch (error) {
        console.error('FATAL Error during sampling/job start in analyzeIntentsProgressive controller:', error);
        // Avoid sending detailed errors to client unless necessary
        res.status(500).json({ error: 'An internal server error occurred while processing the analysis request.' });
    }
};

// --- Endpoint to Get Job Status ---
export const getAnalysisJobStatus = async (req, res) => {
    const { jobId } = req.params;
    if (!jobId) {
        return res.status(400).json({ error: "Job ID URL parameter is required." });
    }
    console.log(`getAnalysisJobStatus: Request received for job ${jobId}`);

    try {
        const status = await getJobStatus(jobId); // Fetch from cache/Redis
        if (!status) {
            console.log(`getAnalysisJobStatus: Job ${jobId} status not found.`);
            // It's important to distinguish 'not found' from an error
            return res.status(404).json({ error: "Job not found. It may have expired or is invalid." });
        }
        console.log(`getAnalysisJobStatus: Returning status for job ${jobId}:`, status);
        // Return the whole status object
        res.status(200).json({ progress: status }); // Wrap in 'progress' to match frontend expectation? Check frontend code.
    } catch (error) {
        console.error(`Error fetching status for job ${jobId}:`, error);
        res.status(500).json({ error: "Failed to retrieve job status due to an internal error." });
    }
};

// --- Endpoint to Get Batched Analysis Results (Checks Main Cache) ---
export const getAnalysisResultsBatch = async (req, res) => {
    // Expecting { queries: string[] }
    const { queries } = req.body;

    if (!Array.isArray(queries)) {
        return res.status(400).json({ error: 'Request body must contain an array "queries".' });
    }

    if (queries.length === 0) {
        return res.status(200).json({}); // Return empty object if no queries requested
    }

    console.log(`getAnalysisResultsBatch: Received request for analysis results of ${queries.length} queries.`);

    try {
        const resultsMap = {};
        const BATCH_SIZE = 100; // Check Redis performance if this needs adjustment
        let foundCount = 0;

        // Process queries in batches to avoid overwhelming Redis/Node event loop if list is huge
        for (let i = 0; i < queries.length; i += BATCH_SIZE) {
            const batch = queries.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (query) => {
                if (query && typeof query === 'string' && query.trim() !== '') {
                    const analysis = await getGeminiAnalysis(query); // Check main cache
                    if (analysis) {
                        resultsMap[query] = analysis; // Add to map if found
                        foundCount++;
                    }
                    // If not found in cache, we simply don't add it to the map
                }
            });
            await Promise.all(promises); // Wait for the current batch to finish cache checks
        }

        console.log(`getAnalysisResultsBatch: Returning results for ${foundCount} queries found in cache out of ${queries.length} requested.`);
        res.status(200).json(resultsMap); // Return map of { query: { intent, category } }

    } catch (error) {
        console.error('Error in getAnalysisResultsBatch controller:', error);
        res.status(500).json({ error: 'An internal server error occurred fetching analysis results.' });
    }
};