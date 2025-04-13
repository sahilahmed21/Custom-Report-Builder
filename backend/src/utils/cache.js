import redis from '../config/db.js';

const TOKEN_KEY = 'user_tokens';
const GEMINI_CACHE_PREFIX = 'gemini-analysis:';
const GEMINI_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // Cache Gemini results for 7 days

// Store tokens
export const storeTokens = async (tokens) => {
    try {
        const tokensString = JSON.stringify(tokens);
        await redis.set(TOKEN_KEY, tokensString);
        console.log(`Tokens stored successfully under key: ${TOKEN_KEY}`);
    } catch (error) {
        console.error(`Error storing tokens under key ${TOKEN_KEY}:`, error);
        throw error;
    }
};

// Retrieve tokens
export const getTokens = async () => {
    try {
        const retrievedValue = await redis.get(TOKEN_KEY);

        if (!retrievedValue) {
            console.log(`No tokens found in cache for key: ${TOKEN_KEY}`);
            return null;
        }

        console.log(`Raw value retrieved for key ${TOKEN_KEY}:`, retrievedValue);
        const valueType = typeof retrievedValue;
        console.log(`Type of retrieved value: ${valueType}`);

        let tokens;
        if (valueType === 'string') {
            console.log('Retrieved value is a string, attempting JSON.parse...');
            try {
                tokens = JSON.parse(retrievedValue);
            } catch (parseError) {
                console.error(
                    `Failed to parse retrieved string: ${parseError}. String was:`,
                    retrievedValue
                );
                throw parseError;
            }
        } else if (valueType === 'object' && retrievedValue !== null) {
            console.warn(
                `Retrieved value is already an object (type: ${valueType}). Using directly. Check @upstash/redis client behavior.`
            );
            tokens = retrievedValue;
        } else {
            console.error(
                `Unexpected type ('${valueType}') retrieved from cache for key ${TOKEN_KEY}. Value:`,
                retrievedValue
            );
            return null;
        }

        if (!tokens || typeof tokens.access_token === 'undefined') {
            console.error('Processed tokens object seems invalid:', tokens);
            return null;
        }

        return tokens;
    } catch (error) {
        console.error(`Error retrieving/processing tokens for key ${TOKEN_KEY}:`, error);
        return null;
    }
};

// Clear tokens
export const clearTokens = async () => {
    try {
        const result = await redis.del(TOKEN_KEY);
        console.log(`Cleared tokens for key ${TOKEN_KEY}. Result: ${result}`);
    } catch (error) {
        console.error(`Error clearing tokens for key ${TOKEN_KEY}:`, error);
        throw error;
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
            console.log(`getGeminiAnalysis: Cache HIT for key: ${cacheKey}`);
            if (typeof cachedDataString === 'object') {
                console.warn(
                    `getGeminiAnalysis: Retrieved value is already an object for key ${cacheKey}. Using directly.`
                );
                return cachedDataString;
            }
            return JSON.parse(cachedDataString);
        }
        console.log(`getGeminiAnalysis: Cache MISS for key: ${cacheKey}`);
        return null;
    } catch (error) {
        console.error(`Error retrieving Gemini analysis from cache for key ${cacheKey}:`, error);
        if (error instanceof SyntaxError) {
            try {
                await redis.del(cacheKey);
            } catch (delErr) {
                console.error(`Failed to delete corrupted cache key ${cacheKey}`, delErr);
            }
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
        console.log(`storeGeminiAnalysis: Stored analysis in cache for key: ${cacheKey}`);
    } catch (error) {
        console.error(`Error storing Gemini analysis in cache for key ${cacheKey}:`, error);
    }
};