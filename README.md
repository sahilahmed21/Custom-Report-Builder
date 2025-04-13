# Custom Report Builder

## Overview

This project is a web application designed to allow users to create custom reports using data from Google Search Console (GSC). It features a drag-and-drop interface for selecting metrics and time ranges, integrates with the Gemini API for query intent analysis, and allows users to visualize and export the generated reports.

The application is built with a separated frontend and backend architecture.

## Key Features

*   **Google Search Console Integration:** Securely authenticate with GSC using OAuth 2.0.
*   **Drag-and-Drop Interface:** Easily select GSC metrics (Clicks, Impressions, CTR, Position) and time ranges to build custom report configurations.
*   **Gemini API Enrichment:** Analyze GSC queries to determine user intent and categorize them using Google's Gemini API.
*   **Report Visualization:** Display the combined GSC data and Gemini insights in a clear, sortable table.
*   **Data Export:** Export the generated report data to CSV format (with potential for Google Sheets integration).
*   **Caching:** Uses Upstash Redis for caching GSC tokens and API responses to improve performance and reduce API calls.

## Tech Stack

*   **Frontend:** Next.js, React, TailwindCSS, `@hello-pangea/dnd` (or `dnd-kit`)
*   **Backend:** Node.js, Express
*   **Authentication:** Google OAuth 2.0
*   **APIs:** Google Search Console API, Gemini API
*   **Database/Cache:** Upstash Redis
*   **Deployment (Optional):** Docker, AWS/Azure

## Project Structure

The project is organized into two main directories:

*   `frontend/`: Contains the Next.js application responsible for the user interface, drag-and-drop functionality, and report visualization.
*   `backend/`: Contains the Node.js/Express application responsible for handling GSC authentication, fetching data from GSC, interacting with the Gemini API, and managing caching.
