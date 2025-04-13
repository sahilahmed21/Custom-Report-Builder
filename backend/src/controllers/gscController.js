import { listProperties, fetchGSCData } from '../services/gscService.js';
import redis from '../config/db.js';

// Controller to list GSC properties
export const getProperties = async (req, res) => {
    try {
        const properties = await listProperties();
        res.status(200).json(properties);
    } catch (error) {
        console.error('Error in getProperties controller:', error);
        let statusCode = 500;
        if (error.message.includes('Authentication failed') || error.message.includes('re-login')) {
            statusCode = 401;
        } else if (
            error.message.includes('Permission denied') ||
            error.message.includes('forbidden')
        ) {
            statusCode = 403;
        }
        res.status(statusCode).json({
            error: error.message || 'Failed to retrieve GSC properties.',
        });
    }
};

// Controller to fetch report data
export const getReport = async (req, res) => {
    const { siteUrl, startDate, endDate, dimensions } = req.body;

    console.log('getReport: Received request with body:', req.body);

    if (!siteUrl || !startDate || !endDate || !dimensions) {
        console.error('getReport: Missing required parameters.');
        return res.status(400).json({
            error: 'Missing required report parameters (siteUrl, startDate, endDate, dimensions).',
        });
    }
    if (!Array.isArray(dimensions) || dimensions.length === 0) {
        console.error('getReport: Invalid dimensions parameter.');
        return res.status(400).json({
            error: 'Dimensions must be a non-empty array (e.g., ["query"]).',
        });
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        console.error('getReport: Invalid date format.');
        return res.status(400).json({
            error: 'startDate and endDate must be in YYYY-MM-DD format.',
        });
    }

    // Caching Logic
    const cacheKey = `gsc-report:${siteUrl}:${startDate}:${endDate}:${dimensions.sort().join(',')}`;
    console.log(`getReport: Generated Cache Key: ${cacheKey}`);

    try {
        if (!redis) {
            console.warn('getReport: Redis client not available, skipping cache check.');
        } else {
            const cachedDataString = await redis.get(cacheKey);
            if (cachedDataString) {
                console.log(`getReport: Cache hit for key: ${cacheKey}`);
                try {
                    const cachedData = JSON.parse(cachedDataString);
                    return res.status(200).json(cachedData);
                } catch (parseError) {
                    console.error(
                        `getReport: Failed to parse cached data for key ${cacheKey}. Error:`,
                        parseError
                    );
                    await redis.del(cacheKey);
                }
            } else {
                console.log(`getReport: Cache miss for key: ${cacheKey}`);
            }
        }

        // Prepare GSC API Request Body
        const requestBody = {
            startDate: startDate,
            endDate: endDate,
            dimensions: ['query'], // Hardcode to 'query' as per spec
        };

        console.log('getReport: Calling fetchGSCData service...');
        const data = await fetchGSCData(siteUrl, requestBody);
        console.log(`getReport: fetchGSCData returned ${data.length} rows.`);

        // Store in Cache
        if (redis && data) {
            try {
                const dataString = JSON.stringify(data);
                await redis.set(cacheKey, dataString, { EX: 3600 });
                console.log(`getReport: Stored ${data.length} rows in cache for key: ${cacheKey}`);
            } catch (cacheError) {
                console.error(
                    `getReport: Failed to store data in cache for key ${cacheKey}. Error:`,
                    cacheError
                );
            }
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Error in getReport controller:', error);
        let statusCode = 500;
        if (
            error.message.includes('Authentication failed') ||
            error.message.includes('re-login')
        ) {
            statusCode = 401;
        } else if (
            error.message.includes('Permission denied') ||
            error.message.includes('forbidden')
        ) {
            statusCode = 403;
        } else if (error.message.includes('quota')) {
            statusCode = 429;
        } else if (
            error.message.includes('Invalid request') ||
            error.message.includes('parameter')
        ) {
            statusCode = 400;
        }
        res.status(statusCode).json({
            error: error.message || 'Failed to retrieve GSC report data.',
        });
    }
};