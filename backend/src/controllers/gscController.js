// backend/src/controllers/gscController.js
import { listProperties, fetchGSCData } from '../services/gscService.js';
import redis from '../config/db.js';

// Controller to list GSC properties
export const getProperties = async (req, res) => {
    try {
        const properties = await listProperties();
        res.status(200).json(properties);
    } catch (error) {
        console.error('Error fetching GSC properties:', error.message);
        let statusCode = 500;
        if (error.message.includes('Authentication failed') || error.message.includes('re-login')) {
            statusCode = 401;
        } else if (error.message.includes('Permission denied') || error.message.includes('forbidden')) {
            statusCode = 403;
        }
        res.status(statusCode).json({
            error: error.message || 'Failed to retrieve GSC properties',
        });
    }
};

// Controller to fetch report data
export const getReport = async (req, res) => {
    const { siteUrl, startDate, endDate, dimensions } = req.body;

    // --- Parameter Validation ---
    if (!siteUrl || !startDate || !endDate || !dimensions) {
        return res.status(400).json({ error: 'Missing required parameters: siteUrl, startDate, endDate, dimensions' });
    }
    if (!Array.isArray(dimensions) || dimensions.length === 0) {
        return res.status(400).json({ error: 'Dimensions must be a non-empty array' });
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' });
    }

    const cacheKey = `gsc-report:${siteUrl}:${startDate}:${endDate}:${dimensions.sort().join(',')}`;
    let dataToReturn = null;

    try {
        // --- 1. Attempt to Retrieve from Cache ---
        if (redis) {
            try {
                const cachedData = await redis.get(cacheKey);
                if (cachedData) {
                    console.debug(`Cache hit: ${cacheKey}`);
                    try {
                        dataToReturn = JSON.parse(cachedData);
                        if (!Array.isArray(dataToReturn)) {
                            console.warn(`Invalid cache data (not an array): ${cacheKey}`);
                            await redis.del(cacheKey);
                            dataToReturn = null;
                        }
                    } catch (parseError) {
                        console.error(`Failed to parse cached data: ${cacheKey}`, parseError.message);
                        await redis.del(cacheKey);
                        dataToReturn = null;
                    }
                } else {
                    console.debug(`Cache miss: ${cacheKey}`);
                }
            } catch (cacheError) {
                console.warn(`Cache retrieval failed: ${cacheKey}`, cacheError.message);
            }
        } else {
            console.warn('Redis client unavailable, skipping cache');
        }

        // --- 2. Fetch Fresh Data if Cache Miss or Invalid ---
        if (!dataToReturn) {
            console.debug(`Fetching GSC data for ${siteUrl}`);
            const requestBody = {
                startDate,
                endDate,
                dimensions: ['query'], // Hardcoded as per spec
            };

            dataToReturn = await fetchGSCData(siteUrl, requestBody);

            // Validate fetched data
            if (!Array.isArray(dataToReturn)) {
                console.error(`GSC API returned invalid data for ${siteUrl}`);
                return res.status(500).json({ error: 'Invalid data returned from GSC API' });
            }

            // --- 3. Store Fresh Data in Cache ---
            if (redis && dataToReturn.length > 0) {
                try {
                    const dataString = JSON.stringify(dataToReturn);
                    const cacheTTL = process.env.GSC_CACHE_TTL || 3600; // Configurable TTL
                    await redis.set(cacheKey, dataString, { EX: cacheTTL });
                    console.debug(`Cached ${dataToReturn.length} rows: ${cacheKey}`);
                } catch (cacheError) {
                    console.warn(`Failed to cache data: ${cacheKey}`, cacheError.message);
                }
            }
        }

        // --- 4. Return Data ---
        res.status(200).json(dataToReturn);

    } catch (error) {
        console.error(`Error in getReport: ${siteUrl}`, error.message);
        let statusCode = 500;
        let message = error.message || 'Failed to retrieve GSC report data';
        if (error.message.includes('Authentication failed') || error.message.includes('re-login')) {
            statusCode = 401;
        } else if (error.message.includes('Permission denied') || error.message.includes('forbidden')) {
            statusCode = 403;
        } else if (error.message.includes('quota')) {
            statusCode = 429;
        } else if (error.message.includes('Invalid request') || error.message.includes('parameter')) {
            statusCode = 400;
        }
        res.status(statusCode).json({ error: message });
    }
};