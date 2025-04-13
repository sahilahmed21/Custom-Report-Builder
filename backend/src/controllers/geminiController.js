// backend/src/controllers/geminiController.js
import { analyzeQueryIntent } from '../services/geminiService.js';
import { getGeminiAnalysis, storeGeminiAnalysis } from '../utils/cache.js';

/**
 * Controller to analyze search intent for a batch of queries.
 */
export const analyzeIntents = async (req, res) => {
    const { queries } = req.body;

    if (!Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'Request body must contain a non-empty array of "queries".' });
    }

    // Limit the number of queries per request to avoid overwhelming Gemini or backend
    const MAX_QUERIES_PER_REQUEST = 100; // Adjust as needed
    if (queries.length > MAX_QUERIES_PER_REQUEST) {
        return res.status(400).json({ error: `Too many queries. Maximum allowed is ${MAX_QUERIES_PER_REQUEST}.` });
    }


    console.log(`analyzeIntents: Received request to analyze ${queries.length} queries.`);

    try {
        // Process queries concurrently
        const results = await Promise.all(queries.map(async (query) => {
            if (typeof query !== 'string' || query.trim().length === 0) {
                return { query, intent: 'Invalid Input', category: 'Invalid Input' };
            }

            let analysis = null;
            try {
                // 1. Check cache
                analysis = await getGeminiAnalysis(query);

                if (!analysis) {
                    // 2. If not cached, call Gemini Service
                    analysis = await analyzeQueryIntent(query);

                    // 3. If analysis successful, store in cache
                    // Check if analysis is not null and not an error object before caching
                    if (analysis && analysis.intent !== 'API Error' && analysis.intent !== 'Parsing Error' && analysis.intent !== 'Blocked by Safety Filter') {
                        await storeGeminiAnalysis(query, analysis);
                    } else if (!analysis) {
                        // Handle case where analyzeQueryIntent returned null (e.g., service disabled)
                        analysis = { intent: 'Analysis Disabled', category: 'Analysis Disabled' };
                    }
                }
            } catch (singleQueryError) {
                console.error(`analyzeIntents: Error processing query "${query}":`, singleQueryError.message);
                analysis = { intent: 'Processing Error', category: 'Processing Error' }; // Indicate error for this query
            }

            return {
                query: query, // Return the original query for mapping
                intent: analysis?.intent ?? 'Unknown', // Use nullish coalescing for safety
                category: analysis?.category ?? 'Unknown',
            };
        }));

        console.log(`analyzeIntents: Finished analysis for ${queries.length} queries.`);
        res.status(200).json(results);

    } catch (error) {
        console.error('Error in analyzeIntents controller:', error);
        res.status(500).json({ error: 'An internal server error occurred during intent analysis.' });
    }
};