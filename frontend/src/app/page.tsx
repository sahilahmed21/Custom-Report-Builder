// frontend/src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Head from 'next/head';
import AuthButton from '../components/AuthButton';
import { useReportConfig } from '../hooks/useReportConfig ';
import { DraggableMetric } from '../components/DraggableMetric';
import { DroppableArea } from '../components/DroppableArea';
import { PropertySelector } from '../components/PropertySelector';
import { ReportTable } from '../components/ReportTable';
import { getDateRange } from '../utils/dateUtils';
import { Metric, GscProperty, ReportRow, DisplayRow } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { X, Terminal, AlertCircle, Download, Settings2, BarChartHorizontalBig, Info } from 'lucide-react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    DragEndEvent,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';

// --- Constants ---
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const POLLING_INTERVAL_MS = 5000;

export default function Home() {
    // --- States ---
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
    const [gscProperties, setGscProperties] = useState<GscProperty[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
    const [isLoadingProperties, setIsLoadingProperties] = useState<boolean>(false);
    const [propertyError, setPropertyError] = useState<string | null>(null);
    const [rawMergedGscData, setRawMergedGscData] = useState<Map<string, Partial<DisplayRow>> | null>(null);
    const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [reportFilter, setReportFilter] = useState<string>('');
    const [loadingMessage, setLoadingMessage] = useState<string>('');

    // --- Progressive Loading States ---
    const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
    const [jobProgress, setJobProgress] = useState<{ total: number; completed: number; status: string; error?: string } | null>(null);
    const [analyzedResultsMap, setAnalyzedResultsMap] = useState<Map<string, { intent: string; category: string }>>(new Map());
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    // --- Hooks ---
    const {
        availableMetrics,
        selectedMetrics,
        handleDragEnd: handleDragEndFromHook,
        removeSelectedMetric,
    } = useReportConfig();
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

    // --- API Calls & Effects ---
    const fetchProperties = useCallback(async () => {
        if (!isAuthenticated || !BACKEND_URL) return;
        setIsLoadingProperties(true);
        setPropertyError(null);
        try {
            const response = await fetch(`${BACKEND_URL}/gsc/properties`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch properties');
            const data: GscProperty[] = await response.json();
            setGscProperties(data);
            if (data.length > 0 && !selectedProperty) {
                setSelectedProperty(data[0].siteUrl);
            }
        } catch (error: any) {
            setPropertyError(error.message || 'Failed to load properties');
        } finally {
            setIsLoadingProperties(false);
        }
    }, [BACKEND_URL, isAuthenticated, selectedProperty]);

    useEffect(() => {
        const checkAuth = async () => {
            setIsLoadingAuth(true); // Set loading true at the start
            try {
                // THIS IS THE CRITICAL CALL AFTER REDIRECT
                const response = await fetch(`${BACKEND_URL}/auth/status`, {
                    credentials: 'include',
                });
                console.log('Auth check response status:', response.status); // ADD LOGGING
                const data = await response.json(); // ADD LOGGING
                console.log('Auth check response data:', data); // ADD LOGGING

                // It relies on the BACKEND /auth/check responding correctly
                setIsAuthenticated(response.ok && data.isAuthenticated); // Check response.ok AND the payload
            } catch (error) {
                console.error('Auth check fetch error:', error); // ADD LOGGING
                setIsAuthenticated(false);
            } finally {
                setIsLoadingAuth(false); // Set loading false at the end
            }
        };
        checkAuth();
    }, [BACKEND_URL]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchProperties();
        } else {
            setGscProperties([]);
            setSelectedProperty(null);
            setRawMergedGscData(null);
            setAnalysisJobId(null);
            setJobProgress(null);
            setAnalyzedResultsMap(new Map());
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        }
    }, [isAuthenticated, fetchProperties]);

    useEffect(() => {
        if (!analysisJobId || !BACKEND_URL) return;

        pollingIntervalRef.current = setInterval(async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/gemini/job-status/${analysisJobId}`, {
                    credentials: 'include',
                });
                if (!response.ok) throw new Error('Failed to fetch job status');
                const progress = await response.json();
                setJobProgress(progress);

                if (progress.status === 'completed' || progress.status === 'failed') {
                    if (progress.status === 'failed' && progress.error) {
                        setReportError(progress.error);
                    } else if (progress.results) {
                        const newAnalysisMap = new Map<string, { intent: string; category: string }>();
                        progress.results.forEach((item: any) => {
                            newAnalysisMap.set(item.query, { intent: item.intent, category: item.category });
                        });
                        setAnalyzedResultsMap(newAnalysisMap);
                    }
                    setIsLoadingReport(false);
                    setLoadingMessage('');
                    setAnalysisJobId(null);
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                }
            } catch (error: any) {
                setReportError(error.message || 'Error checking analysis progress');
                setIsLoadingReport(false);
                setLoadingMessage('');
                setAnalysisJobId(null);
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            }
        }, POLLING_INTERVAL_MS);

        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        };
    }, [analysisJobId, BACKEND_URL]);

    // --- Handlers ---
    const handleLogout = async () => {
        try {
            await fetch(`${BACKEND_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
            setIsAuthenticated(false);
            setSelectedProperty(null);
            setGscProperties([]);
            setRawMergedGscData(null);
            setAnalysisJobId(null);
            setJobProgress(null);
            setAnalyzedResultsMap(new Map());
            setReportError(null);
            setReportFilter('');
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => handleDragEndFromHook(event);

    const handleGenerateReport = async () => {
        if (!selectedProperty || selectedMetrics.length === 0 || isLoadingReport || !BACKEND_URL || analysisJobId) return;

        setRawMergedGscData(null);
        setAnalyzedResultsMap(new Map());
        setReportError(null);
        setIsLoadingReport(true);
        setLoadingMessage('Preparing requests...');
        setReportFilter('');
        setJobProgress(null);
        setAnalysisJobId(null);
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

        try {
            // --- Phase 2: Fetch and Merge GSC Data ---
            const requestsToMake = new Map<string, { metrics: Set<string>; startDate?: string; endDate?: string }>();
            const uniqueTimePeriods = new Set<string>();

            selectedMetrics.forEach(metric => {
                uniqueTimePeriods.add(metric.timePeriod);
                if (!requestsToMake.has(metric.timePeriod)) {
                    requestsToMake.set(metric.timePeriod, { metrics: new Set() });
                }
                requestsToMake.get(metric.timePeriod)!.metrics.add(metric.apiName);
            });

            console.log('Required time periods:', Array.from(uniqueTimePeriods));

            const fetchPromises = Array.from(uniqueTimePeriods).map(async (timePeriod) => {
                setLoadingMessage(`Fetching data for ${timePeriod}...`);
                const dateRange = getDateRange(timePeriod);
                if (!dateRange) {
                    console.error(`Could not get date range for ${timePeriod}`);
                    throw new Error(`Invalid time period specified: ${timePeriod}`);
                }

                const requestBody = {
                    siteUrl: selectedProperty,
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    dimensions: ['query'],
                };

                console.log(`Fetching GSC data for ${timePeriod}:`, requestBody);
                const response = await fetch(`${BACKEND_URL}/gsc/report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
                    console.error(`Failed GSC fetch for ${timePeriod}:`, errorData);
                    throw new Error(`GSC fetch failed for ${timePeriod}: ${errorData.error || response.statusText}`);
                }
                const resultData: ReportRow[] = await response.json();
                console.log(`Received ${resultData.length} rows for ${timePeriod}`);
                return { timePeriod, data: resultData };
            });

            setLoadingMessage(`Fetching data for all periods (${fetchPromises.length})...`);
            const results = await Promise.allSettled(fetchPromises);
            console.log("GSC Fetch Results (Promise.allSettled):", results);

            setLoadingMessage('Merging data...');
            const mergedData = new Map<string, Partial<DisplayRow>>();
            let fetchErrors: string[] = [];

            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    const { timePeriod, data } = result.value;
                    data.forEach(row => {
                        const query = row.keys?.[0];
                        if (query) {
                            const currentEntry = mergedData.get(query) || {};
                            currentEntry[`clicks_${timePeriod}`] = row.clicks;
                            currentEntry[`impressions_${timePeriod}`] = row.impressions;
                            currentEntry[`ctr_${timePeriod}`] = row.ctr;
                            currentEntry[`position_${timePeriod}`] = row.position;
                            mergedData.set(query, currentEntry);
                        }
                    });
                } else {
                    console.error("A GSC fetch promise failed:", result.reason);
                    fetchErrors.push(result.reason?.message || `Failed to fetch data for one period.`);
                }
            });

            console.log(`Merged data for ${mergedData.size} unique queries.`);
            setRawMergedGscData(mergedData);

            if (fetchErrors.length > 0) {
                setReportError(`Errors during data fetch: ${fetchErrors.join('; ')}`);
                setIsLoadingReport(false);
                setLoadingMessage('');
                return;
            }

            // --- Phase 3: Trigger Progressive Analysis ---
            setLoadingMessage('Preparing analysis...');
            const uniqueQueries = Array.from(mergedData.keys());


            if (uniqueQueries.length > 0) {
                console.log(`Triggering Gemini analysis for ${uniqueQueries.length} unique queries...`);
                setLoadingMessage('Starting AI analysis...');
                const queryDataForAnalysis = Array.from(mergedData.entries()).map(([query, metrics]) => {
                    const clicks = metrics['clicks_L28D'] ?? metrics['clicks_L3M'] ?? 0;
                    return { query: query, clicks: clicks as number };
                });

                console.log("Frontend: Structure of queryDataForAnalysis[0]:", queryDataForAnalysis[0]);
                console.log("Frontend: Type of queryDataForAnalysis[0]:", typeof queryDataForAnalysis[0]);
                console.log("Frontend: Sending this payload to /gemini/analyze-progressive:", { queryData: queryDataForAnalysis });
                console.log("Frontend: Payload size (estimated string length):", JSON.stringify({ queryData: queryDataForAnalysis }).length);

                try {
                    const analysisResponse = await fetch(`${BACKEND_URL}/gemini/analyze-progressive`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include',
                        // *** SEND THE FULL PAYLOAD ***
                        body: JSON.stringify({ queryData: queryDataForAnalysis }),
                    });



                    if (!analysisResponse.ok) {
                        throw new Error(`Failed to start analysis job: ${analysisResponse.statusText}`);
                    }

                    // --- Get the REAL Job ID ---
                    const { jobId } = await analysisResponse.json(); // jobId should be a UUID from backend

                    if (jobId) {
                        console.log("Analysis job started successfully. REAL Job ID:", jobId); // LOG THE REAL ID
                        setAnalysisJobId(jobId); // <--- SET THE *REAL* JOB ID HERE
                        // Do NOT set it to "simulated-job-id"
                    } else {
                        console.log("Analysis skipped or no job ID returned by backend.");
                        setLoadingMessage('');
                        setIsLoadingReport(false);
                    }

                } catch (analysisError: any) {
                    console.error('Error starting Gemini analysis job:', analysisError);
                    setReportError(`Failed to start analysis: ${analysisError.message}`);
                    setIsLoadingReport(false);
                    setLoadingMessage('');
                }

            } else {
                console.log("No unique queries found after merging GSC data.");
                setLoadingMessage('');
                setIsLoadingReport(false);
            }

        } catch (error: any) {
            console.error('Error during report generation:', error);
            setReportError(error.message || 'An unknown error occurred during report generation.');
            setIsLoadingReport(false);
            setLoadingMessage('');
            setRawMergedGscData(null);
            setAnalysisJobId(null);
            setJobProgress(null);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        }
    };

    // --- Derived State for Display ---
    const displayData = useMemo((): DisplayRow[] => {
        if (!rawMergedGscData) return [];
        const dataToShow: DisplayRow[] = [];
        rawMergedGscData.forEach((mergedRowData, query) => {
            const analysis = analyzedResultsMap.get(query);
            if (analysis) {
                if (typeof query === 'string') {
                    dataToShow.push({
                        query: query,
                        ...mergedRowData,
                        geminiIntent: analysis.intent,
                        geminiCategory: analysis.category,
                        isSampled: true,
                    });
                }
            }
        });
        return dataToShow;
    }, [rawMergedGscData, analyzedResultsMap]);

    const filteredDisplayData = displayData?.filter((row) =>
        row.query?.toLowerCase().includes(reportFilter.toLowerCase())
    ) ?? [];

    // --- Handler for View Full Data ---
    const handleViewFullData = () => {
        if (rawMergedGscData) {
            try {
                const dataArray = Array.from(rawMergedGscData.entries()).map(([query, metrics]) => ({ query, ...metrics }));
                localStorage.setItem('fullGscReportData', JSON.stringify(dataArray));
                localStorage.setItem('selectedMetricsForFullView', JSON.stringify(selectedMetrics));
                router.push('/full-report');
            } catch (e) {
                console.error("Failed to store full data for navigation:", e);
                setReportError("Could not prepare full data view due to storage limits.");
            }
        }
    };

    // --- Render Functions ---
    const renderMainContent = () => {
        if (isLoadingAuth) {
            return (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            );
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
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                    {/* Config Panel */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Settings2 size={18} /> Report Configuration
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <PropertySelector
                                    properties={gscProperties}
                                    selectedProperty={selectedProperty}
                                    onSelect={setSelectedProperty}
                                    isLoading={isLoadingProperties}
                                    error={propertyError}
                                />
                                <div>
                                    <h3 className="text-sm font-medium mb-2">Available Metrics</h3>
                                    <div className="flex flex-wrap gap-2 p-2 rounded-md border bg-muted/50 min-h-[50px]">
                                        {availableMetrics.map((metric: Metric) => (
                                            <TooltipProvider key={metric.id} delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <DraggableMetric id={metric.id} metric={metric} origin="available" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Drag to 'Selected Metrics'</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Drop Area & Report */}
                    <div className="lg:col-span-3 space-y-6">
                        <DroppableArea id="selected-metrics-area" title="Selected Metrics">
                            {selectedMetrics.length > 0 ? (
                                <div className="flex flex-wrap gap-3 p-2 min-h-[40px]">
                                    {selectedMetrics.map((metric: Metric) => (
                                        <div key={metric.id} className="relative group">
                                            <DraggableMetric id={metric.id} metric={metric} origin="selected-metrics-area" />
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                onClick={() => removeSelectedMetric(metric.id)}
                                                className="absolute -top-2 -right-2 w-4 h-4 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                                aria-label={`Remove ${metric.name}`}
                                            >
                                                <X size={10} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">Drag metrics here</p>
                            )}
                        </DroppableArea>
                        <div className="flex justify-end items-center gap-4">
                            <Button
                                onClick={handleGenerateReport}
                                disabled={selectedMetrics.length === 0 || isLoadingReport || !selectedProperty || !!analysisJobId}
                            >
                                {isLoadingReport ? (loadingMessage || 'Generating/Analyzing...') : 'Generate Report'}
                            </Button>
                        </div>
                        {isLoadingReport && jobProgress && (
                            <div className="space-y-1">
                                <Progress value={(jobProgress.completed / jobProgress.total) * 100} className="w-full" />
                                <p className="text-sm text-muted-foreground">
                                    {jobProgress.status === 'running'
                                        ? `Analyzing ${jobProgress.completed} of ${jobProgress.total} queries...`
                                        : jobProgress.status}
                                </p>
                            </div>
                        )}
                        {reportError && !isLoadingReport && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{reportError}</AlertDescription>
                            </Alert>
                        )}
                        <div className="mt-4">
                            {isLoadingReport && !jobProgress && !reportError && (
                                <Card>
                                    <CardContent className="p-6">
                                        <Skeleton className="h-8 w-full mb-4" />
                                        <Skeleton className="h-64 w-full" />
                                    </CardContent>
                                </Card>
                            )}
                            {(rawMergedGscData || displayData.length > 0 || isLoadingReport) && !reportError && (
                                <>
                                    <div className="flex items-center justify-between gap-4 mb-4">
                                        <Input
                                            placeholder="Filter analyzed queries..."
                                            value={reportFilter}
                                            onChange={(e) => setReportFilter(e.target.value)}
                                            className="max-w-xs"
                                            disabled={displayData.length === 0}
                                        />
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" disabled={displayData.length === 0}>
                                                <Download className="h-4 w-4 mr-2" /> Export Analyzed (CSV)
                                            </Button>
                                            <Button variant="secondary" size="sm" disabled={!rawMergedGscData} onClick={handleViewFullData}>
                                                View SMART GSC Data ({rawMergedGscData?.size ?? 0})
                                            </Button>
                                        </div>
                                    </div>
                                    <ReportTable data={filteredDisplayData} visibleMetrics={selectedMetrics} />
                                    {displayData.length === 0 && !isLoadingReport && jobProgress?.status !== 'running' && rawMergedGscData && (
                                        <p className="text-center text-muted-foreground mt-4">No analysis results available yet or none matched filter.</p>
                                    )}
                                </>
                            )}
                            {!rawMergedGscData && !isLoadingReport && !reportError && (
                                <Card>
                                    <CardHeader><CardTitle>Report Results</CardTitle></CardHeader>
                                    <CardContent className="p-6 text-center text-muted-foreground">
                                        Configure your report options above and click "Generate Report".
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </DndContext>
        );
    };

    // --- Final Render ---
    return (
        <TooltipProvider delayDuration={300}>
            <Head>
                <title>Serprisingly - Custom Report Builder</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div className="min-h-screen flex flex-col">
                <header className="flex justify-between items-center p-4 border-b bg-primary text-primary-foreground shadow-sm sticky top-0 z-10">
                    <h1 className="text-xl font-semibold">Serprisingly Report Builder</h1>
                    <div className="flex items-center gap-4">
                        {isAuthenticated && selectedProperty && (
                            <span className="text-sm hidden md:inline opacity-80">Property: {selectedProperty}</span>
                        )}
                        <AuthButton isAuthenticated={isAuthenticated} onLogout={handleLogout} isLoading={isLoadingAuth} />
                    </div>
                </header>
                <main className="flex-grow container mx-auto px-4 py-6 md:px-6 md:py-8">{renderMainContent()}</main>
                <footer className="mt-12 p-4 text-center text-muted-foreground text-xs border-t">
                    Powered by Next.js, Node.js, GSC API, and Gemini API
                </footer>
            </div>
        </TooltipProvider>
    );
}