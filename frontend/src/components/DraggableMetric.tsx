// frontend/src/components/DraggableMetric.tsx
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { GripVertical } from 'lucide-react';
import { Metric } from '../types'; // Import your Metric type

interface DraggableMetricProps {
    id: string;
    metric: Metric;
    origin?: string; // Keep optional
}

export const DraggableMetric: React.FC<DraggableMetricProps> = ({ id, metric, origin = 'available' }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: id,
        data: { // Pass extra data if needed
            name: metric.name,
            origin: origin
        }
    });

    // Ensure transform is not null before accessing its properties
    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto', // Ensure dragged item is on top
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none', // Important for touch devices with dnd-kit
    };

    return (
        // Use div as the draggable element wrapper
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <Badge variant="secondary" className="py-2 px-3 text-sm cursor-grab flex items-center gap-2">
                <GripVertical size={16} className="text-gray-400" />
                {metric.name}
            </Badge>
        </div>
    );
}