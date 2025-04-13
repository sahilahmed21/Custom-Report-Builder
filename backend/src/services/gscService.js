import { google } from 'googleapis';
import { getRefreshedClient } from '../controllers/authController.js';

const searchconsole = google.searchconsole('v1');

/**
 * Lists the sites (properties) accessible to the authenticated user.
 * @returns {Promise<Array<{siteUrl: string, permissionLevel: string}>>} List of properties.
 */
export const listProperties = async () => {
    let authClient;
    try {
        console.log('listProperties: Attempting to get refreshed client...');
        authClient = await getRefreshedClient();
        console.log('listProperties: Successfully obtained refreshed client.');

        console.log('listProperties: Attempting to call searchconsole.sites.list...');
        const res = await searchconsole.sites.list({
            auth: authClient,
        });
        console.log('listProperties: GSC sites.list API call successful.');
        return res.data.siteEntry || [];
    } catch (error) {
        console.error('listProperties: Error occurred.', error);
        if (error.response && error.response.data) {
            console.error('listProperties: GSC API Error Data:', error.response.data);
        } else if (error.message) {
            console.error('listProperties: Error message:', error.message);
        }

        if (
            error.message.includes('token') ||
            error.message.includes('authenticate') ||
            error.message.includes('credentials')
        ) {
            throw new Error('Authentication failed or token issue. Please re-login.');
        } else if (error.message.includes('forbidden') || error.code === 403) {
            throw new Error(
                'Permission denied by Google API. Check API enablement and user permissions for Search Console API.'
            );
        }

        throw new Error(`Failed to fetch GSC properties: ${error.message || 'Unknown error'}`);
    }
};

/**
 * Fetches GSC search analytics data with pagination.
 * @param {string} siteUrl - The GSC property URL (e.g., sc-domain:example.com).
 * @param {object} baseRequestBody - Base request parameters including startDate, endDate, dimensions.
 * @returns {Promise<Array<object>>} - A promise resolving to an array of all fetched rows.
 */
export const fetchGSCData = async (siteUrl, baseRequestBody) => {
    console.log(`fetchGSCData: Starting data fetch for ${siteUrl}`);
    let allRows = [];
    let startRow = 0;
    const rowLimit = 5000; // GSC API v1 recommends <= 5000 for reliability, max is 25000
    let keepFetching = true;
    let page = 1;
    let authClient;

    try {
        authClient = await getRefreshedClient();
        console.log(`fetchGSCData: Obtained authenticated client.`);

        while (keepFetching) {
            const currentPageRequestBody = {
                ...baseRequestBody,
                startRow: startRow,
                rowLimit: rowLimit,
            };

            console.log(
                `fetchGSCData: Fetching page ${page}, startRow: ${startRow}, rowLimit: ${rowLimit}`
            );
            console.log(`fetchGSCData: Request Body for page ${page}:`, currentPageRequestBody);

            const res = await searchconsole.searchanalytics.query({
                auth: authClient,
                siteUrl: siteUrl,
                requestBody: currentPageRequestBody,
            });

            const rows = res.data.rows || [];
            const responseRowCount = rows.length;
            console.log(`fetchGSCData: Page ${page} response - received ${responseRowCount} rows.`);

            if (responseRowCount > 0) {
                allRows = allRows.concat(rows);
            }

            if (responseRowCount < rowLimit || responseRowCount === 0) {
                keepFetching = false;
                console.log(`fetchGSCData: Last page fetched (received ${responseRowCount} rows).`);
            } else {
                startRow += rowLimit;
                page++;
                if (page > 50) {
                    console.warn('fetchGSCData: Reached maximum page limit (50). Stopping fetch.');
                    keepFetching = false;
                }
            }
        }

        console.log(`fetchGSCData: Finished fetching. Total rows: ${allRows.length}`);
        return allRows;
    } catch (error) {
        console.error(`fetchGSCData: Error during API call (Page ${page}, StartRow ${startRow}).`, error);
        if (error.response && error.response.data) {
            console.error('fetchGSCData: GSC API Error Data:', error.response.data);
        } else if (error.message) {
            console.error('fetchGSCData: Error message:', error.message);
        }

        if (
            error.message.includes('token') ||
            error.message.includes('authenticate') ||
            error.message.includes('credentials')
        ) {
            throw new Error('Authentication failed or token issue during data fetch.');
        } else if (
            error.code === 403 ||
            error.message.includes('forbidden') ||
            error.message.includes('permission')
        ) {
            throw new Error(
                `Permission denied for fetching data from ${siteUrl}. Check Search Console API permissions.`
            );
        } else if (error.code === 429 || error.message.includes('quota')) {
            throw new Error('GSC API quota exceeded. Please try again later.');
        } else if (
            error.code === 400 ||
            error.message.includes('Invalid') ||
            error.message.includes('invalid')
        ) {
            throw new Error(`Invalid request parameters for GSC API: ${error.message}`);
        }

        throw new Error(`Failed to fetch GSC report data: ${error.message || 'Unknown API error'}`);
    }
};