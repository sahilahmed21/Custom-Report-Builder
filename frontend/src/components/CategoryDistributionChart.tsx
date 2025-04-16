// frontend/src/components/CategoryDistributionChart.tsx
"use client";

import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DisplayRow } from '../types';
import { BarChart3 } from 'lucide-react';

interface CategoryDistributionChartProps {
    data: DisplayRow[];
}

// Define colors for the chart segments
const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
    '#1E90FF', '#32CD32', '#FF6347', '#FFD700', '#9370DB'
];

// Custom Tooltip Content
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white border shadow-sm rounded-md p-3 text-sm">
                <p className="font-medium">{`${data.name}`}</p>
                <p className="text-muted-foreground">{`Count: ${data.value}`}</p>
                <p className="text-muted-foreground text-xs">{`${Math.round((data.value / data.totalCount) * 100)}%`}</p>
            </div>
        );
    }
    return null;
};

export const CategoryDistributionChart: React.FC<CategoryDistributionChartProps> = ({ data }) => {
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

    const categoryData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const counts = new Map<string, number>();
        let validEntries = 0;
        let totalCount = 0;

        data.forEach(row => {
            const category = row.geminiCategory;
            if (
                category &&
                typeof category === 'string' &&
                category !== 'Pending...' &&
                category !== 'Error' &&
                category !== 'Analysis Error' &&
                category !== 'Blocked'
            ) {
                counts.set(category, (counts.get(category) || 0) + 1);
                validEntries++;
                totalCount++;
            }
        });

        if (validEntries === 0) return [];

        return Array.from(counts.entries())
            .map(([name, value]) => ({ name, value, totalCount }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    if (categoryData.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-base flex items-center gap-2"><BarChart3 size={16} /> Category Distribution</CardTitle>
                    <CardDescription className="text-xs">Based on analyzed queries</CardDescription>
                </CardHeader>
                <CardContent className="min-h-[240px] flex items-center justify-center">
                    <p className="text-sm text-muted-foreground italic">
                        {data.length > 0 ? "Awaiting category analysis..." : "No data to analyze."}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full overflow-visible">
            <CardHeader className="pb-0 pt-4">
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 size={16} /> Category Distribution</CardTitle>
                <CardDescription className="text-xs">Based on analyzed queries</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex flex-col h-[320px]">
                    {/* Chart Section */}
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={70}
                                    innerRadius={35}
                                    fill="#8884d8"
                                    paddingAngle={3}
                                    dataKey="value"
                                    nameKey="name"
                                    stroke="#fff"
                                    strokeWidth={2}
                                    label={false}
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Enhanced Labels Section with hover effect */}
                    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto max-h-[120px] pl-2">
                        {categoryData.map((entry, index) => (
                            <div
                                key={`legend-${index}`}
                                className="flex items-center text-sm relative group cursor-pointer h-6"
                                onMouseEnter={() => setHoveredCategory(entry.name)}
                                onMouseLeave={() => setHoveredCategory(null)}
                            >
                                <div
                                    className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />

                                <div className="flex-1 min-w-0">
                                    <span className="truncate block">{entry.name}</span>

                                    {/* Tooltip for full category name */}
                                    {hoveredCategory === entry.name && (
                                        <div className="absolute z-10 bg-gray-800 text-white p-2 rounded text-xs whitespace-nowrap bottom-full mb-1 left-0">
                                            {entry.name}
                                        </div>
                                    )}
                                </div>

                                <span className="ml-1 text-muted-foreground flex-shrink-0">({entry.value})</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};