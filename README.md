# Serprisingly Report Builder

A full-stack web application allowing users to connect their Google Search Console (GSC) account, select metrics and time ranges, and generate custom reports enriched with AI-driven intent and category analysis using the Google Gemini API. This project focuses on analyzing the Top N queries for efficiency and API limit management.

**Live Demo:** [Link to your deployed Vercel frontend] *(Replace with your actual link)*
**Backend API:** [Link to your deployed Render backend] *(Replace with your actual link)*

<!-- ![Screenshot of Serprisingly Report Builder](./path/to/screenshot.png) -->
*Add a screenshot here if possible*

## Features

*   **Secure Google OAuth 2.0:** Securely authenticate users via Google and access their GSC data. Handles token refresh.
*   **GSC Property Selection:** Allows users to choose which verified GSC property to report on.
*   **Drag-and-Drop Interface:** Users can select desired metrics (Clicks, Impressions, CTR, Position) combined with time periods (L7D, L28D, L3M) by dragging blocks.
*   **Multi-Period Data Fetching:** Fetches GSC data concurrently for all selected time periods.
*   **Top N Query Analysis:** Filters and ranks fetched queries, focusing analysis on a user-selected Top N (10, 25, 50, or 100) based on clicks.
*   **Gemini AI Integration:**
    *   Analyzes user search intent for the Top N queries.
    *   Assigns a content category (Guide, Explainer, Blog) to the Top N queries.
    *   Uses a hybrid approach: analyzes the first 10 queries immediately for quick results, then processes the rest (up to Top N) in the background.
*   **Progressive Loading:** Displays initial analysis results quickly while background analysis continues, with UI updates as more results become available.
*   **Dynamic Report Table:** Displays merged GSC data and AI analysis results for the Top N queries. Includes sorting and client-side filtering.
*   **Data Export:**
    *   Export displayed report data (Top N analyzed) to CSV.
    *   Export displayed report data (Top N analyzed) to Google Sheets (requires user authorization).
*   **View All GSC Data:** Option to navigate to a separate view showing all fetched GSC data (before Top N filtering/analysis).
*   **Caching:** Uses Upstash Redis for caching GSC API responses, Gemini analysis results, and job status tracking.
*   **Rate Limiting:** Implements throttling and concurrency limits on the backend to respect Gemini API free tier limits.

## Tech Stack

**Frontend:**

*   Next.js (v14+ with App Router likely, based on `page.tsx`)
*   React (v18+)
*   TypeScript
*   Tailwind CSS
*   shadcn/ui (or similar component library)
*   Recharts (for charts)
*   dnd-kit (for drag and drop)
*   gapi-script (for Google Sheets export)
*   papaparse (for CSV export)
*   file-saver (for triggering downloads)

**Backend:**

*   Node.js
*   Express.js
*   TypeScript (implied, using ES Modules)
*   `googleapis` (for Google OAuth & GSC API)
*   `@google/generative-ai` (for Gemini API)
*   `@upstash/redis` (for caching & job status)
*   `p-limit` (for concurrency control)
*   `uuid` (for job IDs)
*   `cors`, `dotenv`

**Database/Cache:**

*   Upstash Redis

## Project Structure

