// backend/src/services/geminiService.js
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
let genAI;
let model;

if (!API_KEY) {
    console.warn("Gemini API Key (GEMINI_API_KEY) not found. Gemini service disabled.");
} else {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash", // Or "gemini-pro"
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
        generationConfig: {
            temperature: 0.2,
        }
    });
    console.log("Gemini Service: Initialized with model and config.");
}

// --- Updated Prompt Template ---
const generatePrompt = (query) => `
Analyze the user search intent and assign a primary content category for the following search query.

Follow these instructions STRICTLY:
1. Determine the most likely user intent. Be concise and specific to the query's goal. Examples of intents include:
   - Seek detailed instructions (e.g., "how to install a smart doorbell" → Learn step-by-step installation).
   - Understand concepts or clarify information (e.g., "what is a 5ghz smart plug" → Grasp functionality or purpose).
   - Evaluate options or recommendations (e.g., "best doorbell camera 2025" → Identify top-rated products).
   - Verify specific facts or eligibility (e.g., "is ring alarm insurance approved uk" → Confirm insurance compatibility).
   - Troubleshoot issues (e.g., "why won’t my smart plug connect" → Resolve connectivity problems).
   - Compare products or features (e.g., "ring vs nest doorbell" → Assess differences between options).
   - Seek inspiration or trends (e.g., "smart home ideas 2025" → Discover innovative setups).
   - Locate resources or services (e.g., "smart lock installation near me" → Find local providers).
   - Check status or updates (e.g., "latest ring firmware update" → Get current version details).
2. Assign ONE primary content category from this list: [Guide, Explainer, Blog].
   - Guide: Queries seeking step-by-step instructions or detailed procedures (e.g., "how to install a smart doorbell" → Intent: Learn step-by-step installation).
   - Explainer: Queries asking for definitions, clarifications, or specific information (e.g., "is ring alarm insurance approved uk" → Intent: Confirm insurance compatibility).
   - Blog: Queries looking for reviews, recommendations, or general discussions (e.g., "best doorbell camera" → Intent: Identify top-rated products).
3. If intent is unclear, default to Blog.
4. Provide the response ONLY in valid JSON format with keys "intent" (string) and "category" (string). Do NOT include any other text, explanations, or markdown formatting like \`\`\`json.
Query: "${query}"

JSON Response:
`;

/**
 * Analyzes a single search query using the Gemini API.
 * @param {string} query The search query to analyze.
 * @returns {Promise<{intent: string, category: string} | {intent: string, category: string, error: boolean}>} Analysis object or error object. Returns null if service disabled.
 */
export const analyzeQueryIntent = async (query) => {
    if (!model) {
        console.warn("analyzeQueryIntent: Gemini service not initialized.");
        return null; // Service disabled
    }
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        console.warn("analyzeQueryIntent: Invalid query provided.");
        // Return an error structure consistent with other failures
        return { intent: 'Invalid Query', category: 'Error', error: true };
    }

    const prompt = generatePrompt(query);
    // console.log(`analyzeQueryIntent: Analyzing query "${query}"`); // Reduce log noise

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;

        // Check for safety blocks before accessing text()
        if (!response || response.promptFeedback?.blockReason) {
            const blockReason = response?.promptFeedback?.blockReason || 'Unknown';
            const safetyRatings = response?.promptFeedback?.safetyRatings || [];
            console.warn(`analyzeQueryIntent: Response blocked for query "${query}". Reason: ${blockReason}`, safetyRatings);
            return { intent: 'Blocked by Safety Filter', category: 'Blocked', error: true, blockReason };
        }

        const jsonText = response.text().trim();
        // console.log(`analyzeQueryIntent: Raw Gemini response for "${query}":`, jsonText); // Reduce log noise

        // Attempt to parse the JSON response
        try {
            const cleanedJsonText = jsonText.replace(/^```json\s*|```$/g, '').trim();
            const analysis = JSON.parse(cleanedJsonText);

            if (typeof analysis.intent === 'string' && typeof analysis.category === 'string') {
                // console.log(`analyzeQueryIntent: Successfully parsed analysis for "${query}"`); // Reduce log noise
                return analysis; // Success
            } else {
                console.error(`analyzeQueryIntent: Parsed JSON for "${query}" missing keys. Parsed:`, analysis);
                return { intent: 'Parsing Error', category: 'Invalid Format', error: true };
            }
        } catch (parseError) {
            console.error(`analyzeQueryIntent: Failed to parse JSON response for query "${query}". Error: ${parseError}. Response Text:`, jsonText);
            return { intent: 'Parsing Error', category: 'Invalid JSON', error: true };
        }

    } catch (error) {
        console.error(`analyzeQueryIntent: Error calling Gemini API for query "${query}":`, error.message || error);
        // Check for specific error types if possible (e.g., rate limit)
        if (error.message && error.message.includes('429')) {
            return { intent: 'API Error', category: 'Rate Limit', error: true };
        }
        // Log full error for debugging if needed
        // console.error('Gemini API Error Details:', error);
        return { intent: 'API Error', category: 'Unknown', error: true }; // General API error
    }
};