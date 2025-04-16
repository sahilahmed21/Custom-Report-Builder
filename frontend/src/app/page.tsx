// frontend/src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

// UI Components
import { CategoryDistributionChart } from '../components/CategoryDistributionChart';
import AuthButton from '../components/AuthButton';
import { PropertySelector } from '../components/PropertySelector';
import { DraggableMetric } from '../components/DraggableMetric';
import { DroppableArea } from '../components/DroppableArea';
import { ReportTable } from '../components/ReportTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X, AlertCircle, Download, Settings2, BarChartHorizontalBig, Loader2, Search, ListChecks, Clock, FileSpreadsheet, Info, Globe } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter, DragEndEvent } from '@dnd-kit/core';

// Hooks & Utils
import { useReportConfig } from '../hooks/useReportConfig ';
import { getDateRange } from '../utils/dateUtils';
import { Metric, GscProperty, ReportRow, DisplayRow } from '../types';
// import { formatNumber } from '../utils/numberFormatting';

// --- Constants ---
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const DEFAULT_TOP_N = '100';
const POLLING_INTERVAL_MS = 5000;
const IMMEDIATE_BATCH_SIZE = 10;

// --- Google API Config ---
const GAPI_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GAPI_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const GAPI_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// Add TypeScript declarations for GAPI
declare global {
    interface Window {
        gapi: {
            load: (service: string, callback: { callback: () => void; onerror: () => void; timeout: number; ontimeout: () => void; }) => void;
            client: {
                init: (config: Record<string, string>) => Promise<void>;
                sheets: {
                    spreadsheets: {
                        create: (params: {
                            resource: {
                                properties: {
                                    title: string;
                                };
                                sheets: Array<{
                                    properties: {
                                        title: string;
                                        gridProperties: {
                                            rowCount: number;
                                            columnCount: number;
                                        };
                                    };
                                }>;
                            };
                        }) => Promise<GapiSpreadsheetResponse>;
                        values: {
                            update: (params: {
                                spreadsheetId: string;
                                range: string;
                                valueInputOption: string;
                                resource: {
                                    values: Array<Array<string | number | null>>;
                                };
                            }) => Promise<unknown>;
                        };
                    };
                };
            };
            auth2: {
                getAuthInstance: () => {
                    signIn: (options: { scope: string; prompt: string; }) => Promise<void>;
                    isSignedIn: { get: () => boolean };
                    currentUser: { get: () => { hasGrantedScopes: (scope: string) => boolean } };
                };
            };
        };
    }
}

type GapiSpreadsheetResponse = {
    result: {
        spreadsheetId: string;
        spreadsheetUrl: string;
    };
};

// type GapiError = {
//     error: string;
//     details?: string;
// };

// type FetchError = {
//     message: string;
//     status?: number;
//     details?: string;
// };

type GapiErrorResponse = {
    error: string;
    details?: string;
    status?: number;
};

