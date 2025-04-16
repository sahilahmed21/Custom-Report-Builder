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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Globe, AlertTriangle, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    // Function to truncate URL for display
    const formatDisplayUrl = (url: string) => {
        if (url.length > 30) {
            return url.substring(0, 27) + '...';
        }
        return url;
    };

    // Find the currently selected property
    const selectedPropertyObject = selectedProperty
        ? properties.find(p => p.siteUrl === selectedProperty)
        : null;

    if (isLoading) {
        return (
            <Card className="max-w-md mx-auto mt-6 border-blue-200">
                <CardContent className="p-6 flex items-center justify-center">
                    <div className="flex flex-col items-center py-6 space-y-2">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground mt-2">Loading GSC properties...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="max-w-md mx-auto mt-6 border-destructive/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-destructive flex items-center gap-2 text-lg">
                        <AlertTriangle className="h-5 w-5" />
                        Error Loading Properties
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="mb-3 text-sm">{error}</p>
                    <div className="p-3 bg-destructive/10 rounded-md flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                        <p className="text-sm">
                            Please ensure you granted access during login or try logging out and back in.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (properties.length === 0 && !isLoading) {
        return (
            <Card className="max-w-md mx-auto mt-6">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Globe className="h-5 w-5" />
                        No Properties Found
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm">No Google Search Console properties were found for this account, or you may not have granted sufficient permissions.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="max-w-lg mx-auto mt-4 shadow-sm border border-border/40">
            <CardHeader className="bg-primary/5 border-b pb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-primary/10">
                        <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Select GSC Property</CardTitle>
                        <CardDescription className="text-sm mt-1">
                            Choose the website you want to generate a report for.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 pt-5 pb-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="gsc-property-select" className="text-sm font-medium">
                            Property
                        </Label>
                        <Badge variant="outline" className="text-xs font-normal">
                            {properties.length} available
                        </Badge>
                    </div>

                    {selectedProperty ? (
                        <div className="mt-2 mb-1">
                            <div className="flex items-center border rounded-md p-2 bg-primary/5">
                                <Badge
                                    variant="default"
                                    className="mr-2 px-2 py-0.5 bg-blue-600"
                                >
                                    {selectedPropertyObject?.permissionLevel || "siteFullUser"}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                    <div className="truncate font-medium text-sm">
                                        {selectedProperty}
                                    </div>
                                </div>
                                <button
                                    onClick={() => onSelectProperty("")}
                                    className="ml-2 text-muted-foreground hover:text-destructive rounded-full p-1 hover:bg-destructive/10 transition-colors"
                                    aria-label="Clear selection"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Select
                                        value={selectedProperty ?? ""}
                                        onValueChange={onSelectProperty}
                                        name="gsc-property-select"
                                    >
                                        <SelectTrigger className={cn(
                                            "w-full transition-all duration-200",
                                            !selectedProperty ? "border-dashed border-primary/40" : "border-solid"
                                        )}>
                                            <SelectValue placeholder="Select a GSC property..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {properties.map(prop => (
                                                <SelectItem
                                                    key={prop.siteUrl}
                                                    value={prop.siteUrl}
                                                    className="cursor-pointer"
                                                >
                                                    <div className="flex items-center">
                                                        <Badge
                                                            variant={prop.permissionLevel === "siteFullUser" ? "default" : "secondary"}
                                                            className="mr-2 text-xs px-2 py-0.5"
                                                        >
                                                            {prop.permissionLevel}
                                                        </Badge>
                                                        <span className="truncate max-w-[180px]">
                                                            {formatDisplayUrl(prop.siteUrl)}
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p>Select a property to analyze</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </CardContent>
            {selectedProperty && (
                <CardFooter className="bg-muted/30 py-3 px-6 border-t flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <p className="text-xs text-muted-foreground">
                        Selected property will be used to fetch query data
                    </p>
                </CardFooter>
            )}
        </Card>
    );
};