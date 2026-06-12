## 2025-04-18 - Fix SQL injection in Bias Analytics Dashboard

| Vulnerability | Unparameterized string interpolation of URL variables                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Learning      | Using template literals with SQL strings instead of parameterized arrays is an anti-pattern even if the input appears constrained by parseInt |
| Prevention    | Always use the parameter array `[var]` syntax for database queries (e.g., `$1`) alongside server-side boundary validation                     |

## 2025-03-24 - [Information Exposure] Prevent sending raw Error stacks in Mental Health Chat Endpoint

| Vulnerability | The `src/pages/api/mental-health/chat.ts` endpoint was serializing standard `Error` objects (`String(error)`) into the `details` field of the HTTP 500 response, potentially leaking internal stack traces or internal implementation details            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learning      | Sending raw `error` objects or `String(error)` downstream, especially from untrusted or external AI/downstream services, exposes internal logic to the client. This is a classic CWE-209 vulnerability                                                   |
| Prevention    | In generic error handling logic, log the full error context server-side (`console.error` or standard loggers), but always sanitize the response payload sent to the client to only include safe, generic error descriptions like `Internal server error` |

## 2025-05-18 - [Information Exposure] Prevent sending raw Error stacks in Crisis Flags Endpoint

| Vulnerability | The `src/pages/api/crisis/session-flags.ts` endpoint was serializing standard `Error` objects (`String(error)`) into the `message` field of the HTTP 500 response, potentially leaking internal stack traces or internal implementation details          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learning      | Sending raw `error` objects or `String(error)` downstream, especially from untrusted or external AI/downstream services, exposes internal logic to the client. This is a classic CWE-209 vulnerability                                                   |
| Prevention    | In generic error handling logic, log the full error context server-side (`console.error` or standard loggers), but always sanitize the response payload sent to the client to only include safe, generic error descriptions like `Internal server error` |

## 2025-05-24 - [Information Exposure] Prevent sending raw Error messages in Bias Batch Analyze Endpoint

| Vulnerability | The `src/pages/api/bias-detection/batch-analyze.ts` endpoint was directly serializing `(error as Error).message` into the HTTP 500 JSON response. This exposes internal stack details or database error strings to the client, constituting a CWE-209 Information Exposure vulnerability |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learning      | Any server-side error handling must decouple internal logging from external responses. Using `(error as Error).message` directly in `JSON.stringify` within an API route violates this principle                                                                                         |
| Prevention    | Always use a server-side logger (e.g., `createBuildSafeLogger`) to record the full error and stack trace. Return a safe, static generic message such as `Internal server error` to the client                                                                                            |

## 2025-06-10 - [Information Exposure] Prevent sending raw Error messages in Health Simple API

| Vulnerability | The `src/pages/api/health/simple.ts` endpoint was directly serializing `error.message` into the HTTP 503 JSON response. This exposes internal details to the client, constituting a CWE-209 Information Exposure vulnerability |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Learning      | Same as the 2025-03-24 entry: sending raw `error` objects or `String(error)` downstream exposes internal logic to the client (CWE-209)                                                                                         |
| Prevention    | Same as the 2025-05-24 entry: always use a server-side logger to record the full error and stack trace. Return a safe, static generic message such as `Internal server error` to the client                                    |

## 2025-06-11 - [Information Exposure] Prevent sending raw Error messages in Todos API

| Vulnerability | The `src/pages/api/todos.ts` endpoint was directly serializing `error instanceof Error ? String(error) : 'Unknown error'` into the HTTP 500 JSON response message field. This exposes internal details to the client, constituting a CWE-209 Information Exposure vulnerability |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learning      | Same as previous entries: sending raw `error` objects or `String(error)` downstream exposes internal logic to the client (CWE-209)                                                                                                                                              |
| Prevention    | Same as previous entries: always use a server-side logger to record the full error and stack trace. Return a safe, static generic message such as `An unexpected error occurred` to the client                                                                                  |
