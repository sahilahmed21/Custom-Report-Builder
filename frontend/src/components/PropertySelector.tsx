"use client";

import React from 'react';
import { GscProperty } from '../types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Added Card

interface PropertySelectorProps {
    properties: GscProperty[];
    selectedProperty: string | null;
    onSelectProperty: (value: string) => void;
    isLoading: boolean;
    error: string | null;
}

export const PropertySelector: React.FC<PropertySelectorProps> = ({
    properties,
    selectedProperty,
    onSelectProperty,
    isLoading,
    error
}) => {

    if (isLoading) {
        return <Card className="max-w-md mx-auto mt-10"><CardContent className="p-6 text-center">Loading GSC properties...</CardContent></Card>;
    }

    if (error) {
        return <Card className="max-w-md mx-auto mt-10 border-destructive"><CardHeader><CardTitle className="text-destructive">Error</CardTitle></CardHeader><CardContent><p>{error}</p><p className="mt-2 text-sm text-muted-foreground">Please ensure you granted access during login or try logging out and back in.</p></CardContent></Card>;
    }

    if (properties.length === 0 && !isLoading) {
        return <Card className="max-w-md mx-auto mt-10"><CardHeader><CardTitle>No Properties Found</CardTitle></CardHeader><CardContent><p>No Google Search Console properties were found for this account, or you may not have granted sufficient permissions.</p></CardContent></Card>;
    }

    return (
        <Card className="max-w-lg mx-auto mt-10">
            <CardHeader>
                <CardTitle>Select GSC Property</CardTitle>
                <CardDescription>Choose the website you want to generate a report for.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="gsc-property-select">Property</Label>
                    <Select
                        value={selectedProperty ?? ""}
                        onValueChange={onSelectProperty}
                        name="gsc-property-select"
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a GSC property..." />
                        </SelectTrigger>
                        <SelectContent>
                            {properties.map(prop => (
                                <SelectItem key={prop.siteUrl} value={prop.siteUrl}>
                                    {prop.siteUrl} ({prop.permissionLevel})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
};
