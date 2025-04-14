// frontend/src/utils/dateUtils.ts
import { format, subDays, subMonths } from 'date-fns';

/**
 * Calculates start and end dates based on a predefined time range string.
 * Adjusts end date to be 2 days prior for typical GSC data availability.
 * @param timePeriodValue - e.g., 'L7D', 'L28D', 'L3M', 'L6M', 'L12M', 'L16M'
 * @returns Object with { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' } or null for invalid input.
 */
export const getDateRange = (timePeriodValue: string): { startDate: string; endDate: string } | null => {
    // GSC data is usually delayed by ~2 days. Set end date accordingly.
    const endDate = subDays(new Date(), 2);
    let startDate: Date;

    switch (timePeriodValue) {
        case 'L7D': // Assuming L7D means last 7 days ending 2 days ago
            startDate = subDays(endDate, 6);
            break;
        case 'L28D':
            startDate = subDays(endDate, 27);
            break;
        case 'L3M':
            startDate = subMonths(endDate, 3);
            // Optional: Adjust day for month length differences? Keep simple for now.
            // startDate.setDate(endDate.getDate());
            break;
        case 'L6M':
            startDate = subMonths(endDate, 6);
            // startDate.setDate(endDate.getDate());
            break;
        case 'L12M':
            startDate = subMonths(endDate, 12);
            // startDate.setDate(endDate.getDate());
            break;
        case 'L16M': // Max supported by API usually
            startDate = subMonths(endDate, 16);
            // startDate.setDate(endDate.getDate());
            break;
        // Add cases for any other time periods you defined (e.g., L6M)
        default:
            console.error(`Unsupported time period value: ${timePeriodValue}`);
            return null; // Indicate error for unsupported periods
    }

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');

    return { startDate: formattedStartDate, endDate: formattedEndDate };
};