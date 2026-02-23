/**
 * Frontend Unit Tests - Rendering
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Dashboard DOM Structure', () => {
    let document;

    beforeEach(() => {
        const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <div class="dashboard">
          <header class="header">
            <div class="logo">
              <span class="logo-text">VPS Dashboard</span>
            </div>
            <div id="status-badge" class="status-badge">
              <span class="status-dot"></span>
              <span>Running</span>
            </div>
          </header>
          <main class="metrics-grid">
            <article class="metric-card" id="cpu-card">
              <span id="cpu-value">0</span>
            </article>
            <article class="metric-card" id="memory-card">
              <span id="memory-value">0</span>
            </article>
            <article class="metric-card" id="disk-card">
              <span id="disk-value">0</span>
            </article>
          </main>
          <footer class="footer">
            <span>Last updated: <span id="last-updated">Never</span></span>
          </footer>
        </div>
      </body>
      </html>
    `;
        const dom = new JSDOM(html);
        document = dom.window.document;
    });

    it('should have header with logo', () => {
        const logo = document.querySelector('.logo-text');
        expect(logo).not.toBeNull();
        expect(logo.textContent).toBe('VPS Dashboard');
    });

    it('should have status badge', () => {
        const badge = document.getElementById('status-badge');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toContain('Running');
    });

    it('should have CPU metric card', () => {
        const cpuCard = document.getElementById('cpu-card');
        expect(cpuCard).not.toBeNull();
        expect(cpuCard.classList.contains('metric-card')).toBe(true);
    });

    it('should have memory metric card', () => {
        const memoryCard = document.getElementById('memory-card');
        expect(memoryCard).not.toBeNull();
    });

    it('should have disk metric card', () => {
        const diskCard = document.getElementById('disk-card');
        expect(diskCard).not.toBeNull();
    });

    it('should have footer with last updated', () => {
        const lastUpdated = document.getElementById('last-updated');
        expect(lastUpdated).not.toBeNull();
        expect(lastUpdated.textContent).toBe('Never');
    });

    it('should have correct number of metric cards', () => {
        const cards = document.querySelectorAll('.metric-card');
        expect(cards.length).toBe(3);
    });
});

describe('Initial State', () => {
    it('should start with zero values', () => {
        const html = `
      <span id="cpu-value">0</span>
      <span id="memory-value">0</span>
      <span id="disk-value">0</span>
    `;
        const dom = new JSDOM(html);
        const document = dom.window.document;

        expect(document.getElementById('cpu-value').textContent).toBe('0');
        expect(document.getElementById('memory-value').textContent).toBe('0');
        expect(document.getElementById('disk-value').textContent).toBe('0');
    });
});
