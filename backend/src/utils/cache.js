// backend/src/utils/cache.js
import redis from '../config/db.js';

const TOKEN_KEY = 'user_tokens';

// Store tokens (Remains the same)
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

// Retrieve tokens (Updated Logic)
export const getTokens = async () => {
    try {
        const retrievedValue = await redis.get(TOKEN_KEY);

        if (!retrievedValue) {
            console.log(`No tokens found in cache for key: ${TOKEN_KEY}`);
            return null;
        }

        // Add detailed logging to understand what's happening
        console.log(`Raw value retrieved for key ${TOKEN_KEY}:`, retrievedValue);
        const valueType = typeof retrievedValue;
        console.log(`Type of retrieved value: ${valueType}`);

        let tokens;
        if (valueType === 'string') {
            // This is the EXPECTED path
            console.log('Retrieved value is a string, attempting JSON.parse...');
            try {
                tokens = JSON.parse(retrievedValue);
            } catch (parseError) {
                console.error(`Failed to parse retrieved string: ${parseError}. String was:`, retrievedValue);
                throw parseError; // Re-throw the parsing error
            }
        } else if (valueType === 'object' && retrievedValue !== null) {
            // This is the UNEXPECTED path, handling the client's strange behavior
            console.warn(`Retrieved value is already an object (type: ${valueType}). Using directly. Check @upstash/redis client behavior.`);
            tokens = retrievedValue; // Use the object directly
        } else {
            // Handle other unexpected types
            console.error(`Unexpected type ('${valueType}') retrieved from cache for key ${TOKEN_KEY}. Value:`, retrievedValue);
            return null; // Cannot process this type
        }

        // Optional: Add a check to ensure the final 'tokens' object looks valid
        if (!tokens || typeof tokens.access_token === 'undefined') {
            console.error("Processed tokens object seems invalid:", tokens);
            return null;
        }

        return tokens; // Return the processed tokens object

    } catch (error) {
        // Keep existing error handling, but the specific parse error should be caught above now
        console.error(`Error retrieving/processing tokens for key ${TOKEN_KEY}:`, error);
        // No need to re-log SyntaxError specifically here if handled above
        return null; // Return null on error
    }
};

// Clear tokens (Remains the same)
export const clearTokens = async () => {
    try {
        const result = await redis.del(TOKEN_KEY);
        console.log(`Cleared tokens for key ${TOKEN_KEY}. Result: ${result}`);
    } catch (error) {
        console.error(`Error clearing tokens for key ${TOKEN_KEY}:`, error);
        throw error;
    }
};