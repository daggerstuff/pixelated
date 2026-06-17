## 2024-05-23 - Add test for RateLimiter utility | Pattern: The local test environment has a configuration issue throwing ERR_PACKAGE_PATH_NOT_EXPORTED for vite. We mocked `@upstash/redis` to test the rate limiter functionality. | Action: Fallback to static checks (`oxlint` and `tsc`) if `vitest` throws config-related errors out of our control.
## 2024-05-23 - Add test for `secureRandomHex`

Pattern: The local test environment has a configuration issue throwing `ERR_MODULE_NOT_FOUND` for `./secure-random` due to vite module resolution (`ERR_PACKAGE_PATH_NOT_EXPORTED`).

Action: Fallback to static checks (`oxlint` and `tsc`) if `vitest` throws config-related errors out of our control.
