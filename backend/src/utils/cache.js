import redis from '../config/db.js';

const TOKEN_KEY = 'user_tokens';
const GEMINI_CACHE_PREFIX = 'gemini-analysis:';
const GEMINI_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // Cache Gemini results for 7 days
const JOB_STATUS_PREFIX = 'job:';
const JOB_TTL_SECONDS = 60 * 60 * 2; // Keep job status for 2 hours

// Store tokens
export const storeTokens = async (tokens) => {
    const logPrefix = `storeTokens (Key: ${TOKEN_KEY}):`; // For easier log filtering
    if (!redis) { // Add check for Redis client readiness
        console.error(`${logPrefix} Redis client is not available! Cannot store tokens.`);
        throw new Error("Redis connection unavailable during storeTokens.");
    }
    try {
        console.log(`${logPrefix} Preparing to store tokens:`, tokens); // Log before stringify
        const tokensString = JSON.stringify(tokens);
        console.log(`${logPrefix} Stringified tokens. Attempting redis.set...`); // Log before set
        try {
            await redis.set(TOKEN_KEY, tokensString);
            console.log(`${logPrefix} redis.set command completed successfully.`); // Confirmation log
        } catch (redisSetError) {
            console.error(`${logPrefix} CRITICAL ERROR during redis.set:`, redisSetError);
            throw redisSetError; // Re-throw to ensure the calling function knows it failed
        }
        // End inner try/catch
    } catch (error) {
        // This outer catch will now catch errors from stringify or the re-thrown redisSetError
        console.error(`${logPrefix} Error during token storage process:`, error);
        throw error; // Re-throw so oauthCallback knows about the failure
    }
};

// Retrieve tokens
export const getTokens = async () => {
    const logPrefix = `getTokens (Key: ${TOKEN_KEY}):`; // For easier log filtering
    if (!redis) { // Add check for Redis client readiness
        console.error(`${logPrefix} Redis client is not available! Cannot get tokens.`);
        return null; // Return null if client not ready
    }
    try {
        console.log(`${logPrefix} Attempting redis.get...`); // ADDED LOG
        const retrievedValue = await redis.get(TOKEN_KEY);
        // ---> THIS IS THE CRITICAL LOG <---
        console.log(`${logPrefix} Raw value from redis.get:`, retrievedValue); // ADDED LOG

        if (retrievedValue === null || typeof retrievedValue === 'undefined') { // More robust check
            console.log(`${logPrefix} No value found in cache (retrievedValue is null/undefined).`);
            return null;
        }

        const valueType = typeof retrievedValue;
        console.log(`${logPrefix} Type of retrieved value: ${valueType}`);

        let tokens;
        if (valueType === 'string') {
            console.log(`${logPrefix} Retrieved value is a string, attempting JSON.parse...`);
            try {
                tokens = JSON.parse(retrievedValue);
            } catch (parseError) {
                console.error(`${logPrefix} Failed to parse retrieved string: ${parseError}. String was:`, retrievedValue);
                // Optionally delete corrupted key
                try { await redis.del(TOKEN_KEY); } catch (delErr) { console.error(`${logPrefix} Failed to delete corrupted key`, delErr); }
                throw parseError; // Re-throw
            }
        } else if (valueType === 'object' && retrievedValue !== null) {
            // This case might indicate an issue with how the client returns data or if data was stored differently.
            console.warn(`${logPrefix} Retrieved value is already an object (type: ${valueType}). Using directly. Check @upstash/redis client behavior.`);
            tokens = retrievedValue;
        } else {
            console.error(`${logPrefix} Unexpected type ('${valueType}') retrieved from cache. Value:`, retrievedValue);
            return null;
        }

        // Final validation of the parsed/retrieved token object
        if (!tokens || typeof tokens.access_token === 'undefined' || tokens.access_token === null) {
            console.error(`${logPrefix} Processed tokens object seems invalid or lacks access_token:`, tokens);
            return null;
        }

        console.log(`${logPrefix} Successfully retrieved and processed tokens.`);
        return tokens;
    } catch (error) {
        console.error(`${logPrefix} CRITICAL ERROR during retrieval/processing:`, error);
        return null; // Return null on any error during retrieval/processing
    }
};

// Clear tokens
export const clearTokens = async () => {
    const logPrefix = `clearTokens (Key: ${TOKEN_KEY}):`; // For easier log filtering
    if (!redis) { // Add check for Redis client readiness
        console.error(`${logPrefix} Redis client is not available! Cannot clear tokens.`);
        throw new Error("Redis connection unavailable during clearTokens.");
    }
    try {
        console.log(`${logPrefix} Attempting redis.del...`);
        const result = await redis.del(TOKEN_KEY);
        console.log(`${logPrefix} redis.del command completed. Result (keys removed): ${result}`);
    } catch (error) {
        console.error(`${logPrefix} Error during redis.del:`, error);
        throw error; // Re-throw
    }
};

