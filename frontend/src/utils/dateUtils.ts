// frontend/src/utils/dateUtils.ts
import { format, subDays, subMonths } from 'date-fns';

/**
 * Calculates start and end dates based on a predefined time range string.
 * @param timeRangeValue - e.g., 'LAST_7_DAYS', 'LAST_28_DAYS', 'LAST_3_MONTHS'
 * @returns Object with { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export const getDateRange = (timeRangeValue: string): { startDate: string; endDate: string } | null => {
    const endDate = new Date(); // Use today as the end date
    let startDate: Date;

    // GSC API typically includes data up to 2-3 days ago.
    // Adjust end date to ensure data availability? For simplicity, let's use today for now.
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');

    switch (timeRangeValue) {
        case 'LAST_7_DAYS':
            startDate = subDays(endDate, 6); // Today + 6 days back = 7 days total
            break;
        case 'LAST_28_DAYS':
            startDate = subDays(endDate, 27);
            break;
        case 'LAST_3_MONTHS':
            startDate = subMonths(endDate, 3);
            // Adjust start day? GSC behavior can be tricky with months.
            // For simplicity, let's just use 3 months back.
            startDate.setDate(endDate.getDate()); // Try to keep the same day of month
            break;
        case 'LAST_6_MONTHS':
            startDate = subMonths(endDate, 6);
            startDate.setDate(endDate.getDate());
            break;
        case 'LAST_12_MONTHS':
            startDate = subMonths(endDate, 12);
            startDate.setDate(endDate.getDate());
            break;
        case 'LAST_16_MONTHS': // Max supported by API usually
            startDate = subMonths(endDate, 16);
            startDate.setDate(endDate.getDate());
            break;
        // case 'CUSTOM':
        //     // Handle custom range - requires start/end from state
        //     // This function would need different parameters for custom
        //     return null; // Or throw error if custom isn't handled here
        default:
            console.warn(`Unsupported time range value: ${timeRangeValue}. Defaulting to LAST_28_DAYS.`);
            startDate = subDays(endDate, 27); // Default fallback
    }

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');

    return { startDate: formattedStartDate, endDate: formattedEndDate };
};