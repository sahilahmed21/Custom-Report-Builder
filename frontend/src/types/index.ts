// frontend/src/types/index.ts
export interface Metric {
    id: string; // e.g., 'metric-clicks'
    name: string; // e.g., 'Clicks'
    apiName: string; // e.g., 'clicks' - The actual name GSC API returns
}

export interface TimeRangeOption {
    value: string; // e.g., 'LAST_7_DAYS', 'CUSTOM'
    label: string;
}

export interface GscProperty {
    siteUrl: string; // e.g., 'sc-domain:example.com' or 'https://example.com/'
    permissionLevel: string; // e.g., 'siteOwner', 'siteFullUser'
}

// Interface for the report data rows (adapt based on actual GSC API response)
export interface ReportRow {
    keys?: string[]; // GSC API might return rows without keys in some cases
    query?: string; // Added for easier access after mapping
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    geminiCategory?: string;
    geminiIntent?: string;
    isSampled?: boolean; // Flag to indicate if Gemini analysis was performed
}

// Add other shared types here