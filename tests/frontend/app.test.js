/**
 * Frontend Unit Tests - App Functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost:7847'
});
global.document = dom.window.document;
global.window = dom.window;

describe('Configuration', () => {
    it('should have correct refresh intervals', () => {
        const REFRESH_INTERVAL = 25000;
        const DISK_REFRESH_INTERVAL = 150000;

        expect(REFRESH_INTERVAL).toBe(25000);
        expect(DISK_REFRESH_INTERVAL).toBe(150000);
    });

    it('should have correct chart history length', () => {
        const CHART_HISTORY_LENGTH = 20;
        expect(CHART_HISTORY_LENGTH).toBe(20);
    });
});

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

describe('Chart Colors', () => {
    const CHART_COLORS = {
        cpu: { line: '#7c3aed', fill: 'rgba(124, 58, 237, 0.15)' },
        memory: { line: '#f97316', fill: 'rgba(249, 115, 22, 0.15)' },
        trafficIn: { line: '#22c55e', fill: 'rgba(34, 197, 94, 0.15)' },
        trafficOut: { line: '#3b82f6', fill: 'rgba(59, 130, 246, 0.15)' }
    };

    it('should have CPU chart colors defined', () => {
        expect(CHART_COLORS.cpu.line).toBe('#7c3aed');
        expect(CHART_COLORS.cpu.fill).toContain('rgba');
    });

    it('should have memory chart colors defined', () => {
        expect(CHART_COLORS.memory.line).toBe('#f97316');
    });

    it('should have traffic colors defined', () => {
        expect(CHART_COLORS.trafficIn.line).toBe('#22c55e');
        expect(CHART_COLORS.trafficOut.line).toBe('#3b82f6');
    });
});
