"use client";

import React from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TimeRangeOption } from '../types';

interface TimeRangeSelectorProps {
    value: string;
    onChange: (value: string) => void;
    timeRanges?: TimeRangeOption[];
}

export function TimeRangeSelector({
    value,
    onChange,
    timeRanges = [],
}: TimeRangeSelectorProps) {
    return (
        <div className="space-y-2">
            <Label htmlFor="time-range-select">Select Time Range</Label>
            <Select value={value} onValueChange={onChange} name="time-range-select">
                <SelectTrigger id="time-range-select" className="w-[280px]">
                    <SelectValue placeholder="Select time range..." />
                </SelectTrigger>
                <SelectContent>
                    {timeRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                            {range.label}
                            {/* Optional: Add indicator for custom */}
                            {/* {range.value === 'CUSTOM' && <span className="text-xs text-muted-foreground ml-1">(requires date selection)</span>} */}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}