// frontend/src/components/ReportTable.tsx
import React, { useMemo } from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Metric, DisplayRow } from '../types'; // Use DisplayRow
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Correct import

const formatNumber = (num: number | undefined | null, fractionDigits = 2): string => {
    if (num === undefined || num === null) return 'N/A';
    if (fractionDigits === 2 && num >= 0 && num <= 1 && num !== 0 && num !== 1) {
        return `${(num * 100).toFixed(2)}%`;
    }
    if (fractionDigits === 1 && num > 0) {
        return num.toFixed(1);
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
};

// Define specific header types
type StaticHeaderConfig = {
    key: 'query' | 'category' | 'geminiCategory' | 'geminiIntent';
    label: string;
    align: 'left' | 'right';
    isMetric: false;
    sampled?: boolean; // Optional sampled flag for AI columns
};

type MetricHeaderConfig = {
    key: string; // Will be like 'clicks_L28D'
    label: string; // Will be like 'Clicks L28D'
    align: 'left' | 'right';
    isMetric: true;
    apiName: string; // e.g., 'clicks'
    sampled?: boolean; // Optional sampled flag for metrics
};

type TableHeaderConfig = StaticHeaderConfig | MetricHeaderConfig;


interface ReportTableProps {
    data: DisplayRow[]; // Expect DisplayRow array
    visibleMetrics: Metric[];
}

export const ReportTable: React.FC<ReportTableProps> = ({ data, visibleMetrics }) => {

    // Generate headers dynamically
    const headers = useMemo((): TableHeaderConfig[] => {
        const dynamicHeaders: MetricHeaderConfig[] = visibleMetrics.map(metric => ({
            key: `${metric.apiName}_${metric.timePeriod}`, // Construct key like 'clicks_L28D'
            label: metric.name, // e.g., Clicks L28D
            align: ['clicks', 'impressions'].includes(metric.apiName) ? 'right' : 'right',
            isMetric: true,
            apiName: metric.apiName,
        }));

        // Define static headers explicitly
        const staticHeaders: StaticHeaderConfig[] = [
            { key: 'query', label: 'Query', align: 'left', isMetric: false },
            { key: 'category', label: 'Category', align: 'left', isMetric: false }, // Static Category column
            { key: 'geminiCategory', label: 'Category (AI)', align: 'right', isMetric: false, sampled: true },
            { key: 'geminiIntent', label: 'Intent (AI)', align: 'left', isMetric: false, sampled: true },
        ];

        // Combine static and dynamic headers in desired order
        return [
            staticHeaders[0], // Query
            staticHeaders[1], // Category
            ...dynamicHeaders, // Dynamic GSC Metrics
            staticHeaders[2], // Gemini Category
            staticHeaders[3], // Gemini Intent
        ];
    }, [visibleMetrics]);

    const getFractionDigits = (apiName: string | undefined): number => { // Added check for undefined apiName
        switch (apiName) {
            case 'ctr': return 2;
            case 'position': return 1;
            default: return 0;
        }
    };

    return (
        <Card className="shadow-md overflow-hidden">
            <CardHeader>
                <CardTitle>Report Results</CardTitle>
                <CardDescription>
                    Displaying {data.length} analyzed {data.length === 1 ? 'query' : 'queries'}...
                    {/* *** FIX: Correct TooltipProvider Structure *** */}
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="outline" className="ml-2 text-xs px-1.5 py-0.5 cursor-help border-dashed border-blue-400 text-blue-600">
                                    Sampled AI Analysis
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>Intent/Category analysis is performed on a sample of queries...</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                {headers.map((header) => (
                                    <TableHead
                                        key={header.key}
                                        className={`py-3 px-4 whitespace-nowrap ${header.align === 'right' ? 'text-right' : 'text-left'}`}
                                    >
                                        {header.label}
                                        {/* *** FIX: Check 'sampled' property safely *** */}
                                        {header.sampled && (
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info size={12} className="ml-1 inline-block text-muted-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Analysis based on sampled data.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.length > 0 ? (
                                data.map((row, index) => (
                                    <TableRow key={`${row.query}-${index}`} className="hover:bg-muted/30">
                                        {headers.map((header) => (
                                            <TableCell
                                                key={header.key}
                                                className={`py-2 px-4 ${header.align === 'right' ? 'text-right' : 'text-left'} ${header.key === 'query' ? 'font-medium' : ''} ${header.key.startsWith('gemini') ? 'text-sm text-muted-foreground' : ''}`}
                                            >
                                                {/* *** FIX: Use type guard 'isMetric' and check properties safely *** */}
                                                {header.isMetric ? (
                                                    formatNumber(row[header.key] as number | undefined, getFractionDigits(header.apiName))
                                                ) : header.key === 'category' ? (
                                                    <span className="italic text-gray-400">N/A</span>
                                                ) : header.key === 'geminiCategory' ? (
                                                    row.geminiCategory ?? '-'
                                                ) : header.key === 'geminiIntent' ? (
                                                    row.geminiIntent ?? '-'
                                                    // Access query safely as DisplayRow guarantees it exists
                                                ) : header.key === 'query' ? (
                                                    row.query
                                                ) : (
                                                    // Fallback for any unexpected static keys
                                                    row[header.key] ?? '-'
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={headers.length} className="h-24 text-center text-muted-foreground">
                                        <Info className="mx-auto mb-2 h-6 w-6" />
                                        No analyzed results found or available yet...
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};