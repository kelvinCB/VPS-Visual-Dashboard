import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, '../../public/forgot-password.html'), 'utf-8');

describe('Forgot Password Page Rendering', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    dom = new JSDOM(html, {
      url: 'http://localhost/forgot-password',
      runScripts: 'dangerously',
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;

    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    dom.window.close();
  });

  it('should render forgot password form correctly', () => {
    expect(document.title).toMatch(/Forgot Password/i);
    expect(document.getElementById('forgot-form')).not.toBeNull();
    expect(document.getElementById('email')).not.toBeNull();
    expect(document.getElementById('submit-btn')).not.toBeNull();
    expect(document.querySelector('a[href="/login"]')).not.toBeNull();

    const email = document.getElementById('email');
    const submitBtn = document.getElementById('submit-btn');
    expect(email.getAttribute('aria-describedby')).toBe('feedback-msg');
    expect(submitBtn.getAttribute('aria-live')).toBeNull();
  });

  it('should show error feedback for invalid email', () => {
    const form = document.getElementById('forgot-form');
    const email = document.getElementById('email');
    const feedback = document.getElementById('feedback-msg');

    email.value = 'invalid-email';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    expect(feedback.style.display).toBe('block');
    expect(feedback.classList.contains('error')).toBe(true);
    expect(feedback.textContent.toLowerCase()).toContain('valid email');
    expect(email.getAttribute('aria-invalid')).toBe('true');
  });

  it('should show success feedback for valid email', () => {
    vi.useFakeTimers();

    const form = document.getElementById('forgot-form');
    const email = document.getElementById('email');
    const submitBtn = document.getElementById('submit-btn');
    const feedback = document.getElementById('feedback-msg');

    email.value = 'test@example.com';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.classList.contains('is-loading')).toBe(true);

    vi.runAllTimers();

    expect(submitBtn.disabled).toBe(false);
    expect(submitBtn.classList.contains('is-loading')).toBe(false);
    expect(feedback.style.display).toBe('block');
    expect(feedback.classList.contains('success')).toBe(true);
    expect(feedback.textContent.toLowerCase()).toContain('reset link');
    expect(email.getAttribute('aria-invalid')).toBe('false');
  });

  it('should show degraded-mode message when status query is set', () => {
    const dom2 = new JSDOM(html, {
      url: 'http://localhost/forgot-password?status=not-available',
      runScripts: 'dangerously',
      resources: 'usable'
    });

    const feedback = dom2.window.document.getElementById('feedback-msg');
    const email = dom2.window.document.getElementById('email');

    expect(feedback.style.display).toBe('block');
    expect(feedback.classList.contains('error')).toBe(true);
    expect(feedback.textContent.toLowerCase()).toContain('not available');
    expect(email.getAttribute('aria-invalid')).toBe('true');

    dom2.window.close();
  });
});
