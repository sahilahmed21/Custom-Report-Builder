"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AuthButton from '../components/AuthButton';
import { useReportConfig } from '../hooks/useReportConfig ';
import { DraggableMetric } from '../components/DraggableMetric';
import { DroppableArea } from '../components/DroppableArea';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import { PropertySelector } from '../components/PropertySelector';
import { ReportTable } from '../components/ReportTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    DragEndEvent,
} from '@dnd-kit/core';
import { Metric, GscProperty, ReportRow } from '../types';
import { getDateRange } from '../utils/dateUtils';

export default function Home() {
    // --- Auth State ---
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    // --- GSC Property State ---
    const [gscProperties, setGscProperties] = useState<GscProperty[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
    const [isLoadingProperties, setIsLoadingProperties] = useState<boolean>(false);
    const [propertyError, setPropertyError] = useState<string | null>(null);

    // --- Report Data State ---
    const [reportData, setReportData] = useState<ReportRow[] | null>(null);
    const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
    const [reportError, setReportError] = useState<string | null>(null);

    // --- Report Config Hook ---
    const {
        availableMetrics,
        selectedMetrics,
        selectedTimeRange,
        timeRanges,
        setSelectedTimeRange,
        handleDragEnd: handleDragEndFromHook,
        removeSelectedMetric,
    } = useReportConfig();

    // Fetch GSC Properties function
    const fetchProperties = useCallback(async () => {
        if (!backendUrl) return;
        setIsLoadingProperties(true);
        setPropertyError(null);
        try {
            const response = await fetch(`${backendUrl}/gsc/properties`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch properties: ${response.statusText}`);
            }
            const data: GscProperty[] = await response.json();
            setGscProperties(data);
        } catch (error: any) {
            console.error('Error fetching GSC properties:', error);
            setPropertyError(error.message || 'An unknown error occurred while fetching properties.');
        } finally {
            setIsLoadingProperties(false);
        }
    }, [backendUrl]);

    // Effect for Authentication
    useEffect(() => {
        const checkAuth = async () => {
            setIsLoadingAuth(true);
            try {
                const response = await fetch(`${backendUrl}/auth/status`);
                if (response.ok) {
                    const data = await response.json();
                    setIsAuthenticated(data.isAuthenticated);
                    if (data.isAuthenticated) {
                        fetchProperties();
                    } else {
                        setGscProperties([]);
                        setSelectedProperty(null);
                    }
                } else {
                    console.error('Failed to fetch auth status:', response.statusText);
                    setIsAuthenticated(false);
                    setGscProperties([]);
                    setSelectedProperty(null);
                }
            } catch (error) {
                console.error('Error checking auth status:', error);
                setIsAuthenticated(false);
                setGscProperties([]);
                setSelectedProperty(null);
            } finally {
                setIsLoadingAuth(false);
            }
        };

        const queryParams = new URLSearchParams(window.location.search);
        const authStatus = queryParams.get('auth_status');
        if (authStatus === 'success') {
            setIsAuthenticated(true);
            setIsLoadingAuth(false);
            fetchProperties();
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (authStatus === 'error') {
            setIsAuthenticated(false);
            setIsLoadingAuth(false);
            const message = queryParams.get('message');
            alert(`Authentication failed: ${message || 'Unknown error'}`);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            checkAuth();
        }
    }, [backendUrl, fetchProperties]);

    // Handle Logout
    const handleLogout = async () => {
        setIsLoadingAuth(true);
        try {
            const response = await fetch(`${backendUrl}/auth/logout`, { method: 'POST' });
            if (response.ok) {
                setIsAuthenticated(false);
                setGscProperties([]);
                setSelectedProperty(null);
                setReportData(null);
                alert('Logged out successfully.');
            } else {
                const data = await response.json();
                console.error('Logout failed:', data.error || response.statusText);
                alert(`Logout failed: ${data.error || 'Please try again.'}`);
            }
        } catch (error) {
            console.error('Error during logout:', error);
            alert('An error occurred during logout.');
        } finally {
            setIsLoadingAuth(false);
        }
    };

    // DND Setup
    const handleDragEnd = (event: DragEndEvent) => handleDragEndFromHook(event);
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

    // Generate Report Function
    const handleGenerateReport = async () => {
        if (!selectedProperty || selectedMetrics.length === 0 || isLoadingReport) {
            console.log('Generate report preconditions not met or already loading.');
            return;
        }

        setReportData(null);
        setReportError(null);
        setIsLoadingReport(true);

        console.log('Generating report for:', selectedProperty);
        console.log('Selected Metrics (for display):', selectedMetrics.map((m) => m.name));
        console.log('Selected Time Range Value:', selectedTimeRange);

        // Prepare Request
        const dateRange = getDateRange(selectedTimeRange);

        if (!dateRange) {
            setReportError('Custom date range selection is not yet implemented.');
            setIsLoadingReport(false);
            return;
        }

        const requestBody = {
            siteUrl: selectedProperty,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: ['query'],
        };

        console.log('Calling backend /gsc/report with body:', requestBody);

        // Call Backend
        try {
            const response = await fetch(`${backendUrl}/gsc/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('Backend error response:', result);
                throw new Error(
                    result.error || `Failed to fetch report: ${response.statusText} (Status: ${response.status})`
                );
            }

            console.log(`Report data received: ${result?.length ?? 0} rows`);
            setReportData(result as ReportRow[]);
        } catch (error: any) {
            console.error('Error fetching report:', error);
            setReportError(error.message || 'An unknown error occurred while generating the report.');
            setReportData(null);
        } finally {
            setIsLoadingReport(false);
        }
    };

    // Render Report Area
    const renderReportArea = () => {
        if (isLoadingReport) {
            return (
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
                        <p className="text-center text-muted-foreground pt-4">Loading report data...</p>
                    </CardContent>
                </Card>
            );
        }
        if (reportError) {
            return (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Report Error</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <p>{reportError}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Please check the console for details or try again.
                        </p>
                    </CardContent>
                </Card>
            );
        }
        if (reportData) {
            return <ReportTable data={reportData} visibleMetrics={selectedMetrics} />;
        }
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Report Results</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center text-muted-foreground">
                    Select metrics, a time range, and click "Generate Report".
                </CardContent>
            </Card>
        );
    };

    // Render Logic
    const renderContent = () => {
        if (isLoadingAuth) {
            return <p className="text-center pt-10">Loading authentication...</p>;
        }
        if (!isAuthenticated) {
            return (
                <Card className="max-w-md mx-auto mt-10">
                    <CardHeader>
                        <CardTitle>Welcome!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            Please log in using the button in the header to build your report.
                        </p>
                    </CardContent>
                </Card>
            );
        }
        if (!selectedProperty) {
            return (
                <PropertySelector
                    properties={gscProperties}
                    selectedProperty={selectedProperty}
                    onSelectProperty={setSelectedProperty}
                    isLoading={isLoadingProperties}
                    error={propertyError}
                />
            );
        }

        return (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Column 1: Available Metrics & Time Range */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Available Metrics</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2">
                                {availableMetrics.map((metric: Metric) => (
                                    <DraggableMetric
                                        key={metric.id}
                                        id={metric.id}
                                        metric={metric}
                                        origin="available"
                                    />
                                ))}
                            </CardContent>
                        </Card>
                        <TimeRangeSelector
                            value={selectedTimeRange}
                            onChange={setSelectedTimeRange}
                            timeRanges={timeRanges}
                        />
                        {/* TODO: Add Custom Date Picker conditionally if selectedTimeRange === 'CUSTOM' */}
                    </div>

                    {/* Column 2: Selected Metrics & Report */}
                    <div className="md:col-span-2 space-y-6">
                        <DroppableArea id="selected-metrics-area" title="Selected Metrics">
                            {selectedMetrics.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {selectedMetrics.map((metric: Metric) => (
                                        <div key={metric.id} className="relative group">
                                            <DraggableMetric
                                                id={metric.id}
                                                metric={metric}
                                                origin="selected-metrics-area"
                                            />
                                            <button
                                                onClick={() => removeSelectedMetric(metric.id)}
                                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                aria-label={`Remove ${metric.name}`}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </DroppableArea>
                        <Separator />
                        <div className="flex justify-end">
                            <Button
                                onClick={handleGenerateReport}
                                disabled={selectedMetrics.length === 0 || isLoadingReport || !selectedProperty}
                            >
                                {isLoadingReport ? 'Generating...' : 'Generate Report'}
                            </Button>
                        </div>
                        <div className="mt-6">{renderReportArea()}</div>
                        {/* TODO: Add Export buttons here later */}
                    </div>
                </div>
            </DndContext>
        );
    };

    return (
        <>
            <Head>
                <title>Custom GSC Report Builder</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div className="min-h-screen bg-background text-foreground">
                <header className="flex justify-between items-center p-4 border-b">
                    <h1 className="text-2xl font-semibold">Custom Report Builder</h1>
                    <div className="flex items-center gap-4">
                        {selectedProperty && (
                            <span className="text-sm text-muted-foreground hidden md:inline">
                                Property: {selectedProperty}
                            </span>
                        )}
                        <AuthButton
                            isAuthenticated={isAuthenticated}
                            onLogout={handleLogout}
                            isLoading={isLoadingAuth}
                        />
                    </div>
                </header>
                <main className="p-4 md:p-8">{renderContent()}</main>
                <footer className="mt-12 p-4 text-center text-muted-foreground text-sm border-t">
                    Powered by Next.js, Node.js, GSC API, and Gemini API
                </footer>
            </div>
        </>
    );
}