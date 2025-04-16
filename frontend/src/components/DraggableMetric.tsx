// frontend/src/components/DraggableMetric.tsx
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { GripVertical, MousePointerClick, Eye, BarChart, Trophy } from 'lucide-react';
import { Metric } from '../types';

interface DraggableMetricProps {
    id: string;
    metric: Metric;
    origin?: string;
}

export const DraggableMetric: React.FC<DraggableMetricProps> = ({ id, metric, origin = 'available' }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: id,
        data: {
            name: metric.name,
            origin: origin
        }
    });

    // Enhanced styling with animation effects
    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none'
    };

    // Determine badge color based on metric type
    const getBadgeVariant = () => {
        if (metric.name.includes('Clicks')) return 'default';
        if (metric.name.includes('Impressions')) return 'outline';
        if (metric.name.includes('CTR')) return 'secondary';
        if (metric.name.includes('Position')) return 'destructive';
        return 'secondary';
    };

    // Get icon based on metric type
    const getMetricIcon = () => {
        if (metric.name.includes('Clicks')) return <MousePointerClick size={14} />;
        if (metric.name.includes('Impressions')) return <Eye size={14} />;
        if (metric.name.includes('CTR')) return <BarChart size={14} />;
        if (metric.name.includes('Position')) return <Trophy size={14} />;
        return <BarChart size={14} />;
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="select-none touch-none"
        >
            <div className={`
                rounded-md py-1.5 px-2 shadow-sm
                flex items-center gap-1.5
                transform transition-all duration-200
                ${isDragging ? 'shadow-md scale-105' : 'hover:shadow-md hover:-translate-y-0.5'}
                ${getBadgeColor(metric.name)}
            `}>
                <GripVertical size={14} className="text-gray-400 flex-shrink-0 mr-0.5" aria-hidden="true" />
                <span className="flex-shrink-0 text-foreground/80">{getMetricIcon()}</span>
                <span className="text-sm font-medium">{metric.name}</span>
            </div>
        </div>
    );
};

// Helper function to get badge colors
function getBadgeColor(metricName: string): string {
    if (metricName.includes('Clicks'))
        return 'bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300';
    if (metricName.includes('Impressions'))
        return 'bg-green-50 border border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300';
    if (metricName.includes('CTR'))
        return 'bg-purple-50 border border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300';
    if (metricName.includes('Position'))
        return 'bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300';
    return 'bg-gray-50 border border-gray-200 text-gray-700 dark:bg-gray-900/30 dark:border-gray-800 dark:text-gray-300';
}
