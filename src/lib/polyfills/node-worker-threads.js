/**
 * Polyfill for node:worker_threads module
 */

export class Worker {
  constructor() {
    throw new Error('Worker threads are not supported in this environment')
  }
  terminate() {}
}

export const isMainThread = true
export const parentPort = null
export const threadId = 0
export const workerData = null

export function markAsUntransferable() {}
export function moveMessagePortToContext() {}
export function receiveMessageOnPort() {
  return null
}
export function resourceLimits() {
  return {}
}
export function setEnvironmentData() {}
export function getEnvironmentData() {
  return null
}

export default {
  Worker,
  isMainThread,
  parentPort,
  threadId,
  workerData,
  markAsUntransferable,
  moveMessagePortToContext,
  receiveMessageOnPort,
  resourceLimits,
  setEnvironmentData,
  getEnvironmentData,
}