/**
 * Retrieves cached Gemini analysis for a query.
 * @param {string} query The search query.
 * @returns {Promise<object | null>} The cached analysis object or null if not found/error.
 */
export const getGeminiAnalysis = async (query) => {
    if (!redis || !query) return null;
    const cacheKey = `${GEMINI_CACHE_PREFIX}${query}`;
    try {
        const cachedDataString = await redis.get(cacheKey);
        if (cachedDataString) {
            // console.log(`getGeminiAnalysis: Cache HIT for key: ${cacheKey}`); // Reduce noise
            if (typeof cachedDataString === 'object') {
                console.warn(`getGeminiAnalysis: Retrieved value is already an object for key ${cacheKey}. Using directly.`);
                return cachedDataString;
            }
            return JSON.parse(cachedDataString);
        }
        // console.log(`getGeminiAnalysis: Cache MISS for key: ${cacheKey}`); // Reduce noise
        return null;
    } catch (error) {
        console.error(`Error retrieving Gemini analysis from cache for key ${cacheKey}:`, error);
        if (error instanceof SyntaxError) {
            try { await redis.del(cacheKey); } catch (delErr) { console.error(`Failed to delete corrupted cache key ${cacheKey}`, delErr); }
        }
        return null;
    }
};

/**
 * Stores Gemini analysis in the cache.
 * @param {string} query The search query.
 * @param {object} analysis The analysis object ({ intent, category }).
 */
export const storeGeminiAnalysis = async (query, analysis) => {
    if (!redis || !query || !analysis || typeof analysis !== 'object') return;
    const cacheKey = `${GEMINI_CACHE_PREFIX}${query}`;
    try {
        const analysisString = JSON.stringify(analysis);
        await redis.set(cacheKey, analysisString, { ex: GEMINI_CACHE_TTL_SECONDS });
        // console.log(`storeGeminiAnalysis: Stored analysis in cache for key: ${cacheKey}`); // Reduce noise
    } catch (error) {
        console.error(`Error storing Gemini analysis in cache for key ${cacheKey}:`, error);
    }
};

/**
 * Initializes job status in Redis.
 * @param {string} jobId The unique ID for the job.
 * @param {number} totalItems Total number of items to process.
 */
export const initJobStatus = async (jobId, totalItems) => {
    if (!redis) return;
    const key = `${JOB_STATUS_PREFIX}${jobId}`;
    try {
        await redis.hset(key, {
            total: totalItems,
            completed: 0,
            status: 'running',
            startTime: Date.now(),
        });
        await redis.expire(key, JOB_TTL_SECONDS);
        console.log(`Initialized job status for ${key}`);
    } catch (error) {
        console.error(`Error initializing job status for ${key}:`, error);
    }
};

/**
 * Increments the completed count for a job.
 * @param {string} jobId The unique ID for the job.
 */
export const incrementJobProgress = async (jobId) => {
    if (!redis) return;
    const key = `${JOB_STATUS_PREFIX}${jobId}`;
    try {
        await redis.hincrby(key, 'completed', 1);
    } catch (error) {
        console.error(`Error incrementing job progress for ${key}:`, error);
    }
};

/**
 * Updates the job status to 'completed' or 'failed'.
 * @param {string} jobId The unique ID for the job.
 * @param {'completed' | 'failed'} finalStatus The final status.
 * @param {string} [errorMessage] Optional error message if failed.
 */
export const finalizeJobStatus = async (jobId, finalStatus, errorMessage) => {
    if (!redis) return;
    const key = `${JOB_STATUS_PREFIX}${jobId}`;
    try {
        const updates = {
            status: finalStatus,
            endTime: Date.now(),
        };
        if (errorMessage) {
            updates.error = errorMessage;
        }
        await redis.hmset(key, updates);
        await redis.expire(key, JOB_TTL_SECONDS); // Refresh TTL on finalization
        console.log(`Finalized job status for ${key} as ${finalStatus}`);
    } catch (error) {
        console.error(`Error finalizing job status for ${key}:`, error);
    }
};

/**
 * Retrieves the current status of a job.
 * @param {string} jobId The unique ID for the job.
 * @returns {Promise<object | null>} Job status object or null if not found/error.
 */
export const getJobStatus = async (jobId) => {
    if (!redis) return null;
    const key = `${JOB_STATUS_PREFIX}${jobId}`;
    try {
        const status = await redis.hgetall(key);
        if (status) {
            // Convert numeric fields back from strings
            if (status.total) status.total = parseInt(status.total, 10);
            if (status.completed) status.completed = parseInt(status.completed, 10);
            if (status.startTime) status.startTime = parseInt(status.startTime, 10);
            if (status.endTime) status.endTime = parseInt(status.endTime, 10);
        }
        return status; // Returns null if key doesn't exist
    } catch (error) {
        console.error(`Error retrieving job status for ${key}:`, error);
        return null;
    }
};