// frontend/src/utils/numberFormatting.ts

/**
 * Formats a number, handling percentages for CTR and decimals for Position.
 * @param num The number to format (or null/undefined)
 * @param fractionDigits Default fraction digits if not CTR/Position
 * @returns Formatted string or 'N/A'
 */
export const formatNumber = (num: number | undefined | null, fractionDigits = 0): string => {
    if (num === undefined || num === null || isNaN(num)) return 'N/A';

    // Handle CTR (typically 0 to 1)
    if (fractionDigits === 2 && num >= 0 && num <= 1) {
        return `${(num * 100).toFixed(2)}%`;
    }
    // Handle Position (typically > 1, show 1 decimal)
    if (fractionDigits === 1 && num > 0) {
        return num.toFixed(1);
    }
    // Handle Clicks/Impressions (integers)
    if (fractionDigits === 0) {
        return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    // Default formatting
    return num.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
};