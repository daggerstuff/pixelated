import { describe, it, expect } from 'vitest';
import { matchGlob } from './hook.js';

describe('matchGlob', () => {
  describe('single pattern', () => {
    it('matches exact file', () => {
      expect(matchGlob(['scenarios/foo.yml'], 'scenarios/foo.yml')).toBe(true);
    });

    it('does not match different file', () => {
      expect(matchGlob(['src/bar.ts'], 'scenarios/foo.yml')).toBe(false);
    });
  });

  describe('** wildcard (multi-segment)', () => {
    it('matches files under directory', () => {
      expect(matchGlob(['scenarios/foo.yml', 'src/bar.ts'], 'scenarios/**')).toBe(true);
    });

    it('matches nested files', () => {
      expect(matchGlob(['scenarios/sub/dir/foo.yml'], 'scenarios/**')).toBe(true);
    });

    it('does not match files outside directory', () => {
      expect(matchGlob(['src/bar.ts'], 'scenarios/**')).toBe(false);
    });

    it('matches multiple files if one matches', () => {
      expect(matchGlob(['src/bar.ts', 'scenarios/foo.yml'], 'scenarios/**')).toBe(true);
    });
  });

  describe('* wildcard (single segment)', () => {
    it('matches files in same directory', () => {
      expect(matchGlob(['scenarios/foo.yml'], 'scenarios/*')).toBe(true);
    });

    it('does not match nested files', () => {
      expect(matchGlob(['scenarios/sub/foo.yml'], 'scenarios/*')).toBe(false);
    });

    it('does not match across directory boundary', () => {
      expect(matchGlob(['scenarios/sub/foo.yml'], 'scenarios/*.yml')).toBe(false);
    });
  });

  describe('? wildcard (single char)', () => {
    it('matches single character', () => {
      expect(matchGlob(['a.yml'], '?.yml')).toBe(true);
    });

    it('does not match multiple characters', () => {
      expect(matchGlob(['ab.yml'], '?.yml')).toBe(false);
    });
  });

  describe('dot escaping', () => {
    it('treats . as literal', () => {
      expect(matchGlob(['foo.yml'], 'foo.yml')).toBe(true);
      expect(matchGlob(['fooyml'], 'foo.yml')).toBe(false);
    });
  });

  describe('multiple patterns (| separator)', () => {
    it('matches if any pattern matches', () => {
      expect(matchGlob(['src/bar.ts'], 'scenarios/**|src/**')).toBe(true);
      expect(matchGlob(['scenarios/foo.yml'], 'scenarios/**|src/**')).toBe(true);
    });

    it('does not match if no pattern matches', () => {
      expect(matchGlob(['docs/readme.md'], 'scenarios/**|src/**')).toBe(false);
    });
  });

  describe('empty file list', () => {
    it('returns false for empty list', () => {
      expect(matchGlob([], 'scenarios/**')).toBe(false);
    });
  });

  describe('real-world filters', () => {
    it('matches scenarios/** filter', () => {
      expect(matchGlob(
        ['scenarios/anxiety.yml', 'scenarios/depression.yml'],
        'scenarios/**',
      )).toBe(true);
    });

    it('matches src/session/** filter', () => {
      expect(matchGlob(
        ['src/session/handler.ts', 'src/session/types.ts'],
        'src/session/**',
      )).toBe(true);
    });

    it('does not match src/session/** for non-session files', () => {
      expect(matchGlob(
        ['src/cli/index.ts', 'README.md'],
        'src/session/**',
      )).toBe(false);
    });
  });
});
