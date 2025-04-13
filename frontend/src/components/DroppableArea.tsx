// frontend/src/components/DroppableArea.tsx
import React, { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils'; // shadcn utility

interface DroppableAreaProps {
    id: string;
    title: string;
    children: ReactNode; // Use ReactNode for children type
}

export const DroppableArea: React.FC<DroppableAreaProps> = ({ id, title, children }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
    });

    return (
        <Card
            ref={setNodeRef}
            className={cn(
                "border-2 border-dashed transition-colors duration-200 min-h-[150px]", // Added min-height
                isOver ? "border-primary bg-primary/10" : "border-border bg-card"
            )}
        >
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4"> {/* Adjusted padding */}
                {children}
                {/* Show placeholder only if children is empty *and* not dragging over */}
                {React.Children.count(children) === 0 && !isOver && (
                    <p className="text-sm text-muted-foreground text-center pt-4">
                        Drag metrics here
                    </p>
                )}
                {isOver && (
                    <p className="text-sm text-primary text-center pt-4 font-semibold">
                        Drop here
                    </p>
                )}
            </CardContent>
        </Card>
    );
}