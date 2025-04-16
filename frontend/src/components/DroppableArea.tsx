// frontend/src/components/DroppableArea.tsx
import React, { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowDown, Plus } from 'lucide-react';

interface DroppableAreaProps {
    id: string;
    title: string;
    children: ReactNode;
}

export const DroppableArea: React.FC<DroppableAreaProps> = ({ id, title, children }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
    });

    const isEmpty = React.Children.count(children) === 0;

    return (
        <Card
            ref={setNodeRef}
            className={cn(
                "transition-all duration-200 bg-card",
                isOver
                    ? "shadow-lg ring-2 ring-primary ring-opacity-50"
                    : "shadow-sm hover:shadow",
                isEmpty && !isOver
                    ? "border-dashed"
                    : "border-solid"
            )}
        >
            <CardHeader className={cn(
                "pb-2 border-b bg-muted/30 transition-colors",
                isOver && "bg-primary/5"
            )}>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium flex items-center gap-1.5">
                        {title}
                    </CardTitle>
                    {isEmpty && (
                        <span className="text-xs text-muted-foreground rounded-full px-2 py-0.5 bg-muted">
                            Empty
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className={cn(
                "p-3 transition-all duration-200 min-h-[120px]",
                isOver && "bg-primary/5",
                !isEmpty && "flex flex-wrap gap-2 items-start"
            )}>
                {!isEmpty ? (
                    <div className="flex flex-wrap gap-2">
                        {children}
                    </div>
                ) : (
                    <div className={cn(
                        "h-full flex flex-col items-center justify-center",
                        isOver ? "opacity-100" : "opacity-60"
                    )}>
                        {isOver ? (
                            <div className="flex flex-col items-center animate-pulse">
                                <Plus className="h-6 w-6 text-primary mb-1" />
                                <p className="text-sm font-medium text-primary">Drop to add</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <ArrowDown className="h-5 w-5 text-muted-foreground mb-1" />
                                <p className="text-xs text-muted-foreground">Drag metrics here</p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
