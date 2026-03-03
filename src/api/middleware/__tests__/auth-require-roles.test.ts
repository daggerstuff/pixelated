import { describe, it, expect, vi } from 'vitest'
import { requireRoles } from '../auth'
import { Request, Response } from 'express'

describe('requireRoles middleware', () => {
  it('should allow access when user has the required role in user.role (singular)', () => {
    const middleware = requireRoles(['admin'])
    const req = {
      user: { role: 'admin' }
    } as any as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    } as any as Response
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('should allow access when user has the required role in user.roles (plural)', () => {
    const middleware = requireRoles(['admin'])
    const req = {
      user: { roles: ['admin', 'user'] }
    } as any as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    } as any as Response
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('should reject access when user has neither singular nor plural required role', () => {
    const middleware = requireRoles(['admin'])
    const req = {
      user: { role: 'user', roles: ['guest'] }
    } as any as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    } as any as Response
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'FORBIDDEN'
    }))
  })
})
