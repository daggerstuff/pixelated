# Memory API v1 Changelog

Contract version is advertised via the `X-Memory-Contract-Version` response
header (currently `1.0.0`). URI versioning (`/api/v1/memory/*`) is the
breaking-change boundary; the header version is not bumped for pre-launch
contract refinements.

## [Unreleased]

### Changed

- **Search input field unified to `q`**: `POST /api/v1/memory/search` now
  accepts `q` in the JSON body, matching `GET /api/v1/memory/search?q=…`. Early
  integrators who sent `{ "query": "…" }` should switch to `{ "q": "…" }`.
  Response bodies still echo the search string in the `query` field.
