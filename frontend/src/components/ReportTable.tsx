// frontend/src/components/ReportTable.tsx
import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableCaption, // Optional caption
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportRow, Metric } from '../types'; // Import types

interface ReportTableProps {
    data: ReportRow[];
    visibleMetrics: Metric[]; // Control which columns are shown based on user drag-drop
}

// Helper to format numbers (optional, but nice)
const formatNumber = (num: number | undefined | null, fractionDigits = 2): string => {
    if (num === undefined || num === null) return 'N/A';
    // Format CTR as percentage
    if (fractionDigits === 2 && num < 1 && num > 0) { // Assuming CTR is the main decimal < 1
        return `${(num * 100).toFixed(2)}%`;
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
};

export const ReportTable: React.FC<ReportTableProps> = ({ data, visibleMetrics }) => {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Report Results</CardTitle>
                </CardHeader>
                <CardContent className="p-6 text-center text-muted-foreground">
                    No data found for the selected criteria.
                </CardContent>
            </Card>
        );
    }

    // Create a map for quick lookup of visible metrics by their apiName
    const visibleMetricMap = new Map(visibleMetrics.map(m => [m.apiName, m.name]));

    // Define all possible headers, but filter based on visibleMetrics
    const headers = [
        { key: 'query', label: 'Query' }, // Always show query
        // Conditionally add metric headers based on visibleMetrics
        ...(visibleMetricMap.has('clicks') ? [{ key: 'clicks', label: 'Clicks' }] : []),
        ...(visibleMetricMap.has('impressions') ? [{ key: 'impressions', label: 'Impressions' }] : []),
        ...(visibleMetricMap.has('ctr') ? [{ key: 'ctr', label: 'CTR' }] : []),
        ...(visibleMetricMap.has('position') ? [{ key: 'position', label: 'Position' }] : []),
        // Add Gemini headers later
        // { key: 'geminiCategory', label: 'Category (AI)' },
        // { key: 'geminiIntent', label: 'Intent (AI)' },
    ];


    return (
        <Card>
            <CardHeader>
                <CardTitle>Report Results</CardTitle>
                {/* Optional: Add download buttons here */}
            </CardHeader>
            <CardContent className="p-0"> {/* Remove padding for full-width table */}
                <Table>
                    <TableCaption>
                        Search performance data for the selected period. {data.length} rows shown.
                    </TableCaption>
                    <TableHeader>
                        <TableRow>
                            {headers.map((header) => (
                                <TableHead key={header.key} className={header.key !== 'query' ? 'text-right' : ''}>
                                    {header.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((row, index) => (
                            <TableRow key={index}>
                                {/* Always render Query */}
                                <TableCell className="font-medium">{row.keys[0]}</TableCell>

                                {/* Conditionally render metric cells */}
                                {visibleMetricMap.has('clicks') && (
                                    <TableCell className="text-right">{formatNumber(row.clicks, 0)}</TableCell>
                                )}
                                {visibleMetricMap.has('impressions') && (
                                    <TableCell className="text-right">{formatNumber(row.impressions, 0)}</TableCell>
                                )}
                                {visibleMetricMap.has('ctr') && (
                                    <TableCell className="text-right">{formatNumber(row.ctr, 2)}</TableCell> // Percentage format
                                )}
                                {visibleMetricMap.has('position') && (
                                    <TableCell className="text-right">{formatNumber(row.position, 1)}</TableCell>
                                )}
                                {/* Add Gemini cells later */}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};