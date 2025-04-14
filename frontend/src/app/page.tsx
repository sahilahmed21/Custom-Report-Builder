"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import AuthButton from '../components/AuthButton';
import { useReportConfig } from '../hooks/useReportConfig ';
import { DraggableMetric } from '../components/DraggableMetric';
import { DroppableArea } from '../components/DroppableArea';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import { PropertySelector } from '../components/PropertySelector';
import { ReportTable } from '../components/ReportTable';
import { getDateRange } from '../utils/dateUtils';
import { Metric, GscProperty, ReportRow } from '../types';
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
import { X, AlertCircle, Download, Settings2, BarChartHorizontalBig } from 'lucide-react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    DragEndEvent,
} from '@dnd-kit/core';

// --- Constants ---
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
const POLLING_INTERVAL_MS = 5000; // Poll every 5 seconds

export default function Home() {
    // --- States ---
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
    const [gscProperties, setGscProperties] = useState<GscProperty[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
    const [isLoadingProperties, setIsLoadingProperties] = useState<boolean>(false);
    const [propertyError, setPropertyError] = useState<string | null>(null);

    // Report Data States
    const [rawGscData, setRawGscData] = useState<ReportRow[] | null>(null);
    const [displayData, setDisplayData] = useState<ReportRow[]>([]);
    const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [reportFilter, setReportFilter] = useState<string>('');

    // Job Tracking States
    const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
    const [jobProgress, setJobProgress] = useState<{ total: number; completed: number; status: string } | null>(null);
    const [analyzedResultsMap, setAnalyzedResultsMap] = useState<Map<string, { intent: string; category: string }>>(
        new Map()
    );

    // --- Hooks and Constants ---
    const {
        availableMetrics,
        selectedMetrics,
        selectedTimeRange,
        timeRanges,
        setSelectedTimeRange,
        handleDragEnd: handleDragEndFromHook,
        removeSelectedMetric,
    } = useReportConfig();
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // --- API Calls ---
    const fetchProperties = useCallback(async () => {
        if (!BACKEND_URL || !isAuthenticated) return;
        setIsLoadingProperties(true);
        setPropertyError(null);
        try {
            const response = await fetch(`${BACKEND_URL}/gsc/properties`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed properties fetch: ${response.statusText}`);
            }
            const data: GscProperty[] = await response.json();
            setGscProperties(data);
        } catch (error: any) {
            console.error('Error fetching GSC properties:', error);
            setPropertyError(error.message || 'Unknown error fetching properties.');
        } finally {
            setIsLoadingProperties(false);
        }
    }, [BACKEND_URL, isAuthenticated]);

    // --- Auth Effects ---
    useEffect(() => {
        const checkAuth = async () => {
            if (!BACKEND_URL) {
                console.error('Backend URL missing.');
                setIsLoadingAuth(false);
                return;
            }
            setIsLoadingAuth(true);
            try {
                const response = await fetch(`${BACKEND_URL}/auth/status`);
                const data = await response.json();
                setIsAuthenticated(data.isAuthenticated);
            } catch (error) {
                console.error('Error checking auth status:', error);
                setIsAuthenticated(false);
            } finally {
                setIsLoadingAuth(false);
            }
        };

        const queryParams = new URLSearchParams(window.location.search);
        const authStatus = queryParams.get('auth_status');
        if (authStatus === 'success') {
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (authStatus === 'error') {
            setIsAuthenticated(false);
            setIsLoadingAuth(false);
            const message = queryParams.get('message');
            setReportError(`Authentication failed: ${message || 'Unknown error'}`);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            checkAuth();
        }
    }, [BACKEND_URL]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchProperties();
        } else {
            setGscProperties([]);
            setSelectedProperty(null);
            setPropertyError(null);
            setRawGscData(null);
            setDisplayData([]);
            setAnalysisJobId(null);
            setJobProgress(null);
            setAnalyzedResultsMap(new Map());
        }
    }, [isAuthenticated, fetchProperties]);

    // --- Polling Effect ---
    useEffect(() => {
        const fetchJobStatus = async () => {
            if (!analysisJobId || !BACKEND_URL) return;

            console.log(`Polling job status for ${analysisJobId}...`);
            try {
                const response = await fetch(`${BACKEND_URL}/gemini/job/${analysisJobId}`);
                if (!response.ok) {
                    console.error(`Error polling job ${analysisJobId}: ${response.status}`);
                    setReportError(`Error fetching analysis progress (Status: ${response.status}).`);
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setAnalysisJobId(null);
                    setIsLoadingReport(false);
                    return;
                }
                const data = await response.json();
                console.log('Job status received:', data);

                setJobProgress({ total: data.total, completed: data.completed, status: data.status });

                if (data.results && typeof data.results === 'object') {
                    setAnalyzedResultsMap(new Map(Object.entries(data.results)));
                }

                if (data.status === 'Completed' || data.status === 'Failed') {
                    console.log(`Job ${analysisJobId} finished with status: ${data.status}`);
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setAnalysisJobId(null);
                    setIsLoadingReport(false);
                    if (data.status === 'Failed') {
                        setReportError(`Analysis job failed: ${data.error || 'Unknown reason'}`);
                    }
                }
            } catch (error: any) {
                console.error('Polling error:', error);
                setReportError(`Polling error: ${error.message}`);
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                setAnalysisJobId(null);
                setIsLoadingReport(false);
            }
        };

        if (analysisJobId) {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            fetchJobStatus();
            pollingIntervalRef.current = setInterval(fetchJobStatus, POLLING_INTERVAL_MS);
        }

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
                console.log('Polling interval cleared.');
            }
        };
    }, [analysisJobId, BACKEND_URL]);

    // --- Effect to Derive displayData ---
    useEffect(() => {
        if (!rawGscData) {
            setDisplayData([]);
            return;
        }

        const newData = rawGscData
            .filter((row) => row.query && analyzedResultsMap.has(row.query))
            .map((row) => {
                const analysis = analyzedResultsMap.get(row.query!);
                return {
                    ...row,
                    geminiIntent: analysis?.intent ?? 'Error',
                    geminiCategory: analysis?.category ?? 'Error',
                    isSampled: true,
                };
            });

        setDisplayData(newData);
        console.log(`Derived displayData with ${newData.length} analyzed rows.`);
    }, [rawGscData, analyzedResultsMap]);

    // --- Handlers ---
    const handleLogout = async () => {
        if (!BACKEND_URL) return;
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setAnalysisJobId(null);
        setJobProgress(null);
        setAnalyzedResultsMap(new Map());
        setDisplayData([]);
        setIsLoadingAuth(true);
        try {
            await fetch(`${BACKEND_URL}/auth/logout`, { method: 'POST' });
            setIsAuthenticated(false);
            setGscProperties([]);
            setSelectedProperty(null);
            setRawGscData(null);
            setReportError(null);
            setPropertyError(null);
        } catch (error) {
            console.error('Error during logout:', error);
            setReportError('An error occurred during logout.');
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => handleDragEndFromHook(event);

    const handleGenerateReport = async () => {
        if (!selectedProperty || selectedMetrics.length === 0 || isLoadingReport || !BACKEND_URL) return;
        setRawGscData(null);
        setDisplayData([]);
        setAnalysisJobId(null);
        setJobProgress(null);
        setAnalyzedResultsMap(new Map());
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setReportError(null);
        setReportFilter('');
        setIsLoadingReport(true);

        const dateRange = getDateRange(selectedTimeRange);
        if (!dateRange) {
            setReportError('Custom date range selection is not implemented.');
            setIsLoadingReport(false);
            return;
        }

        const gscRequestBody = {
            siteUrl: selectedProperty,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: ['query'],
        };
        let gscDataRaw: ReportRow[] | null = null;

        try {
            console.log('Calling backend /gsc/report:', gscRequestBody);
            const gscResponse = await fetch(`${BACKEND_URL}/gsc/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gscRequestBody),
            });
            const gscResult = await gscResponse.json();
            if (!gscResponse.ok) throw new Error(gscResult.error || `Failed GSC fetch: ${gscResponse.statusText}`);

            gscDataRaw = (gscResult as any[]).map((row) => ({
                ...row,
                query: row.keys?.[0],
            })) as ReportRow[];

            console.log(`GSC data received: ${gscDataRaw?.length ?? 0} rows`);
            setRawGscData(gscDataRaw);

            if (gscDataRaw && gscDataRaw.length > 0) {
                const queryDataForAnalysis = gscDataRaw
                    .map((row) => ({
                        query: row.query ?? '',
                        clicks: row.clicks,
                        impressions: row.impressions,
                    }))
                    .filter((item) => item.query);

                if (queryDataForAnalysis.length > 0) {
                    console.log(`Calling backend /gemini/analyze-progressive for ${queryDataForAnalysis.length} queries.`);
                    const startJobResponse = await fetch(`${BACKEND_URL}/gemini/analyze-progressive`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ queryData: queryDataForAnalysis }),
                    });
                    const startJobResult = await startJobResponse.json();
                    if (!startJobResponse.ok)
                        throw new Error(startJobResult.error || `Failed start analysis job: ${startJobResponse.statusText}`);

                    console.log(`Analysis job started with ID: ${startJobResult.jobId}`);
                    setAnalysisJobId(startJobResult.jobId);
                } else {
                    console.log('No valid queries to analyze.');
                    setIsLoadingReport(false);
                }
            } else {
                console.log('No GSC data fetched.');
                setIsLoadingReport(false);
            }
        } catch (error: any) {
            console.error('Error generating report:', error);
            setReportError(error.message || 'An unknown error occurred.');
            setIsLoadingReport(false);
            setRawGscData(null);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            setAnalysisJobId(null);
        }
    };

    // --- Filtered Data ---
    const filteredDisplayData = displayData.filter((row) => row.query?.toLowerCase().includes(reportFilter.toLowerCase())) ?? [];

    // --- Render Functions ---
    const renderProgress = () => {
        if (!analysisJobId && !jobProgress) return null;

        let progressValue = 0;
        let progressText = 'Starting analysis...';
        let statusVariant: 'default' | 'destructive' | 'warning' | 'success' = 'default';

        if (jobProgress) {
            progressValue = jobProgress.total > 0 ? (jobProgress.completed / jobProgress.total) * 100 : 0;
            progressText = `${jobProgress.status}: ${jobProgress.completed} / ${jobProgress.total} queries analyzed.`;
            if (jobProgress.status === 'Running') statusVariant = 'default';
            if (jobProgress.status === 'Completed') {
                statusVariant = 'success';
                progressValue = 100;
            }
            if (jobProgress.status === 'Failed') statusVariant = 'destructive';
            if (jobProgress.status === 'Pending') statusVariant = 'warning';
        }

        return (
            <div className="my-4 space-y-2">
                <Progress value={progressValue} className="w-full h-2" />
                <p
                    className={`text-sm text-center ${statusVariant === 'destructive'
                        ? 'text-destructive'
                        : statusVariant === 'success'
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                        }`}
                >
                    {progressText}
                </p>
            </div>
        );
    };

    const renderMainContent = () => {
        if (isLoadingAuth) {
            return (
                <div className="text-center pt-10 text-muted-foreground">
                    <Skeleton className="h-6 w-48 mx-auto" />
                    <p className="mt-2">Verifying authentication...</p>
                </div>
            );
        }
        if (!isAuthenticated) {
            return (
                <Card className="max-w-md mx-auto mt-10 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-center">Welcome!</CardTitle>
                        <CardDescription className="text-center">
                            Please log in with your Google account to access GSC data and build reports.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <BarChartHorizontalBig className="w-16 h-16 text-muted-foreground" />
                    </CardContent>
                </Card>
            );
        }
        if (!selectedProperty && !propertyError) {
            return (
                <div className="container mx-auto max-w-2xl mt-8">
                    <PropertySelector
                        properties={gscProperties}
                        selectedProperty={selectedProperty}
                        onSelectProperty={setSelectedProperty}
                        isLoading={isLoadingProperties}
                        error={propertyError}
                    />
                </div>
            );
        }
        if (propertyError) {
            return (
                <Alert variant="destructive" className="max-w-lg mx-auto mt-10">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Properties</AlertTitle>
                    <AlertDescription>
                        {propertyError} Please ensure the Search Console API is enabled and you granted access, or try logging out and back in.
                    </AlertDescription>
                </Alert>
            );
        }

        return (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                    {/* Column 1: Configuration Panel */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Settings2 size={18} /> Report Configuration
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium mb-2">Available Metrics</h3>
                                    <div className="flex flex-wrap gap-2 p-2 rounded-md border bg-muted/50 min-h-[50px]">
                                        {availableMetrics.map((metric: Metric) => (
                                            <TooltipProvider key={metric.id} delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger>
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
                                <div>
                                    <h3 className="text-sm font-medium mb-2">Time Range</h3>
                                    <TimeRangeSelector
                                        value={selectedTimeRange}
                                        onChange={setSelectedTimeRange}
                                        timeRanges={timeRanges}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Column 2: Drop Area & Report */}
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
                                {isLoadingReport || analysisJobId ? 'Processing...' : 'Generate Report'}
                            </Button>
                        </div>

                        {renderProgress()}

                        {reportError && !(isLoadingReport || analysisJobId) && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Report Error</AlertTitle>
                                <AlertDescription>
                                    {reportError.split('\n').map((line, index) => (
                                        <span key={index}>
                                            {line}
                                            <br />
                                        </span>
                                    ))}
                                    Please check the console for details or try again.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="mt-4">
                            {isLoadingReport && displayData.length === 0 && !analysisJobId && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Report Results</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 p-6">
                                        <Skeleton className="h-8 w-3/4" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-5/6" />
                                        <Skeleton className="h-4 w-full" />
                                    </CardContent>
                                </Card>
                            )}
                            {(displayData.length > 0 || analysisJobId || (!isLoadingReport && !analysisJobId && rawGscData)) && (
                                <>
                                    <div className="flex items-center justify-between gap-4 mb-4">
                                        <Input
                                            placeholder="Filter analyzed queries..."
                                            value={reportFilter}
                                            onChange={(e) => setReportFilter(e.target.value)}
                                            className="max-w-xs"
                                            disabled={!displayData || displayData.length === 0}
                                        />
                                        <div className="flex items-center gap-2">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm" disabled={!displayData || displayData.length === 0}>
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Export
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem disabled>Export as CSV (Coming Soon)</DropdownMenuItem>
                                                    <DropdownMenuItem disabled>Export as JSON (Coming Soon)</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <Button variant="outline" size="sm" disabled={!rawGscData}>
                                                <Download className="h-4 w-4 mr-2" />
                                                Export All GSC ({rawGscData?.length ?? 0} rows)
                                            </Button>
                                            <Button variant="secondary" size="sm" disabled={!rawGscData}>
                                                View All GSC Data
                                            </Button>
                                        </div>
                                    </div>
                                    <ReportTable data={filteredDisplayData} visibleMetrics={selectedMetrics} />
                                    {displayData.length === 0 && analysisJobId && (
                                        <p className="text-center text-muted-foreground mt-4">Waiting for first analysis results...</p>
                                    )}
                                </>
                            )}
                            {!isLoadingReport && !rawGscData && !reportError && !analysisJobId && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Report Results</CardTitle>
                                    </CardHeader>
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