export default function Home() {
    // --- Core States ---
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
    const [gscProperties, setGscProperties] = useState<GscProperty[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
    const [isLoadingProperties, setIsLoadingProperties] = useState<boolean>(false);
    const [propertyError, setPropertyError] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [isGapiLoaded, setIsGapiLoaded] = useState(false);
    const [isGapiInitializing, setIsGapiInitializing] = useState(false);
    const [isExportingSheet, setIsExportingSheet] = useState(false);

    // --- Report Generation States ---
    const [rawMergedGscData, setRawMergedGscData] = useState<Map<string, Partial<DisplayRow>> | null>(null);
    const [topNQueryData, setTopNQueryData] = useState<Partial<DisplayRow>[]>([]);
    const [analyzedResultsMap, setAnalyzedResultsMap] = useState<Map<string, { intent: string; category: string }>>(new Map());
    const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
    const [isAnalyzingBackground, setIsAnalyzingBackground] = useState<boolean>(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>('');

    // --- Filtering & Config States ---
    const [keywordFilter, setKeywordFilter] = useState<string>('');
    const [topNCount, setTopNCount] = useState<string>(DEFAULT_TOP_N);

    // --- Background Job States ---
    const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
    const [jobProgress, setJobProgress] = useState<{ total: number; completed: number; status: string; error?: string } | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // --- Hooks ---
    const { availableMetrics, selectedMetrics, handleDragEnd: handleDragEndFromHook, removeSelectedMetric } = useReportConfig();
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
    const router = useRouter();

    // --- Memoized Fetch Properties ---
    const fetchProperties = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoadingProperties(true);
        setPropertyError(null);
        try {
            const response = await fetch(`${BACKEND_URL}/gsc/properties`, { credentials: 'include' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
                throw new Error(errorData.error || 'Failed to fetch properties');
            }
            const data: GscProperty[] = await response.json();
            setGscProperties(data);
            if (data.length > 0 && !selectedProperty) {
                setSelectedProperty(data[0].siteUrl);
            } else if (data.length === 0) {
                setPropertyError("No GSC properties found for this account.");
            }
        } catch (error: unknown) {
            console.error('Error fetching properties:', error);
            setPropertyError(error instanceof Error ? error.message : 'Failed to load properties');
        } finally {
            setIsLoadingProperties(false);
        }
    }, [isAuthenticated, selectedProperty]);

    // --- Effects ---
    // Detect Client-Side Rendering
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Auth Check
    useEffect(() => {
        const checkAuth = async () => {
            setIsLoadingAuth(true);
            try {
                const response = await fetch(`${BACKEND_URL}/auth/status`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setIsAuthenticated(data.isAuthenticated);
                } else {
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error('Auth check fetch error:', error);
                setIsAuthenticated(false);
            } finally {
                setIsLoadingAuth(false);
            }
        };
        checkAuth();
    }, []); // Removed BACKEND_URL

    // Properties & Reset on Auth Change
    useEffect(() => {
        if (isAuthenticated) {
            fetchProperties();
        } else {
            setGscProperties([]);
            setSelectedProperty(null);
            setRawMergedGscData(null);
            setTopNQueryData([]);
            setAnalyzedResultsMap(new Map());
            setPropertyError(null);
            setIsLoadingReport(false);
            setIsAnalyzingBackground(false);
            setReportError(null);
            setLoadingMessage('');
            setAnalysisJobId(null);
            setJobProgress(null);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        }
    }, [isAuthenticated, fetchProperties]);

    // Polling Effect for Background Job
    useEffect(() => {
        if (!analysisJobId || !isAnalyzingBackground) {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            return;
        }

        const pollStatusAndResults = async () => {
            console.log(`[Job ${analysisJobId}] Polling status & results...`);
            let currentStatus = 'running';
            let shouldStopPolling = false;

            try {
                // Fetch Job Progress
                const statusResponse = await fetch(`${BACKEND_URL}/gemini/job-progress/${analysisJobId}`, { credentials: 'include' });
                if (!statusResponse.ok) {
                    if (statusResponse.status === 404) {
                        console.warn(`[Job ${analysisJobId}] Job status 404. Assuming completed or expired.`);
                        setReportError("Background analysis job not found. It might have finished or expired.");
                        shouldStopPolling = true;
                    } else {
                        throw new Error(`Failed to fetch job status (${statusResponse.status})`);
                    }
                } else {
                    const statusData = await statusResponse.json();
                    if (statusData && statusData.progress) {
                        console.log(`[Job ${analysisJobId}] Received status:`, statusData.progress);
                        setJobProgress(statusData.progress);
                        currentStatus = statusData.progress.status;
                        if (currentStatus === 'completed' || currentStatus === 'failed') {
                            shouldStopPolling = true;
                            if (currentStatus === 'failed') {
                                setReportError(`Background analysis failed: ${statusData.progress.error || 'Unknown reason'}`);
                            }
                        }
                    } else {
                        console.warn(`[Job ${analysisJobId}] Invalid status data received.`);
                    }
                }

                // Fetch Results Batch
                const queriesToFetch = topNQueryData.map(item => item.query).filter(q => typeof q === 'string') as string[];
                if (queriesToFetch.length > 0) {
                    const resultsResponse = await fetch(`${BACKEND_URL}/gemini/get-analysis-batch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ queries: queriesToFetch }),
                        credentials: 'include',
                    });
                    if (resultsResponse.ok) {
                        const resultsBatch = await resultsResponse.json();
                        setAnalyzedResultsMap(prevMap => {
                            const newMap = new Map(prevMap);
                            let updatedCount = 0;
                            Object.entries(resultsBatch).forEach(([query, analysis]) => {
                                if (!newMap.has(query)) {
                                    newMap.set(query, analysis as { intent: string; category: string });
                                    updatedCount++;
                                }
                            });
                            if (updatedCount > 0) console.log(`[Job ${analysisJobId}] Updated map with ${updatedCount} new results.`);
                            return newMap;
                        });
                    } else {
                        console.error(`[Job ${analysisJobId}] Failed to fetch results batch (${resultsResponse.status})`);
                    }
                }
            } catch (error: Error | unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[Job ${analysisJobId}] Error during polling:`, error);
                setReportError(errorMessage || 'Error checking analysis progress');
                shouldStopPolling = true;

            } finally {
                if (shouldStopPolling) {
                    console.log(`[Job ${analysisJobId}] Stopping polling.`);
                    setIsAnalyzingBackground(false);
                    setAnalysisJobId(null);
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                }
            }
        };

        pollStatusAndResults();
        pollingIntervalRef.current = setInterval(pollStatusAndResults, POLLING_INTERVAL_MS);

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                console.log(`[Job ${analysisJobId}] Cleared polling interval on unmount/dependency change.`);
            }
        };
    }, [analysisJobId, isAnalyzingBackground, topNQueryData]);

    // Effect to load Google API Client Library (Client-Side Only)
    useEffect(() => {
        if (!isClient || isGapiLoaded || isGapiInitializing) {
            return;
        }
        if (!GAPI_CLIENT_ID) {
            console.warn("Google Client ID for GAPI not found (NEXT_PUBLIC_GOOGLE_CLIENT_ID). Sheets export disabled.");
            return;
        }
        setIsGapiInitializing(true);
        console.log("Attempting to load GAPI client...");
        const loadGapi = async () => {
            try {
                const gapi = await import('gapi-script').then(module => module.gapi);
                window.gapi = gapi;
                await new Promise((resolve, reject) => {
                    gapi.load('client:auth2', {
                        callback: resolve,
                        onerror: reject,
                        timeout: 10000,
                        ontimeout: reject
                    });
                });
                await gapi.client.init({
                    apiKey: GAPI_API_KEY,
                    clientId: GAPI_CLIENT_ID,
                    scope: GAPI_SHEETS_SCOPE,
                    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
                });
                console.log("GAPI client initialized successfully");
                setIsGapiLoaded(true);
                const googleAuth = gapi.auth2.getAuthInstance();
                if (googleAuth?.isSignedIn?.get() &&
                    googleAuth.currentUser?.get()?.hasGrantedScopes(GAPI_SHEETS_SCOPE)) {
                    console.log("Sheets scope already granted.");
                }
            } catch (error) {
                console.error("Error loading GAPI:", error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                setReportError("Failed to load Google API client: " + errorMessage);
            } finally {
                setIsGapiInitializing(false);
            }
        };
        loadGapi();
    }, [isClient, isGapiLoaded, isGapiInitializing]);

    // --- Handlers ---
    const handleLogout = async () => {
        try {
            await fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => handleDragEndFromHook(event);

    // --- Main Report Generation Logic ---
    const handleGenerateReport = async () => {
        if (!selectedProperty || selectedMetrics.length === 0 || isLoadingReport || isAnalyzingBackground || !BACKEND_URL) return;

        // Reset States
        setRawMergedGscData(null);
        setTopNQueryData([]);
        setAnalyzedResultsMap(new Map());
        setReportError(null);
        setIsLoadingReport(true);
        setIsAnalyzingBackground(false);
        setLoadingMessage('Fetching GSC data...');
        setJobProgress(null);
        setAnalysisJobId(null);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

        try {
            // Fetch and Merge GSC Data
            const uniqueTimePeriods = Array.from(new Set(selectedMetrics.map(m => m.timePeriod)));
            if (uniqueTimePeriods.length === 0) throw new Error("No time periods selected.");

            const fetchPromises = uniqueTimePeriods.map(async (timePeriod) => {
                const dateRange = getDateRange(timePeriod);
                if (!dateRange) throw new Error(`Invalid time period: ${timePeriod}`);
                const requestBody = {
                    siteUrl: selectedProperty,
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    dimensions: ['query'],
                };
                const response = await fetch(`${BACKEND_URL}/gsc/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(requestBody),
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
                    throw new Error(`GSC fetch failed for ${timePeriod}: ${errorData.error || response.statusText}`);
                }
                const resultData: ReportRow[] = await response.json();
                return { timePeriod, data: resultData };
            });

            const results = await Promise.allSettled(fetchPromises);
            const mergedData = new Map<string, Partial<DisplayRow>>();
            const fetchErrors: string[] = []; // Changed to const
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    const { timePeriod, data } = result.value;
                    data.forEach(row => {
                        const query = row.keys?.[0];
                        if (query && typeof query === 'string') {
                            const currentEntry = mergedData.get(query) || { query: query };
                            currentEntry[`clicks_${timePeriod}`] = row.clicks;
                            currentEntry[`impressions_${timePeriod}`] = row.impressions;
                            currentEntry[`ctr_${timePeriod}`] = row.ctr;
                            currentEntry[`position_${timePeriod}`] = row.position;
                            mergedData.set(query, currentEntry);
                        }
                    });
                } else {
                    fetchErrors.push(result.reason?.message || `Failed fetch for one period.`);
                }
            });
            setRawMergedGscData(mergedData);
            if (fetchErrors.length > 0) {
                throw new Error(`GSC fetch errors: ${fetchErrors.join('; ')}`);
            }
            if (mergedData.size === 0) {
                setLoadingMessage('');
                setIsLoadingReport(false);
                setReportError("No data found in GSC for the selected criteria.");
                return;
            }

            // Filter, Rank, Select Top N
            setLoadingMessage('Processing data...');
            let allMergedDataArray = Array.from(mergedData.values());

            // Apply Keyword Filter
            if (keywordFilter.trim()) {
                const lowerKeyword = keywordFilter.trim().toLowerCase();
                allMergedDataArray = allMergedDataArray.filter(item => item.query?.toLowerCase().includes(lowerKeyword));
            }

            // Apply Min Clicks Filter (hardcoded to 1)
            const minClicks = 1;
            allMergedDataArray = allMergedDataArray.filter(item => {
                const clicks = item['clicks_L28D'] ?? item['clicks_L3M'] ?? 0;
                return (clicks as number) >= minClicks;
            });

            // Rank by primary click metric
            allMergedDataArray.sort((a, b) => {
                const clicksA = (a['clicks_L28D'] ?? a['clicks_L3M'] ?? 0) as number;
                const clicksB = (b['clicks_L28D'] ?? b['clicks_L3M'] ?? 0) as number;
                return clicksB - clicksA;
            });

            // Select Top N
            const selectedTopN = parseInt(topNCount, 10) || parseInt(DEFAULT_TOP_N, 10);
            const topNDataSlice = allMergedDataArray.slice(0, selectedTopN);
            setTopNQueryData(topNDataSlice);

            const queriesForHybridAnalysis = topNDataSlice.map(item => item.query).filter(q => typeof q === 'string') as string[];

            if (queriesForHybridAnalysis.length === 0) {
                setLoadingMessage('');
                setIsLoadingReport(false);
                setReportError("No queries remaining after filtering to send for analysis.");
                return;
            }

            // Hybrid Gemini Analysis
            setLoadingMessage(`Analyzing initial ${Math.min(queriesForHybridAnalysis.length, IMMEDIATE_BATCH_SIZE)} queries...`);
            console.log(`Frontend: Sending ${queriesForHybridAnalysis.length} queries to /gemini/analyze-top-n-hybrid`);

            const hybridResponse = await fetch(`${BACKEND_URL}/gemini/analyze-top-n-hybrid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ topNQueries: queriesForHybridAnalysis }),
            });

            if (!hybridResponse.ok && hybridResponse.status !== 202) {
                const errorData = await hybridResponse.json().catch(() => ({ error: `HTTP error ${hybridResponse.status}` }));
                throw new Error(`Failed to start analysis: ${errorData.error || hybridResponse.statusText}`);
            }

            const { jobId, initialResults } = await hybridResponse.json();
            console.log(`Frontend: Received initial results for ${Object.keys(initialResults || {}).length} queries. Job ID: ${jobId}`);

            if (initialResults) {
                setAnalyzedResultsMap(new Map(Object.entries(initialResults)));
            }

            const needsBackground = jobId && queriesForHybridAnalysis.length > IMMEDIATE_BATCH_SIZE;

            setIsLoadingReport(false);

            if (needsBackground) {
                setAnalysisJobId(jobId);
                setIsAnalyzingBackground(true);
                setLoadingMessage('Analyzing remaining queries in background...');
            } else {
                setLoadingMessage('');
                setIsAnalyzingBackground(false);
                if (!jobId && queriesForHybridAnalysis.length > IMMEDIATE_BATCH_SIZE) {
                    setReportError("Background analysis job failed to initialize.");
                }
            }
        } catch (error: Error | unknown) {
            console.error('Error during report generation process:', error);
            let message = 'An unknown error occurred.';
            if (error instanceof Error) {
                message = error.message;
            } else if (typeof error === 'string') {
                message = error;
            }
            setReportError(message);
            setIsLoadingReport(false);
            setIsAnalyzingBackground(false);
            setLoadingMessage('');
        }
    };  // End of handleGenerateReport

    // --- Derived State for Display ---
    const displayData = useMemo((): DisplayRow[] => {
        return topNQueryData.map(item => {
            const analysis = analyzedResultsMap.get(item.query as string);
            return {
                ...item,
                query: item.query as string,
                geminiIntent: analysis?.intent ?? 'Pending...',
                geminiCategory: analysis?.category ?? 'Pending...',
                isSampled: !!analysis,
            };
        });
    }, [topNQueryData, analyzedResultsMap]);

    // --- Export Handlers ---
    const handleExportCsv = () => {
        if (!displayData || displayData.length === 0) {
            alert("No data available to export.");
            return;
        }

        interface ExportHeader {
            key: string;
            label: string;
        }

        const headers: ExportHeader[] = [
            { key: 'query', label: 'Query' },
            { key: 'category', label: 'Category' },
            ...selectedMetrics.map((m: Metric) => ({ key: `${m.apiName}_${m.timePeriod}`, label: m.name })),
            { key: 'geminiCategory', label: 'Category (AI)' },
            { key: 'geminiIntent', label: 'Intent (AI)' },
        ];

        const csvData = displayData.map(row => {
            const rowData: Record<string, string | number | boolean | null> = {};
            headers.forEach(header => {
                if (header.key === 'category') {
                    rowData[header.label] = 'N/A';
                } else {
                    rowData[header.label] = row[header.key] ?? '';
                }
            });
            return rowData;


        });

        try {
            const csv = Papa.unparse(csvData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const date = new Date().toISOString().split('T')[0];
            saveAs(blob, `serprisingly_report_${selectedProperty}_${date}.csv`);
        } catch (err) {
            console.error("Error generating CSV:", err);
            setReportError("Failed to generate CSV file.");
        }
    };

    const handleExportToSheets = async () => {
        if (!displayData || displayData.length === 0) {
            alert("No analyzed data available to export.");
            return;
        }

        if (!isClient || !isGapiLoaded) {
            alert("Google API Client is not ready. Please wait and try again.");
            return;
        }

        setIsExportingSheet(true);
        setReportError(null);

        try {
            // Check if sheets API is available
            if (!window.gapi.client.sheets) {
                console.log("Sheets API not available");
                throw new Error("Google Sheets API not initialized properly");
            }

            const googleAuth = window.gapi.auth2.getAuthInstance();
            if (!googleAuth) {
                throw new Error("Google Auth instance not found.");
            }

            let currentUser = googleAuth.currentUser.get();

            if (!googleAuth.isSignedIn.get() || !currentUser.hasGrantedScopes(GAPI_SHEETS_SCOPE)) {
                console.log("Requesting Sheets scope...");
                await googleAuth.signIn({ scope: GAPI_SHEETS_SCOPE, prompt: 'consent' });
                currentUser = googleAuth.currentUser.get();
                if (!currentUser.hasGrantedScopes(GAPI_SHEETS_SCOPE)) {
                    throw new Error("Google Sheets permission not granted.");
                }
            }

            console.log("User authorized for Sheets API.");

            const headers = [
                'Query', 'Category',
                ...selectedMetrics.map(m => m.name),
                'Category (AI)', 'Intent (AI)'
            ];

            const values = displayData.map(row => {
                const rowData = [
                    row.query ?? '',
                    'N/A',
                ];
                selectedMetrics.forEach(m => {
                    const key = `${m.apiName}_${m.timePeriod}`;
                    const rawValue = row[key];
                    let formattedValue = '';
                    if (typeof rawValue === 'number') {
                        if (m.apiName === 'ctr') formattedValue = rawValue.toString();
                        else if (m.apiName === 'position') formattedValue = rawValue.toFixed(1);
                        else formattedValue = rawValue.toString();
                    }
                    rowData.push(formattedValue);
                });
                rowData.push(row.geminiCategory ?? '');
                rowData.push(row.geminiIntent ?? '');
                return rowData;
            });

            // Create the spreadsheet
            const resource = {
                properties: {
                    title: `Serprisingly Report - ${selectedProperty} - ${new Date().toISOString().split('T')[0]}`
                },
                sheets: [{
                    properties: {
                        title: 'Report Data',
                        gridProperties: {
                            rowCount: values.length + 1,
                            columnCount: headers.length
                        }
                    }
                }]
            };

            console.log("Creating spreadsheet...");
            const createResponse = await window.gapi.client.sheets.spreadsheets.create({
                resource: resource
            });

            if (!createResponse?.result?.spreadsheetId) {
                throw new Error("Failed to create spreadsheet: No spreadsheet ID returned");
            }

            const spreadsheetId = createResponse.result.spreadsheetId;
            const spreadsheetUrl = createResponse.result.spreadsheetUrl;
            console.log(`Spreadsheet created with ID: ${spreadsheetId}`);

            // Update the spreadsheet with values
            const valueRange = {
                values: [headers, ...values.map(row => row.map(cell => cell === null ? '' : cell))]
            };

            console.log("Updating spreadsheet with data...");
            await window.gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Report Data!A1',
                valueInputOption: 'USER_ENTERED',
                resource: valueRange
            });

            console.log(`Spreadsheet updated successfully: ${spreadsheetUrl}`);
            alert(`Successfully exported to Google Sheet!\nID: ${spreadsheetId}`);
            window.open(spreadsheetUrl, '_blank');

        } catch (error: unknown) {
            console.error("Error exporting to Google Sheets:", error);
            let message = "Failed to export to Google Sheets.";
            if (
                isGapiError(error) &&
                (error.error === 'popup_closed_by_user' ||
                    (error.details?.includes('access_denied')))
            ) {
                message = "Google Sheets permission was denied.";
            } else if (error instanceof Error) {
                message += ` ${error.message}`;
            }
            setReportError(message);
        } finally {
            setIsExportingSheet(false);
        }
    };

    // --- Navigation to Full Report ---
    const handleViewFullData = () => {
        if (rawMergedGscData && rawMergedGscData.size > 0) {
            try {
                const dataArray = Array.from(rawMergedGscData.values());
                localStorage.setItem('fullGscReportData', JSON.stringify(dataArray));
                localStorage.setItem('selectedMetricsForFullView', JSON.stringify(selectedMetrics));
                router.push('/full-report');
            } catch (e) {
                console.error("Failed to store full data for navigation:", e);
                setReportError("Could not prepare full data view due to storage limits.");
            }
        } else {
            alert("No GSC data available to view.");
        }
    };

    // --- Render Functions ---
    const renderMainContent = () => {
        if (isLoadingAuth) {
            return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
        }

        if (!isAuthenticated) {
            return (
                <Card>
                    <CardHeader>
                        <CardTitle>Welcome to Serprisingly</CardTitle>
                        <CardDescription>Sign in to start building custom reports</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AuthButton isAuthenticated={false} onLogout={async () => { }} isLoading={false} />
                    </CardContent>
                </Card>
            );
        }

        return (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* ===== LEFT SIDEBAR (Configuration) ===== */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="shadow-sm sticky top-[80px]">
                            <CardHeader>
                                <CardTitle className="text-lg font-semibold flex items-center gap-2"><Settings2 size={20} /> Report Builder</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* 1. Property Selection */}
                                <div>
                                    <h3 className="text-sm font-medium mb-1 text-muted-foreground">1. Select Property</h3>
                                    <PropertySelector properties={gscProperties} selectedProperty={selectedProperty} onSelectProperty={setSelectedProperty} isLoading={isLoadingProperties} error={propertyError} />
                                </div>
                                <Separator />

                                {/* 2. Available Metrics */}
                                <div>
                                    <h3 className="text-sm font-medium mb-1 text-muted-foreground">2. Available Metrics</h3>
                                    <CardDescription className="text-xs mb-2">Drag metrics to the area below</CardDescription>
                                    <div className="flex flex-wrap gap-2 p-3 rounded-md border bg-muted/50 min-h-[80px] max-h-[250px] overflow-y-auto">
                                        {availableMetrics.map((metric: Metric) => (
                                            <TooltipProvider key={metric.id} delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div>
                                                            <DraggableMetric id={metric.id} metric={metric} origin="available" />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom"><p>Drag to &apos;Selected Metrics&apos;</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ))}
                                        {availableMetrics.length === 0 && <p className="text-xs text-muted-foreground p-2 w-full text-center">All metrics selected.</p>}
                                    </div>
                                </div>
                                <Separator />

                                {/* 3. Selected Metrics */}
                                <div>
                                    <h3 className="text-sm font-medium mb-1 text-muted-foreground">3. Selected Metrics</h3>
                                    <DroppableArea id="selected-metrics-area" title="Report Columns">
                                        {selectedMetrics.length > 0 ? (
                                            <div className="flex flex-wrap gap-3 p-1 min-h-[40px]">
                                                {selectedMetrics.map((metric: Metric) => (
                                                    <div key={metric.id} className="relative group">
                                                        <DraggableMetric id={metric.id} metric={metric} origin="selected-metrics-area" />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeSelectedMetric(metric.id)}
                                                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 text-destructive hover:bg-destructive/10"
                                                            aria-label={`Remove ${metric.name}`}
                                                        >
                                                            <X size={12} />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </DroppableArea>
                                </div>
                                <Separator />

                                {/* 4. Analysis Options */}
                                <div>
                                    <h3 className="text-sm font-medium mb-1 text-muted-foreground flex items-center gap-1"><ListChecks size={14} /> Analysis Options</h3>
                                    <div className="space-y-3 mt-2">
                                        <div className="flex items-center gap-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild><Clock size={16} className="text-muted-foreground" /></TooltipTrigger>
                                                    <TooltipContent><p>Number of top queries (by clicks) to analyze</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <Select value={topNCount} onValueChange={setTopNCount} disabled={isLoadingReport || isAnalyzingBackground}>
                                                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Analyze Top..." /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="10">Analyze Top 10</SelectItem>
                                                    <SelectItem value="25">Analyze Top 25</SelectItem>
                                                    <SelectItem value="50">Analyze Top 50</SelectItem>
                                                    <SelectItem value="100">Analyze Top 100</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Search size={16} className="text-muted-foreground" />
                                            <Input
                                                placeholder="Filter by keyword (before analysis)..."
                                                value={keywordFilter}
                                                onChange={(e) => setKeywordFilter(e.target.value)}
                                                className="h-8 text-xs"
                                                disabled={isLoadingReport || isAnalyzingBackground}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <Separator />

                                {/* 5. Generate */}
                                <div>
                                    <Button
                                        className="w-full"
                                        onClick={handleGenerateReport}
                                        disabled={selectedMetrics.length === 0 || isLoadingReport || isAnalyzingBackground || !selectedProperty}
                                    >
                                        {isLoadingReport ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                {loadingMessage || 'Processing...'}
                                            </>
                                        ) : isAnalyzingBackground ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Analyzing Background...
                                            </>
                                        ) : (
                                            <>
                                                <BarChartHorizontalBig className="mr-2 h-0 w-4" />
                                                Generate Report
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ===== CENTER AREA (Report Table) ===== */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Background Progress Indicator */}
                        {isAnalyzingBackground && jobProgress && (
                            <Card>
                                <CardHeader className="pb-2 pt-4">
                                    <CardTitle className="text-base">Background Analysis Progress</CardTitle>
                                </CardHeader>
                                <CardContent className="pb-4">
                                    <Progress
                                        value={jobProgress.total > 0 ? (jobProgress.completed / jobProgress.total) * 100 : 0}
                                        className="w-full mb-2 h-2"
                                    />
                                    <p className="text-sm text-muted-foreground text-center">
                                        {jobProgress.status === 'running'
                                            ? `Analyzing query ${jobProgress.completed} of ${jobProgress.total}...`
                                            : `Status: ${jobProgress.status}`}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {/* Global Report Error */}
                        {reportError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{reportError}</AlertDescription>
                            </Alert>
                        )}

                        {/* Report Results Section */}
                        <div className="mt-0">
                            {/* Skeleton Loader */}
                            {isLoadingReport && !reportError && (
                                <Card>
                                    <CardContent className="p-6">
                                        <Skeleton className="h-8 w-full mb-4" />
                                        <Skeleton className="h-64 w-full" />
                                    </CardContent>
                                </Card>
                            )}

                            {/* Render Table Section */}
                            {(topNQueryData.length > 0 || isAnalyzingBackground) && !isLoadingReport && (
                                <ReportTable data={displayData} visibleMetrics={selectedMetrics} />
                            )}

                            {/* Initial state message */}
                            {!rawMergedGscData && !isLoadingReport && !isAnalyzingBackground && !reportError && (
                                <Card className="border-dashed border-2 min-h-[400px] flex items-center justify-center">
                                    <CardContent className="p-6 text-center text-muted-foreground">
                                        <p>Configure your report options on the left and click &quot;Generate Report&quot;.</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* ===== RIGHT SIDEBAR (Details & Actions) ===== */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="sticky top-[80px] space-y-6">
                            {/* Selected Property Info */}
                            <Card>
                                <CardHeader className="pb-2 pt-4">
                                    <CardTitle className="text-base flex items-center gap-2"><Globe size={16} /> Selected Property</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {selectedProperty ? (
                                        <p className="text-sm font-medium break-all">{selectedProperty}</p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Select a property</p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Analysis Trends */}
                            <Card>
                                <CategoryDistributionChart data={displayData} />
                            </Card>

                            {/* Export & View Actions */}
                            <Card>
                                <CardHeader className="pb-2 pt-4">
                                    <CardTitle className="text-base flex items-center gap-2"><Download size={16} /> Actions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start"
                                        onClick={handleExportCsv}
                                        disabled={displayData.length === 0}
                                    >
                                        <Download className="h-4 w-4 mr-2" /> Export Displayed (CSV)
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start"
                                        onClick={handleExportToSheets}
                                        disabled={displayData.length === 0 || !isGapiLoaded || isGapiInitializing || isExportingSheet}
                                    >
                                        {isExportingSheet ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                                        {isExportingSheet ? 'Exporting...' : 'Export to Google Sheets'}
                                    </Button>
                                    {(!isGapiLoaded || isGapiInitializing) && <p className="text-xs text-muted-foreground">Google API loading...</p>}
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full justify-start"
                                        onClick={handleViewFullData}
                                        disabled={!rawMergedGscData || rawMergedGscData.size === 0}
                                    >
                                        <Info className="h-4 w-4 mr-2" /> View All GSC Data ({rawMergedGscData?.size ?? 0})
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </DndContext>
        );
    };

    // --- Final Render ---
    return (
        <TooltipProvider delayDuration={200}>
            <Head>
                <title>Serprisingly - Custom Report Builder</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div className="min-h-screen flex flex-col bg-slate-50">
                <header className="flex justify-between items-center p-4 border-b bg-primary text-primary-foreground shadow-sm sticky top-0 z-50 h-[65px]">
                    <h1 className="text-xl font-semibold">Serprisingly Report Builder</h1>
                    <div className="flex items-center gap-4">
                        <AuthButton isAuthenticated={isAuthenticated} onLogout={handleLogout} isLoading={isLoadingAuth} />
                    </div>
                </header>
                <main className="flex-grow container mx-auto px-4 py-6 md:px-6 md:py-8">
                    {renderMainContent()}
                </main>
                <footer className="mt-12 p-4 text-center text-muted-foreground text-xs border-t bg-background">
                    Powered by Serprisingly
                </footer>
            </div>
        </TooltipProvider>
    );
}

function isGapiError(error: unknown): error is GapiErrorResponse {
    return (
        typeof error === 'object' &&
        error !== null &&
        ('error' in error || 'details' in error)
    );
}