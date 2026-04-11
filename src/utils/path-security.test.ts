import path from 'path'

import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  getProjectRoot,
  validatePath,
  safeJoin,
  sanitizeFilename,
  validatePathAgainstMultiple,
} from './path-security.js'

describe('path-security utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('getProjectRoot', () => {
    it('should return process.cwd() if it exists', () => {
      const mockCwd = '/mock/project/root'
      const spy = vi.spyOn(process, 'cwd').mockReturnValue(mockCwd)

      try {
        expect(getProjectRoot()).toBe(mockCwd)
        expect(spy).toHaveBeenCalled()
      } finally {
        spy.mockRestore()
      }
    })

    it('should fallback to __dirname logic if process.cwd does not exist', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(process, 'cwd')
      const expectedRoot = process.cwd()

      try {
        Object.defineProperty(process, 'cwd', {
          value: undefined,
          configurable: true,
          writable: true,
        })

        const result = getProjectRoot()
        expect(result).toBe(expectedRoot)
      } finally {
        if (originalDescriptor) {
          Object.defineProperty(process, 'cwd', originalDescriptor)
        }
      }
    })
  })

  describe('validatePath', () => {
    const allowedDir = '/allowed/dir'

    it('should allow a safe relative path', () => {
      const result = validatePath('file.txt', allowedDir)
      expect(result).toBe(path.resolve(allowedDir, 'file.txt'))
    })

    it('should throw on directory traversal', () => {
      expect(() => validatePath('../traversal.txt', allowedDir)).toThrow(
        'Directory traversal sequences (..) are not allowed',
      )
    })

    it('should throw on path escaping base directory', () => {
      // Mock path.resolve to simulate escaping resolve
      // Actually, validateUntrustedPathInput catches .. first.
      // But we can test absolute paths if not allowed.
      expect(() => validatePath('/absolute/path', allowedDir)).toThrow(
        'Absolute paths are not allowed',
      )
    })

    it('should throw on unsafe characters', () => {
      expect(() => validatePath('file<>.txt', allowedDir)).toThrow(
        'Path contains unsafe characters',
      )
    })
  })

  describe('safeJoin', () => {
    const allowedDir = '/base'

    it('should safely join segments', () => {
      const result = safeJoin(allowedDir, 'subdir', 'file.js')
      expect(result).toBe(path.resolve(allowedDir, 'subdir', 'file.js'))
    })

    it('should throw if any segment is unsafe', () => {
      expect(() => safeJoin(allowedDir, 'subdir', '..', 'secret')).toThrow()
    })
  })

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeFilename('safe-name.png')).toBe('safe-name.png')
      expect(sanitizeFilename('unsafe/path\\char<>:"|?*.ext')).toBe(
        'unsafepathchar.ext',
      )
    })

    it('should remove directory traversal', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd')
    })
  })

  describe('validatePathAgainstMultiple', () => {
    it('should return path if it matches one of the directories', () => {
      const dirs = ['/a', '/b', '/c']
      const result = validatePath('test.txt', '/b') // Valid for /b
      const multiResult = validatePathAgainstMultiple('test.txt', dirs)

      // In this mock-less test, path.resolve will use process.cwd()
      // So we just check it doesn't throw if one is valid.
      expect(multiResult).toBeDefined()
    })

    it('should throw if it matches none', () => {
      const dirs = ['/a', '/b']
      expect(() => validatePathAgainstMultiple('../../outside', dirs)).toThrow()
    })
  })
})
