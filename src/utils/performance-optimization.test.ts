/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupContainment } from './performance-optimization';

describe('performance-optimization', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('setupContainment', () => {
    it('should add CSS contain property to matched elements', () => {
      // Setup DOM
      const el1 = document.createElement('div');
      el1.className = 'test-contain';
      document.body.appendChild(el1);

      const el2 = document.createElement('div');
      el2.className = 'test-contain';
      document.body.appendChild(el2);

      // Call function
      setupContainment('.test-contain', 'strict');

      // Assertions
      expect(el1.style.contain).toBe('strict');
      expect(el2.style.contain).toBe('strict');
    });
  });
});
