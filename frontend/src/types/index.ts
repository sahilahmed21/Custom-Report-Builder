// frontend/src/types/index.ts

export interface Metric {
    id: string; // e.g., 'metric-clicks-l28d'
    name: string; // e.g., 'Clicks L28D'
    apiName: string; // e.g., 'clicks' - The actual GSC API metric name
    timePeriod: string; // e.g., 'L28D', 'L3M' - Identifier for the period
}

export interface GscProperty {
    siteUrl: string;
    permissionLevel: string;
}

// Represents RAW data from ONE GSC fetch for a specific period.
export interface ReportRow {
    keys?: string[];
    query?: string; // Added for easier access after mapping
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}
export interface PropertySelectorProps {
    properties: GscProperty[];
    selectedProperty: string | null;
    onSelect: (property: string | null) => void;
    isLoading: boolean;
    error: string | null;
}

// Type for the merged data displayed in the table
// Allows dynamic metric keys and requires query to be a string
export interface DisplayRow {
    query: string; // Query is guaranteed after merging/filtering
    // Index signature for dynamic metric keys like 'clicks_L28D'
    [metricKey: string]: string | number | boolean | undefined;
    // Static AI columns (optional because they might not be analyzed yet)
    geminiCategory?: string;
    geminiIntent?: string;
    isSampled?: boolean; // Flag if this query's intent was analyzed
}