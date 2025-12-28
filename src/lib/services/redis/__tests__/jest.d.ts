
declare namespace jest {
  interface Matchers<R> {
    toBeRedisError(code: import('../types').RedisErrorCode): R;
  }
}
