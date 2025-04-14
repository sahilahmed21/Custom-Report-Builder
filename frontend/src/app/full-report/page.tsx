// frontend/src/app/full-report/page.tsx (NEW FILE)
"use client";

import React, { useEffect, useState } from 'react';
import { ReportRow, Metric } from '../../types'; // Assuming types are accessible
import { ReportTable } from '../../components/ReportTable'; // Reuse the table component
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function FullReportPage() {
    const [fullData, setFullData] = useState<ReportRow[] | null>(null);
    const [metrics, setMetrics] = useState<Metric[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const storedData = localStorage.getItem('fullGscReportData');
            const storedMetrics = localStorage.getItem('selectedMetricsForFullView');
            if (storedData && storedMetrics) {
                setFullData(JSON.parse(storedData));
                setMetrics(JSON.parse(storedMetrics));
                // Optional: Clear item after reading to prevent stale data later
                // localStorage.removeItem('fullGscReportData');
                // localStorage.removeItem('selectedMetricsForFullView');
            } else {
                setError("Full report data not found. Please generate a report first.");
            }
        } catch (e) {
            console.error("Failed to load full report data:", e);
            setError("Failed to load full report data from storage.");
        }
    }, []);

    return (
        <div className="min-h-screen flex flex-col">
            <header className="flex justify-between items-center p-4 border-b bg-primary text-primary-foreground shadow-sm sticky top-0 z-10">
                <h1 className="text-xl font-semibold">Full GSC Report Data</h1>
                <Button variant="outline" size="sm" asChild className="text-primary-foreground hover:bg-primary-foreground/10 border-primary-foreground/50">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Builder
                    </Link>
                </Button>
            </header>
            <main className="flex-grow container mx-auto px-4 py-6 md:px-6 md:py-8">
                {error && <p className="text-red-600">{error}</p>}
                {fullData && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Complete GSC Query Data</CardTitle>
                            <CardDescription>Displaying all {fullData.length} rows fetched from Google Search Console for the selected period (no AI analysis shown here).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Reuse ReportTable, but it won't show AI columns */}
                            <ReportTable data={fullData} visibleMetrics={metrics} />
                        </CardContent>
                    </Card>
                )}
                {!fullData && !error && <p>Loading full data...</p>}
            </main>
        </div>
    );
}