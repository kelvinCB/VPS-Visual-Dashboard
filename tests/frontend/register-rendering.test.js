import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, '../../public/register.html'), 'utf-8');

describe('Register Page Rendering', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    dom = new JSDOM(html, {
      url: 'http://localhost/register',
      runScripts: 'dangerously',
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;

    // Mock matchMedia for JSDOM
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
    dom.window.close();
  });

  it('should render the register form correctly', () => {
    expect(document.title).toMatch(/Register/i);
    expect(document.getElementById('register-form')).not.toBeNull();
    expect(document.getElementById('email')).not.toBeNull();
    expect(document.getElementById('password')).not.toBeNull();
    expect(document.getElementById('confirmPassword')).not.toBeNull();
    expect(document.getElementById('submit-btn')).not.toBeNull();
  });

  it('should validate password mismatch and show an error', () => {
    const form = document.getElementById('register-form');
    document.getElementById('email').value = 'test@example.com';
    document.getElementById('password').value = 'password123';
    document.getElementById('confirmPassword').value = 'password124';

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    const error = document.getElementById('error-msg');
    expect(error.style.display).toBe('block');
    expect(error.textContent).toMatch(/match/i);
  });

  it('should set loading state on valid submit', () => {
    vi.useFakeTimers();

    const form = document.getElementById('register-form');
    const submitBtn = document.getElementById('submit-btn');

    document.getElementById('email').value = 'test@example.com';
    document.getElementById('password').value = 'password123';
    document.getElementById('confirmPassword').value = 'password123';

    // Prevent real navigation in JSDOM
    window.onbeforeunload = () => {};

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.classList.contains('is-loading')).toBe(true);

    vi.runAllTimers();
    vi.useRealTimers();
  });
});
