// frontend/src/hooks/useReportConfig.ts
import { useState, useCallback, useMemo } from 'react';
import { Metric } from '../types';
import type { DragEndEvent } from '@dnd-kit/core';

// Define all desired metric/time combinations
const ALL_METRICS_CONFIG: Omit<Metric, 'id'>[] = [
    { name: 'Clicks L7D', apiName: 'clicks', timePeriod: 'L7D' },
    { name: 'Impressions L7D', apiName: 'impressions', timePeriod: 'L7D' },
    { name: 'CTR L7D', apiName: 'ctr', timePeriod: 'L7D' },
    { name: 'Position L7D', apiName: 'position', timePeriod: 'L7D' },

    { name: 'Clicks L28D', apiName: 'clicks', timePeriod: 'L28D' },
    { name: 'Impressions L28D', apiName: 'impressions', timePeriod: 'L28D' },
    { name: 'CTR L28D', apiName: 'ctr', timePeriod: 'L28D' },
    { name: 'Position L28D', apiName: 'position', timePeriod: 'L28D' },

    { name: 'Clicks L3M', apiName: 'clicks', timePeriod: 'L3M' },
    { name: 'Impressions L3M', apiName: 'impressions', timePeriod: 'L3M' },
    { name: 'CTR L3M', apiName: 'ctr', timePeriod: 'L3M' },
    { name: 'Position L3M', apiName: 'position', timePeriod: 'L3M' },
    // Add L6M, L12M etc. if needed following the same pattern
];

// Generate unique IDs
const INITIAL_AVAILABLE_METRICS: Metric[] = ALL_METRICS_CONFIG.map(m => ({
    ...m,
    id: `metric-${m.apiName}-${m.timePeriod}`
}));


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

        const draggedMetric = INITIAL_AVAILABLE_METRICS.find(m => m.id === active.id);
        if (!draggedMetric) return; // Should not happen

        const originIsSelected = active.data?.current?.origin === 'selected-metrics-area';
        const targetIsSelected = over?.id === 'selected-metrics-area';

        if (targetIsSelected && !originIsSelected) {
            // Dragged from Available to Selected
            if (!selectedMetrics.some(m => m.id === active.id)) {
                setSelectedMetrics((prev) => [...prev, draggedMetric]);
                // Optional: Remove from available list visually? Maybe not needed.
            }
        } else if (!targetIsSelected && originIsSelected) {
            // Dragged from Selected back to Available (or dropped outside)
            setSelectedMetrics((prev) => prev.filter(m => m.id !== active.id));
            // Optional: Add back to available list visually?
        }
        // Ignore drops on self or invalid areas without moving between zones
    }, [selectedMetrics]);

    const removeSelectedMetric = useCallback((metricId: string) => {
        setSelectedMetrics((prev) => prev.filter(m => m.id !== metricId));
        // Optional: Add back to available list visually?
    }, []);

    // Filter available metrics based on what's already selected
    const filteredAvailableMetrics = useMemo(() => {
        const selectedIds = new Set(selectedMetrics.map(m => m.id));
        return INITIAL_AVAILABLE_METRICS.filter(m => !selectedIds.has(m.id));
    }, [selectedMetrics]);


    return {
        availableMetrics: filteredAvailableMetrics, // Show only unselected metrics
        selectedMetrics,
        handleDragEnd,
        removeSelectedMetric,
    };
}