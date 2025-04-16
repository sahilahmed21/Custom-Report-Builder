"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ReportTable } from '../../components/ReportTable';
import { Metric, DisplayRow } from '../../types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { useDebounce } from '../../hooks/useDebounce'; // Assuming you have or will create this hook

export default function FullReportPage() {
    const [fullData, setFullData] = useState<Partial<DisplayRow>[]>([]);
    const [visibleMetrics, setVisibleMetrics] = useState<Metric[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 50; // Adjustable based on performance needs
    const router = useRouter();

    // Debounce filter input
    const debouncedFilter = useDebounce(filter);

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
        } catch (e: unknown) {
            console.error("Error loading full report data:", e);
            setError(`Failed to load report data: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Filter and paginate data
    const filteredData = useMemo(() => {
        if (!fullData) return [];
        const dataWithPlaceholders = fullData.map(row => ({
            ...row,
            query: row.query as string,
            geminiIntent: '-',
            geminiCategory: '-',
            isSampled: false,
        }));
        const filtered = debouncedFilter
            ? dataWithPlaceholders.filter(row =>
                row.query?.toLowerCase().includes(debouncedFilter.toLowerCase())
            )
            : dataWithPlaceholders;
        const totalPages = Math.ceil(filtered.length / rowsPerPage);
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        return filtered.slice(startIndex, endIndex);
    }, [fullData, debouncedFilter, currentPage, rowsPerPage]);

    const totalPages = useMemo(() => {
        if (!fullData) return 1;
        const filteredCount = debouncedFilter
            ? fullData.filter(row => row.query?.toLowerCase().includes(debouncedFilter.toLowerCase())).length
            : fullData.length;
        return Math.ceil(filteredCount / rowsPerPage);
    }, [fullData, debouncedFilter, rowsPerPage]);

    const handleExportFull = useCallback(() => {
        if (!fullData || fullData.length === 0) {
            alert("No data available to export.");
            return;
        }
        const headers = [
            { key: 'query', label: 'Query' },
            ...visibleMetrics.map(m => ({ key: `${m.apiName}_${m.timePeriod}`, label: m.name })),
        ];
        const csvData = fullData.map(row => {
            const rowData: Record<string, string | number> = {};
            headers.forEach(header => {
                const value = row[header.key as keyof typeof row];
                rowData[header.label] = typeof value === 'boolean' ? String(value) : (value ?? '');
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
    }, [fullData, visibleMetrics]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        setIsLoading(true); // Trigger loading state during page change
        setTimeout(() => setIsLoading(false), 100); // Simulate loading delay
    };

    // Render pagination
    const renderPagination = () => {
        const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
        return (
            <div className="flex justify-center items-center gap-2 mt-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                {pageNumbers.map(number => (
                    <Button
                        key={number}
                        variant={currentPage === number ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(number)}
                    >
                        {number}
                    </Button>
                ))}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                >
                    Next
                </Button>
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({filteredData.length} of {fullData.length} rows)
                </span>
            </div>
        );
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
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
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
                            <Button variant="outline" size="sm" onClick={handleExportFull} disabled={fullData.length === 0}>
                                <Download className="h-4 w-4 mr-2" /> Export All (CSV)
                            </Button>
                        </div>
                        <ReportTable data={filteredData} visibleMetrics={visibleMetrics} />
                        {renderPagination()}
                    </div>
                )}
                {!isLoading && !error && fullData.length === 0 && (
                    <Card>
                        <CardHeader><CardTitle>No Data</CardTitle></CardHeader>
                        <CardContent><p>No data was found in local storage. Please return to the builder and generate a report.</p></CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}