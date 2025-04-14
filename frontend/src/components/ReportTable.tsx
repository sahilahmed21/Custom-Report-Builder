// frontend/src/components/ReportTable.tsx
import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReportRow, Metric } from '../types';
import { Info } from 'lucide-react';

const formatNumber = (num: number | undefined | null, fractionDigits = 2): string => {
    if (num === undefined || num === null) return 'N/A';
    if (fractionDigits === 2 && num < 1 && num > 0) {
        return `${(num * 100).toFixed(2)}%`;
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
};

interface ReportTableProps {
    data: ReportRow[];
    visibleMetrics: Metric[];
}

export const ReportTable: React.FC<ReportTableProps> = ({ data, visibleMetrics }) => {
    const visibleMetricMap = new Map(visibleMetrics.map((m) => [m.apiName, m.name]));
    const showGeminiColumns = true;

    const headers = [
        { key: 'query', label: 'Query', align: 'left' },
        ...(visibleMetricMap.has('clicks') ? [{ key: 'clicks', label: 'Clicks', align: 'right' }] : []),
        ...(visibleMetricMap.has('impressions') ? [{ key: 'impressions', label: 'Impressions', align: 'right' }] : []),
        ...(visibleMetricMap.has('ctr') ? [{ key: 'ctr', label: 'CTR', align: 'right' }] : []),
        ...(visibleMetricMap.has('position') ? [{ key: 'position', label: 'Position', align: 'right' }] : []),
        ...(showGeminiColumns ? [{ key: 'geminiCategory', label: 'Category (AI)', align: 'right', sampled: true }] : []),
        ...(showGeminiColumns ? [{ key: 'geminiIntent', label: 'Intent (AI)', align: 'left', sampled: true }] : []),
    ];

    return (
        <Card className="shadow-md overflow-hidden">
            <CardHeader>
                <CardTitle>Report Results</CardTitle>
                <CardDescription>
                    Displaying {data.length} {data.length === 1 ? 'query' : 'queries'} based on your selections and filter.
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="outline"
                                    className="ml-2 text-xs px-1.5 py-0.5 cursor-help border-dashed border-blue-400 text-blue-600"
                                >
                                    Sampled AI Analysis
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p>
                                    Intent/Category analysis is performed on a sample of queries (Top Volume + Click Coverage) to optimize
                                    performance. Rows marked 'N/A' were not included in the sample.
                                </p>
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
                                    <TableRow key={index} className="hover:bg-muted/30">
                                        <TableCell className="py-2 px-4 font-medium">{row.query ?? '-'}</TableCell>
                                        {visibleMetricMap.has('clicks') && (
                                            <TableCell className="py-2 px-4 text-right">{formatNumber(row.clicks, 0)}</TableCell>
                                        )}
                                        {visibleMetricMap.has('impressions') && (
                                            <TableCell className="py-2 px-4 text-right">{formatNumber(row.impressions, 0)}</TableCell>
                                        )}
                                        {visibleMetricMap.has('ctr') && (
                                            <TableCell className="py-2 px-4 text-right">{formatNumber(row.ctr, 2)}</TableCell>
                                        )}
                                        {visibleMetricMap.has('position') && (
                                            <TableCell className="py-2 px-4 text-right">{formatNumber(row.position, 1)}</TableCell>
                                        )}
                                        {showGeminiColumns && (
                                            <>
                                                <TableCell className="py-2 px-4 text-right text-sm text-muted-foreground">
                                                    {row.isSampled ? (
                                                        row.geminiCategory ?? '-'
                                                    ) : (
                                                        <span className="italic text-gray-400">N/A</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 px-4 text-sm text-muted-foreground">
                                                    {row.isSampled ? (
                                                        row.geminiIntent ?? '-'
                                                    ) : (
                                                        <span className="italic text-gray-400">N/A</span>
                                                    )}
                                                </TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={headers.length} className="h-24 text-center text-muted-foreground">
                                        <Info className="mx-auto mb-2 h-6 w-6" />
                                        No results found. Try adjusting the filter or report parameters.
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