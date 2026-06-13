/**
 * @file Memory API Routes Index
 *
 * Canonical public memory API contract for the Pixelated Empathy therapeutic AI system.
 *
 * Base URL: /api/memory
 * Version: v1
 *
 * This file exports all memory-related API routes with standardized RESTful endpoints
 * and proper HTTP status codes as defined in the Foresight project.
 */

export { GET as list } from './list'
export { POST as create } from './create'
export { GET as getById } from './[memoryId]'
export { PATCH as updateById } from './[memoryId]'
export { DELETE as deleteById } from './[memoryId]'
export { GET as search } from './search'
export { GET as stats } from './stats'
