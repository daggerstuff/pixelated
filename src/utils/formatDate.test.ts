/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { formatDate } from './formatDate';

describe('formatDate', () => {
  describe('relative formatting', () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2023-05-15T10:00:00Z'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it('formats "just now" correctly', () => {
      const date = new Date('2023-05-15T09:59:30Z');
      expect(formatDate(date, { relative: true })).toBe('just now');
    });

    it('formats "5 minutes ago" correctly', () => {
      const date = new Date('2023-05-15T09:55:00Z');
      expect(formatDate(date, { relative: true })).toBe('5 minutes ago');
    });

    it('formats "1 hour ago" correctly', () => {
      const date = new Date('2023-05-15T09:00:00Z');
      expect(formatDate(date, { relative: true })).toBe('1 hour ago');
    });

    it('formats "1 day ago" correctly', () => {
      const date = new Date('2023-05-14T10:00:00Z');
      expect(formatDate(date, { relative: true })).toBe('1 day ago');
    });

    it('formats "1 week ago" correctly', () => {
      const date = new Date('2023-05-08T10:00:00Z');
      expect(formatDate(date, { relative: true })).toBe('1 week ago');
    });
  });

  describe('absolute formatting', () => {
    it('formats date correctly', () => {
      const date = new Date('2023-05-15T10:00:00Z');
      expect(formatDate(date)).toBe('May 15, 2023');
    });
  });
});
