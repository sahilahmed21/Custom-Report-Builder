// frontend/src/components/DndContextWrapper.tsx
import React, { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { Metric } from '../types';
import { DraggableMetric } from './DraggableMetric';

interface DndContextWrapperProps {
    children: React.ReactNode;
    onDragEnd: (event: DragEndEvent) => void;
    metrics: Metric[];
}

export const DndContextWrapper: React.FC<DndContextWrapperProps> = ({ children, onDragEnd, metrics }) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    // Configure sensors for better drag experience
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Minimum distance before drag starts (prevents accidental drags)
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        onDragEnd(event);
    };

    // Find the active drag item for the overlay
    const activeMetric = activeId ? metrics.find(m => `${m.id}` === activeId) : null;

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToWindowEdges]}
        >
            {children}

            {/* Drag overlay provides visual feedback while dragging */}
            <DragOverlay>
                {activeId && activeMetric && (
                    <div className="scale-105 opacity-80 shadow-xl">
                        <DraggableMetric
                            id={activeId}
                            metric={activeMetric}
                        />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
};