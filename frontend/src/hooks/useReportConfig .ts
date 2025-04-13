import { useState, useCallback } from 'react';
import { Metric, TimeRangeOption } from '../types';
import type { DragEndEvent } from '@dnd-kit/core';

// Update metrics to include apiName for backend mapping
const INITIAL_AVAILABLE_METRICS: Metric[] = [
    { id: 'metric-clicks', name: 'Clicks', apiName: 'clicks' },
    { id: 'metric-impressions', name: 'Impressions', apiName: 'impressions' },
    { id: 'metric-ctr', name: 'CTR', apiName: 'ctr' },
    { id: 'metric-position', name: 'Position', apiName: 'position' },
];

// Add CUSTOM option
const TIME_RANGES: TimeRangeOption[] = [
    { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
    { value: 'LAST_28_DAYS', label: 'Last 28 Days' },
    { value: 'LAST_3_MONTHS', label: 'Last 3 Months' },
    { value: 'LAST_6_MONTHS', label: 'Last 6 Months' },
    { value: 'LAST_12_MONTHS', label: 'Last 12 Months' },
    { value: 'LAST_16_MONTHS', label: 'Last 16 Months' },
    { value: 'CUSTOM', label: 'Custom Range...' }, // Added Custom
];

interface UseReportConfigReturn {
    availableMetrics: Metric[];
    selectedMetrics: Metric[];
    selectedTimeRange: string;
    timeRanges: TimeRangeOption[];
    setSelectedTimeRange: (value: string) => void;
    handleDragEnd: (event: DragEndEvent) => void;
    removeSelectedMetric: (metricId: string) => void;
    // Add custom date range state if implementing picker now
    // customStartDate: Date | null;
    // customEndDate: Date | null;
    // setCustomDateRange: (start: Date | null, end: Date | null) => void;
}

export function useReportConfig(): UseReportConfigReturn {
    const [availableMetrics, setAvailableMetrics] = useState<Metric[]>(INITIAL_AVAILABLE_METRICS);
    const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>([]);
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>(TIME_RANGES[1].value); // Default L28D


    const handleDragEnd = useCallback((event: DragEndEvent) => { // <-- Use DragEndEvent
        const { active, over } = event;

        // Check if 'over' exists; it might be null if dropped outside a droppable
        if (!over) {
            // If item originated from selected area and dropped outside, remove it
            if (active.data?.current?.origin === 'selected-metrics-area') {
                setSelectedMetrics((prev) => prev.filter(m => m.id !== active.id));
            }
            return;
        }

        // Dropped onto the selection area
        if (active && over.id === 'selected-metrics-area') {
            const draggedMetric = availableMetrics.find(m => m.id === active.id);
            if (draggedMetric && !selectedMetrics.some(m => m.id === active.id)) {
                setSelectedMetrics((prev) => [...prev, draggedMetric]);
            }
        }
        // Dropped *outside* the selection area (but maybe over another droppable - handle if needed)
        else if (active.data?.current?.origin === 'selected-metrics-area' && over.id !== 'selected-metrics-area') {
            setSelectedMetrics((prev) => prev.filter(m => m.id !== active.id));
        }

    }, [availableMetrics, selectedMetrics]); // Include dependencies

    const removeSelectedMetric = useCallback((metricId: string) => {
        setSelectedMetrics((prev) => prev.filter(m => m.id !== metricId));
    }, []);


    return {
        availableMetrics,
        selectedMetrics,
        selectedTimeRange,
        timeRanges: TIME_RANGES, // Includes CUSTOM now
        setSelectedTimeRange,
        handleDragEnd,
        removeSelectedMetric,
    };
}