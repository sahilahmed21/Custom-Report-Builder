import React, { useMemo, useState } from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Metric, DisplayRow } from '../types';
import { Info, ArrowUpDown, Search, BarChart2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatNumber } from '../utils/numberFormatting';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Define specific header types
type StaticHeaderConfig = {
    key: 'query' | 'category' | 'geminiCategory' | 'geminiIntent';
    label: string;
    align: 'left' | 'right';
    isMetric: false;
    sampled?: boolean;
};

type MetricHeaderConfig = {
    key: string;
    label: string;
    align: 'left' | 'right';
    isMetric: true;
    apiName: string;
    sampled?: boolean;
};

type TableHeaderConfig = StaticHeaderConfig | MetricHeaderConfig;

interface ReportTableProps {
    data: DisplayRow[];
    visibleMetrics: Metric[];
}

export const ReportTable: React.FC<ReportTableProps> = ({ data, visibleMetrics }) => {
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
        key: '',
        direction: null,
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);

    const headers = useMemo((): TableHeaderConfig[] => {
        const dynamicHeaders: MetricHeaderConfig[] = visibleMetrics.map(metric => ({
            key: `${metric.apiName}_${metric.timePeriod}`,
            label: metric.name,
            align: ['clicks', 'impressions'].includes(metric.apiName) ? 'right' : 'right',
            isMetric: true,
            apiName: metric.apiName,
        }));
        const staticHeaders: StaticHeaderConfig[] = [
            { key: 'query', label: 'Query', align: 'left', isMetric: false },
            { key: 'category', label: 'Category', align: 'left', isMetric: false },
            { key: 'geminiCategory', label: 'Category (AI)', align: 'left', isMetric: false, sampled: true },
            { key: 'geminiIntent', label: 'Intent (AI)', align: 'left', isMetric: false, sampled: true },
        ];
        return [staticHeaders[0], staticHeaders[1], ...dynamicHeaders, staticHeaders[2], staticHeaders[3]];
    }, [visibleMetrics]);

    const getFractionDigits = (apiName: string | undefined): number => {
        switch (apiName) {
            case 'ctr': return 2;
            case 'position': return 1;
            default: return 0;
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' | null = 'asc';

        if (sortConfig.key === key) {
            if (sortConfig.direction === 'asc') {
                direction = 'desc';
            } else if (sortConfig.direction === 'desc') {
                direction = null;
            }
        }

        setSortConfig({ key, direction });
    };

    const filteredData = useMemo(() => {
        return data.filter(row =>
            row.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (row.geminiCategory && row.geminiCategory.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (row.geminiIntent && row.geminiIntent.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [data, searchTerm]);

    const sortedData = useMemo(() => {
        if (!sortConfig.key || sortConfig.direction === null) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            // Handle undefined values
            if (aValue === undefined && bValue === undefined) return 0;
            if (aValue === undefined) return 1;
            if (bValue === undefined) return -1;

            // Handle numeric or string comparison
            const comparison = typeof aValue === 'number' && typeof bValue === 'number'
                ? aValue - bValue
                : String(aValue).localeCompare(String(bValue));

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [filteredData, sortConfig]);

    // Get thresholds for conditional formatting
    const getMetricThresholds = (key: string) => {
        const metricValues = data
            .map(row => row[key])
            .filter((value): value is number => typeof value === 'number' && !isNaN(value));

        if (metricValues.length === 0) return { high: Infinity, low: -Infinity };

        metricValues.sort((a, b) => a - b);
        const high = metricValues[Math.floor(metricValues.length * 0.85)];
        const low = metricValues[Math.floor(metricValues.length * 0.15)];

        return { high, low };
    };

    return (
        <Card className="shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <BarChart2 className="h-5 w-5 text-primary" />
                            Report Results
                            <Badge variant="outline" className="ml-2">
                                {filteredData.length} of {data.length}
                            </Badge>
                        </CardTitle>
                        <CardDescription className="text-sm text-muted-foreground mt-1">
                            Displaying analysis for the top queries based on filters and ranking.
                        </CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search queries or categories..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-9"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                {headers.map((header) => (
                                    <TableHead
                                        key={header.key}
                                        className={cn(
                                            'py-3 px-4 whitespace-nowrap transition-colors duration-200',
                                            header.align === 'right' ? 'text-right' : 'text-left',
                                            sortConfig.key === header.key ? 'bg-muted' : ''
                                        )}
                                        onClick={() => handleSort(header.key)}
                                    >
                                        <div className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex items-center">
                                                {header.label}
                                                {header.sampled && (
                                                    <TooltipProvider delayDuration={100}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Info size={12} className="ml-1 inline-block text-muted-foreground cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p className="text-xs">Analysis based on sampled data.</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                            <ArrowUpDown
                                                size={14}
                                                className={cn(
                                                    "ml-1 opacity-0 group-hover:opacity-50",
                                                    sortConfig.key === header.key && sortConfig.direction !== null ? "opacity-100 text-primary" : ""
                                                )}
                                            />
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.length > 0 ? (
                                sortedData.map((row, index) => (
                                    <TableRow
                                        key={`${row.query}-${index}`}
                                        className={cn(
                                            "transition-colors duration-150",
                                            hoveredRow === index ? "bg-muted/40" : "hover:bg-muted/30",
                                            index % 2 === 0 ? "bg-slate-50/30" : ""
                                        )}
                                        onMouseEnter={() => setHoveredRow(index)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                    >
                                        {headers.map((header) => {
                                            // For metrics, determine if the value is high or low
                                            let valueClass = '';
                                            if (header.isMetric && typeof row[header.key] === 'number') {
                                                const { high, low } = getMetricThresholds(header.key);
                                                const value = row[header.key] as number;

                                                if (value >= high) {
                                                    valueClass = header.apiName === 'position' ? 'text-orange-600 font-medium' : 'text-emerald-600 font-medium';
                                                } else if (value <= low) {
                                                    valueClass = header.apiName === 'position' ? 'text-emerald-600 font-medium' : 'text-orange-600 font-medium';
                                                }
                                            }

                                            return (
                                                <TableCell
                                                    key={header.key}
                                                    className={cn(
                                                        'py-2 px-4 transition-all duration-100',
                                                        header.align === 'right' ? 'text-right' : 'text-left',
                                                        header.key === 'query' ? 'font-medium max-w-[300px] truncate' : '',
                                                        header.key.startsWith('gemini') ? 'text-sm text-muted-foreground' : '',
                                                        valueClass
                                                    )}
                                                    title={header.key === 'query' ? row.query : undefined}
                                                >
                                                    {header.isMetric ? (
                                                        <span className="tabular-nums">
                                                            {formatNumber(row[header.key] as number | undefined, getFractionDigits(header.apiName))}
                                                        </span>
                                                    ) : header.key === 'category' ? (
                                                        <span className="italic text-gray-400">N/A</span>
                                                    ) : header.key === 'geminiCategory' ? (
                                                        <Badge variant="outline" className="font-normal bg-slate-50">
                                                            {row.geminiCategory ?? '-'}
                                                        </Badge>
                                                    ) : header.key === 'geminiIntent' ? (
                                                        <Badge variant="outline" className="font-normal bg-slate-50">
                                                            {row.geminiIntent ?? '-'}
                                                        </Badge>
                                                    ) : header.key === 'query' ? (
                                                        <span className="font-medium">{row.query}</span>
                                                    ) : (
                                                        row[header.key] ?? '-'
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={headers.length} className="h-24 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Search className="h-8 w-8 text-muted-foreground/50" />
                                            <p>No matching results found. Try adjusting your search or filters.</p>
                                        </div>
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