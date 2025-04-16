// frontend/src/app/full-report/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ReportTable } from '../../components/ReportTable'; // Reuse ReportTable
import { Metric, DisplayRow } from '../../types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

export default function FullReportPage() {
    const [fullData, setFullData] = useState<Partial<DisplayRow>[]>([]);
    const [visibleMetrics, setVisibleMetrics] = useState<Metric[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const router = useRouter();

    useEffect(() => {
        try {
            const storedData = localStorage.getItem('fullGscReportData');
            const storedMetrics = localStorage.getItem('selectedMetricsForFullView');

            if (storedData && storedMetrics) {
                setFullData(JSON.parse(storedData));
                setVisibleMetrics(JSON.parse(storedMetrics));
            } else {
                setError("Full report data not found in storage. Please generate a report first.");
            }
        } catch (e: any) {
            console.error("Error loading full report data:", e);
            setError(`Failed to load report data: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const filteredData = useMemo(() => {
        if (!fullData) return [];
        // Add gemini placeholders so ReportTable doesn't break
        const dataWithPlaceholders = fullData.map(row => ({
            ...row,
            query: row.query as string, // Ensure query is string
            geminiIntent: '-',
            geminiCategory: '-',
            isSampled: false,
        }));
        if (!filter) return dataWithPlaceholders;
        return dataWithPlaceholders.filter(row =>
            row.query?.toLowerCase().includes(filter.toLowerCase())
        );
    }, [fullData, filter]);

    const handleExportFull = () => {
        if (!filteredData || filteredData.length === 0) {
            alert("No data available to export.");
            return;
        }
        // Use only the relevant headers (exclude AI)
        const headers = [
            { key: 'query', label: 'Query' },
            ...visibleMetrics.map(m => ({ key: `${m.apiName}_${m.timePeriod}`, label: m.name })),
        ];
        const csvData = filteredData.map(row => {
            const rowData: { [key: string]: any } = {};
            headers.forEach(header => {
                rowData[header.label] = (row as any)[header.key] ?? '';
            });
            return rowData;
        });
        try {
            const csv = Papa.unparse(csvData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const date = new Date().toISOString().split('T')[0];
            saveAs(blob, `serprisingly_full_report_${date}.csv`);
        } catch (err) {
            console.error("Error generating CSV:", err);
            setError("Failed to generate CSV file.");
        }
    };


    return (
        <div className="min-h-screen flex flex-col bg-muted/40">
            <header className="flex justify-between items-center p-4 border-b bg-primary text-primary-foreground shadow-sm sticky top-0 z-50 h-[65px]">
                <h1 className="text-xl font-semibold">Full GSC Report Data</h1>
                <Button variant="outline" size="sm" onClick={() => router.back()} className="text-primary-foreground hover:bg-primary-foreground/10 border-primary-foreground/50">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Builder
                </Button>
            </header>
            <main className="flex-grow container mx-auto px-4 py-6 md:px-6 md:py-8">
                {isLoading && (
                    <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
                )}
                {error && (
                    <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
                )}
                {!isLoading && !error && fullData.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                            <Input
                                placeholder={`Filter ${fullData.length} queries...`}
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="max-w-full sm:max-w-xs"
                            />
                            <Button variant="outline" size="sm" onClick={handleExportFull} disabled={filteredData.length === 0}>
                                <Download className="h-4 w-4 mr-2" /> Export Displayed (CSV)
                            </Button>
                        </div>
                        {/* Reuse ReportTable, AI columns will show '-' */}
                        <ReportTable data={filteredData} visibleMetrics={visibleMetrics} />
                    </div>
                )}
                {!isLoading && !error && fullData.length === 0 && (
                    <Card><CardHeader><CardTitle>No Data</CardTitle></CardHeader><CardContent><p>No data was found in local storage. Please return to the builder and generate a report.</p></CardContent></Card>
                )}
            </main>
        </div>
    );
}