custom-report-builder/
├── frontend/
│ ├── components/ # Reusable UI components (AuthButton, ReportTable, etc.)
│ │ └── ui/ # shadcn/ui components
│ ├── public/ # Static assets (favicon, images)
│ ├── src/ # Source code (if using src dir)
│ │ └── app/ # Next.js App Router structure
│ │ ├── page.tsx # Main application page component
│ │ ├── full-report/page.tsx # Page for viewing all GSC data
│ │ └── layout.tsx # Root layout
│ ├── hooks/ # Custom React hooks (useReportConfig)
│ ├── types/ # TypeScript type definitions (index.ts)
│ ├── utils/ # Utility functions (dateUtils, numberFormatting, etc.)
│ ├── styles/ # Global styles, Tailwind input
│ ├── .env.local # Frontend environment variables (DO NOT COMMIT)
│ ├── next.config.js # Next.js configuration (headers for COOP/COEP/CSP)
│ ├── vercel.json # Vercel deployment configuration (headers)
│ ├── tailwind.config.js # Tailwind configuration
│ ├── tsconfig.json # TypeScript configuration
│ └── package.json # Frontend dependencies
├── backend/
│ ├── src/
│ │ ├── controllers/ # Request handlers (auth, gsc, gemini)
│ │ ├── routes/ # API route definitions (auth, gsc, gemini)
│ │ ├── services/ # API client logic (gscService, geminiService)
│ │ ├── utils/ # Utilities (cache, sleep)
│ │ └── config/ # Configuration (db connection)
│ ├── .env # Backend environment variables (DO NOT COMMIT)
│ ├── server.js # Express server entry point
│ └── package.json # Backend dependencies
├── .gitignore # Files/folders to ignore in Git
└── README.md # This file

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn
*   Git
*   Google Cloud Platform Account:
    *   Enable Google Search Console API.
    *   Enable Google Sheets API.
    *   Enable Gemini API (Generative Language API).
    *   Create **two** OAuth 2.0 Client IDs (Type: Web Application):
        *   One for the **Backend** (Server-side flow): Note its Client ID and Client Secret. Configure its Authorized Redirect URI.
        *   One for the **Frontend** (Client-side flow for Sheets): Note its Client ID. Configure its Authorized JavaScript Origins.
    *   Create an API Key (for Gemini API). Restrict it if possible.
*   Upstash Account: Create a Redis database and get the URL and Token.

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd custom-report-builder
    ```

2.  **Backend Setup:**
    *   Navigate to the backend directory: `cd backend`
    *   Create a `.env` file by copying `.env.example` (if provided) or creating it manually. Add the following variables:
        ```dotenv
        # Google OAuth Credentials (for Backend Login Flow)
        GOOGLE_CLIENT_ID=YOUR_BACKEND_GOOGLE_CLIENT_ID
        GOOGLE_CLIENT_SECRET=YOUR_BACKEND_GOOGLE_CLIENT_SECRET
        # IMPORTANT: Use deployed URLs when deploying!
        REDIRECT_URI=http://localhost:5000/auth/callback # Or https://your-backend.onrender.com/auth/callback

        # Gemini API Key
        GEMINI_API_KEY=YOUR_GEMINI_API_KEY

        # Upstash Redis Credentials
        UPSTASH_REDIS_URL=YOUR_UPSTASH_REDIS_URL
        UPSTASH_REDIS_TOKEN=YOUR_UPSTASH_REDIS_TOKEN

        # Server Port
        PORT=5000

        # Frontend URL (for CORS and redirects)
        # IMPORTANT: Use deployed URL when deploying!
        FRONTEND_URL=http://localhost:3000 # Or https://your-frontend.vercel.app
        ```
    *   Install dependencies: `npm install`
    *   Run the backend server: `npm start`
        *   The backend should be running on `http://localhost:5000` (or the specified `PORT`).

3.  **Frontend Setup:**
    *   Navigate to the frontend directory: `cd ../frontend`
    *   Create a `.env.local` file. Add the following variables:
        ```dotenv
        # URL of the running backend server
        # IMPORTANT: Use deployed URL when deploying!
        NEXT_PUBLIC_BACKEND_URL=http://localhost:5000 # Or https://your-backend.onrender.com

        # Google OAuth Client ID (for Frontend GAPI/Sheets Flow)
        NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_FRONTEND_GOOGLE_CLIENT_ID

        # Optional: Google API Key (if needed by GAPI, usually not for OAuth flows)
        # NEXT_PUBLIC_GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
        ```
    *   Install dependencies: `npm install`
    *   Run the frontend development server: `npm run dev`
        *   The frontend should be running on `http://localhost:3000`.

