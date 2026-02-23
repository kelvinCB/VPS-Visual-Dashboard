/**
 * Frontend Unit Tests - Utilities
 * Pure logic tests for conversion and formatting
 */
import { describe, it, expect } from 'vitest';

describe('formatTrafficValue', () => {
    function formatTrafficValue(bytes) {
        if (bytes === 0) return { value: '0', unit: 'B' };
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const value = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
        return { value: value.toString(), unit: units[i] };
    }

    it('should format 0 bytes', () => {
        const result = formatTrafficValue(0);
        expect(result).toEqual({ value: '0', unit: 'B' });
    });

    it('should format bytes to KB', () => {
        const result = formatTrafficValue(1024);
        expect(result).toEqual({ value: '1', unit: 'KB' });
    });

    it('should format bytes to MB', () => {
        const result = formatTrafficValue(1048576);
        expect(result).toEqual({ value: '1', unit: 'MB' });
    });

    it('should format bytes to GB', () => {
        const result = formatTrafficValue(1073741824);
        expect(result).toEqual({ value: '1', unit: 'GB' });
    });

    it('should handle decimal values', () => {
        const result = formatTrafficValue(1536);
        expect(result).toEqual({ value: '1.5', unit: 'KB' });
    });
});
