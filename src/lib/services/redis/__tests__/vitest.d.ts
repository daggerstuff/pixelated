declare namespace vi {
  interface Matchers<R> {
    toBeRedisError(code: import('../types').RedisErrorCode): R
  }
}