### Running the Application

1.  Ensure both the backend and frontend servers are running.
2.  Open your browser and navigate to `http://localhost:3000`.
3.  Click the "Login with Google" button and follow the OAuth flow.
4.  Select a GSC property.
5.  Drag desired metrics from "Available Metrics" to "Selected Metrics".
6.  Configure Analysis Options (Top N, Keyword Filter).
7.  Click "Generate Report".
8.  View the initial results and wait for background analysis to complete (monitor progress bar).
9.  Use the table filter, export options, or view all GSC data.

## Deployment

*   **Backend:** Deployed to Render (or similar Node.js hosting). Configure all environment variables from the `.env` file in the Render service settings. Ensure the `REDIRECT_URI` points to the deployed Render URL.
*   **Frontend:** Deployed to Vercel (or similar Next.js hosting). Configure `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` environment variables in Vercel settings. Ensure `vercel.json` and `next.config.js` include the necessary COOP/COEP/CSP headers, updating URLs in the CSP directive.
*   **Google Cloud Console:** Update **Authorized JavaScript origins** and **Authorized redirect URIs** for *both* OAuth Client IDs to include your deployed Vercel and Render URLs respectively.

## How It Works

![System Architecture and Data Flow](/frontend/public/image.png)
*System architecture and data flow diagram showing the complete process from authentication to report generation*

1. **Authentication Flow**
   - User initiates login through the frontend interface
   - Backend handles OAuth2 flow via `/auth/login` endpoint
   - After Google consent, tokens are securely stored in Redis
   - Frontend receives success status and verifies via `/auth/status`

2. **Property & Metrics Selection**
   - User sees list of GSC properties from `/gsc/properties`
   - Interactive drag-and-drop interface for metric selection
   - Supports multiple time periods (L7D, L28D, L3M)
   - Configurable Top N selection (10, 25, 50, 100 queries)

3. **Data Processing Pipeline**
   - Parallel fetching of GSC data for all selected periods
   - Smart caching system using Redis to minimize API calls
   - Client-side data merging and ranking algorithms
   - Efficient Top N query filtering based on click metrics

4. **AI Analysis System**
   - Two-phase analysis approach:
     1. Fast Track: Immediate analysis of top 10 queries
     2. Background Track: Processes remaining queries (up to Top N)
   - Intelligent caching of analysis results
   - Rate limiting to respect Gemini API constraints
   - Real-time job status tracking via Redis

5. **Progressive UI Updates**
   - Immediate display of initial analysis results
   - Background polling system using:
     - `/gemini/job-progress/:jobId` for status
     - `/gemini/get-analysis-batch` for new results
   - Dynamic progress bar updates
   - Smooth table updates as new data arrives

6. **Export Capabilities**
   - CSV Export: Direct download using papaparse
   - Google Sheets Export:
     - Separate OAuth flow for Sheets API
     - Automatic formatting and column setup
     - Maintains data integrity during export

## Future Improvements

1. **Performance Optimizations**
   - Implement true background job processing using Upstash QStash
   - Add request caching layers for frequently accessed data
   - Optimize database queries and Redis operations

2. **Enhanced Analytics**
   - Add advanced query clustering algorithms
   - Implement trend analysis and forecasting
   - Include competitor analysis features
   - Add custom metric calculations

3. **User Experience**
   - Custom date range selector
   - Saved report templates
   - Batch export functionality
   - Real-time collaboration features
   - Dark mode support

4. **Data Visualization**
   - Interactive trend charts
   - Query performance heat maps
   - Custom dashboard layouts
   - Exportable visual reports

5. **Security & Compliance**
   - Enhanced rate limiting
   - Data retention policies
   - GDPR compliance features
   - Audit logging system

6. **Integration Options**
   - API endpoint for external tools
   - Webhook support for notifications
   - Integration with popular analytics platforms
   - Custom API key management
