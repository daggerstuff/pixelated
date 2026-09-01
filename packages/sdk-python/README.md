# pixelated-empathy-sdk

Auto-generated Python SDK for the Pixelated Empathy API.

> **Note**: This SDK is generated from the OpenAPI specification at
> `apps/web/src/content-store/docs/api-reference/openapi.yaml`. Do not edit generated
> code manually. Run `scripts/ci/generate-sdks.sh` to regenerate.

## Installation

```bash
pip install pixelated-empathy-sdk
```

## Quick Start

```python
from pixelated_empathy_sdk import ApiClient, Configuration
from pixelated_empathy_sdk.api.default_api import DefaultApi

config = Configuration(
    host="https://api.pixelatedempathy.com",
    api_key={"ApiKeyAuth": "your-api-key"},
)

client = ApiClient(config)
api = DefaultApi(client)

# Search content
results = api.search_content(q="therapy techniques")

# Get profile
profile = api.get_profile()

# Analyze bias
bias_result = api.analyze_bias(
    text="Patient reports feeling anxious...",
    context="therapy_session",
)
```

## Authentication

### API Key (Server-side)

```python
config = Configuration(
    api_key={"ApiKeyAuth": os.environ["PIXELATED_API_KEY"]},
)
```

### JWT (Client-side)

```python
config = Configuration(
    access_token=user_token,
)
```

## Versioning

SDK versions are tied to the API version from the OpenAPI spec. The current API
version is `1.0.0` (API v1).

See [API Versioning Policy](../../src/content-store/docs/api/api-versioning.md)
for deprecation and sunset information.

## Regeneration

```bash
# Requires Java 17+
./scripts/ci/generate-sdks.sh
```

## License

MIT
