// frontend/src/hooks/useReportConfig.ts
import { useState, useCallback } from 'react';
import { Metric } from '../types';
import type { DragEndEvent } from '@dnd-kit/core';

const INITIAL_AVAILABLE_METRICS: Metric[] = [
    { id: 'metric-clicks-l28d', name: 'Clicks L28D', apiName: 'clicks', timePeriod: 'L28D' },
    { id: 'metric-impressions-l28d', name: 'Impressions L28D', apiName: 'impressions', timePeriod: 'L28D' },
    { id: 'metric-ctr-l28d', name: 'CTR L28D', apiName: 'ctr', timePeriod: 'L28D' },
    { id: 'metric-position-l28d', name: 'Position L28D', apiName: 'position', timePeriod: 'L28D' },
    { id: 'metric-clicks-l3m', name: 'Clicks L3M', apiName: 'clicks', timePeriod: 'L3M' },
    { id: 'metric-impressions-l3m', name: 'Impressions L3M', apiName: 'impressions', timePeriod: 'L3M' },
    { id: 'metric-ctr-l3m', name: 'CTR L3M', apiName: 'ctr', timePeriod: 'L3M' },
    { id: 'metric-position-l3m', name: 'Position L3M', apiName: 'position', timePeriod: 'L3M' },
    // Add more as needed
];

interface UseReportConfigReturn {
    availableMetrics: Metric[];
    selectedMetrics: Metric[];
    handleDragEnd: (event: DragEndEvent) => void;
    removeSelectedMetric: (metricId: string) => void;
}

export function useReportConfig(): UseReportConfigReturn {
    const [availableMetrics, setAvailableMetrics] = useState<Metric[]>(INITIAL_AVAILABLE_METRICS);
    const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>([]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) {
            if (active.data?.current?.origin === 'selected-metrics-area') {
                setSelectedMetrics((prev) => prev.filter(m => m.id !== active.id));
            }
            return;
        }
        if (active && over.id === 'selected-metrics-area') {
            const draggedMetric = INITIAL_AVAILABLE_METRICS.find(m => m.id === active.id);
            if (draggedMetric && !selectedMetrics.some(m => m.id === active.id)) {
                setSelectedMetrics((prev) => [...prev, draggedMetric]);
            }
        }
        else if (active.data?.current?.origin === 'selected-metrics-area' && over.id !== 'selected-metrics-area') {
            setSelectedMetrics((prev) => prev.filter(m => m.id !== active.id));
        }
    }, [selectedMetrics]);

    const removeSelectedMetric = useCallback((metricId: string) => {
        setSelectedMetrics((prev) => prev.filter(m => m.id !== metricId));
    }, []);

    return {
        availableMetrics,
        selectedMetrics,
        handleDragEnd,
        removeSelectedMetric,
    };
}