// backend/src/services/geminiService.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.warn("Gemini API Key (GEMINI_API_KEY) not found in environment variables. Gemini service will be disabled.");
    // Optionally throw an error if Gemini is critical:
    // throw new Error("Gemini API Key is required.");
}

let genAI;
let model;

// Initialize only if API key exists
if (API_KEY) {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({
        model: "gemini-pro", // Or consider "gemini-1.5-flash" for speed/cost if available/suitable
        // --- Safety Settings ---
        // Adjust these based on your content policies. Stricter settings might block more responses.
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
        // --- Generation Config --- (Optional)
        // generationConfig: {
        //     temperature: 0.7, // Controls randomness (0=deterministic, 1=max random)
        //     maxOutputTokens: 100, // Limit response length
        // }
    });
    console.log("Gemini Service: Initialized with model 'gemini-pro'.");
} else {
    console.log("Gemini Service: Not initialized due to missing API key.");
}

// --- Prompt Template ---
const generatePrompt = (query) => `
Analyze the user search intent and assign a primary category for the following search query.

Follow these instructions STRICTLY:
1. Determine the most likely user intent (e.g., Find information, Compare products, Navigate to site, Purchase item, Learn how-to, Find location, Check status).
2. Assign ONE primary category from this list: [Informational, Navigational, Transactional, Commercial Investigation, Local].
3. Provide the response ONLY in valid JSON format with keys "intent" (string) and "category" (string). Do NOT include any other text, explanations, or markdown formatting.

Query: "${query}"

JSON Response:
`;


/**
 * Analyzes a single search query using the Gemini API.
 * @param {string} query The search query to analyze.
 * @returns {Promise<{intent: string, category: string} | null>} Analysis object or null on error/disabled.
 */
export const analyzeQueryIntent = async (query) => {
    // Return null immediately if the service isn't initialized
    if (!model) {
        console.warn("analyzeQueryIntent: Gemini service not initialized. Skipping analysis.");
        return null;
    }
    // Basic input validation
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        console.warn("analyzeQueryIntent: Invalid query provided.");
        return null;
    }

    const prompt = generatePrompt(query);
    console.log(`analyzeQueryIntent: Analyzing query "${query}"`); // Be mindful of logging PII if queries are sensitive

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().trim();

        console.log(`analyzeQueryIntent: Raw Gemini response for "${query}":`, jsonText); // Log raw response

        // Attempt to parse the JSON response
        try {
            // Handle potential markdown code block ```json ... ```
            const cleanedJsonText = jsonText.replace(/^```json\s*|```$/g, '').trim();
            const analysis = JSON.parse(cleanedJsonText);

            // Validate expected keys
            if (typeof analysis.intent === 'string' && typeof analysis.category === 'string') {
                console.log(`analyzeQueryIntent: Successfully parsed analysis for "${query}":`, analysis);
                return analysis;
            } else {
                console.error(`analyzeQueryIntent: Parsed JSON for "${query}" is missing required keys ('intent', 'category'). Parsed:`, analysis);
                return { intent: 'Parsing Error', category: 'Parsing Error' }; // Return error object
            }
        } catch (parseError) {
            console.error(`analyzeQueryIntent: Failed to parse JSON response from Gemini for query "${query}". Error: ${parseError}. Response Text:`, jsonText);
            return { intent: 'Parsing Error', category: 'Parsing Error' }; // Indicate parsing failure
        }

    } catch (error) {
        console.error(`analyzeQueryIntent: Error calling Gemini API for query "${query}":`, error.message || error);
        // Check for specific safety blocks or other API errors
        if (error.message && error.message.includes('response was blocked')) {
            return { intent: 'Blocked by Safety Filter', category: 'Blocked' };
        }
        // Add more specific error handling (e.g., quota) if needed
        return { intent: 'API Error', category: 'API Error' }; // Indicate generic API failure
    }
};