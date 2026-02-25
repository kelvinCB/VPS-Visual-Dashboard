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
  });
});
