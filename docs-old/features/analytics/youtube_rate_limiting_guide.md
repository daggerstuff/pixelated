# YouTube Rate Limiting and Proxy Support Guide

## Overview

The YouTube processor has been enhanced with production-ready features including rate limiting, proxy rotation, and anti-detection measures. This guide covers how to use these features effectively.

## Features

### 🚦 Rate Limiting
- **Per-minute and per-hour limits** - Configurable request limits to respect YouTube's API constraints
- **Burst limiting** - Control maximum concurrent requests
- **Exponential backoff** - Automatic retry with increasing delays on rate limit errors
- **Jitter support** - Add randomness to prevent thundering herd problems
- **429 response handling** - Automatic detection and handling of rate limit responses

### 🔄 Proxy Support
- **Multiple proxy types** - Support for HTTP, HTTPS, and SOCKS5 proxies
- **Rotation strategies** - Random, round-robin, or sticky proxy selection
- **Failure detection** - Automatic proxy failure detection and removal
- **Health checking** - Optional proxy health verification
- **Retry logic** - Configurable retries per proxy before marking as failed

### 🕵️ Anti-Detection Measures
- **User agent rotation** - Randomize browser user agents
- **Request delays** - Configurable random delays between requests
- **Cookie support** - Maintain session cookies for authenticity
- **Browser simulation** - Simulate real browser behavior
- **Geo-bypass** - Automatic geographic restriction bypass

## Configuration Classes

### RateLimitConfig
```python
@dataclass
class RateLimitConfig:
    enabled: bool = True
    requests_per_minute: int = 30
    requests_per_hour: int = 1000
    burst_limit: int = 5
    backoff_factor: float = 1.5
    max_backoff: int = 300
    jitter: bool = True
    respect_429: bool = True
```

### ProxyConfig
```python
@dataclass
class ProxyConfig:
    enabled: bool = False
    proxy_list: List[str] = field(default_factory=list)
    rotation_strategy: str = "random"  # "random", "round_robin", "sticky"
    proxy_timeout: int = 30
    max_retries_per_proxy: int = 2
    test_url: str = "https://httpbin.org/ip"
```

### AntiDetectionConfig
```python
@dataclass
class AntiDetectionConfig:
    enabled: bool = True
    randomize_user_agents: bool = True
    randomize_delays: bool = True
    min_delay: float = 1.0
    max_delay: float = 5.0
    use_cookies: bool = True
    simulate_browser: bool = True
    geo_bypass: bool = True
```

## Usage Examples

### Basic Rate Limiting
```python
from ai.dataset_pipeline.youtube_processor import (
    YouTubePlaylistProcessor,
    RateLimitConfig
)

# Conservative rate limiting for production
rate_config = RateLimitConfig(
    enabled=True,
    requests_per_minute=15,
    requests_per_hour=500,
    burst_limit=3,
    backoff_factor=2.0,
    max_backoff=600
)

processor = YouTubePlaylistProcessor(
    output_dir="output",
    rate_limit_config=rate_config
)
```

### Proxy Rotation
```python
from ai.dataset_pipeline.youtube_processor import (
    YouTubePlaylistProcessor,
    ProxyConfig
)

# Proxy configuration with rotation
proxy_config = ProxyConfig(
    enabled=True,
    proxy_list=[
        "http://proxy1.example.com:8080",
        "http://proxy2.example.com:8080",
        "socks5://proxy3.example.com:1080"
    ],
    rotation_strategy="random",
    max_retries_per_proxy=2
)

processor = YouTubePlaylistProcessor(
    output_dir="output",
    proxy_config=proxy_config
)
```

### Complete Configuration
```python
# All features enabled
rate_config = RateLimitConfig(
    enabled=True,
    requests_per_minute=25,
    requests_per_hour=800,
    burst_limit=4
)

proxy_config = ProxyConfig(
    enabled=True,
    proxy_list=["http://proxy.example.com:8080"],
    rotation_strategy="random"
)

anti_detection_config = AntiDetectionConfig(
    enabled=True,
    randomize_user_agents=True,
    min_delay=2.0,
    max_delay=6.0,
    use_cookies=True
)

processor = YouTubePlaylistProcessor(
    output_dir="output",
    rate_limit_config=rate_config,
    proxy_config=proxy_config,
    anti_detection_config=anti_detection_config
)
```

## CLI Usage

The enhanced features are fully integrated into the CLI:

```bash
# Basic rate limiting
python scripts/run_voice_pipeline.py \
    --url-file playlists.txt \
    --requests-per-minute 20 \
    --burst-limit 3

# With proxy support
python scripts/run_voice_pipeline.py \
    --url-file playlists.txt \
    --proxy-list proxies.txt \
    --proxy-rotation random

# Stealth mode
python scripts/run_voice_pipeline.py \
    --url-file playlists.txt \
    --requests-per-minute 8 \
    --min-delay 3.0 \
    --max-delay 10.0
```

### CLI Options

#### Rate Limiting
- `--disable-rate-limiting` - Disable rate limiting (not recommended)
- `--requests-per-minute N` - Maximum requests per minute (default: 30)
- `--requests-per-hour N` - Maximum requests per hour (default: 1000)
- `--burst-limit N` - Maximum concurrent requests (default: 5)
- `--backoff-factor F` - Exponential backoff multiplier (default: 1.5)
- `--max-backoff N` - Maximum backoff time in seconds (default: 300)

#### Proxy Support
- `--proxy-list FILE` - File containing list of proxies (one per line)
- `--proxy URL` - Single proxy to use
- `--proxy-rotation STRATEGY` - Rotation strategy: random, round_robin, sticky
- `--proxy-retries N` - Max retries per proxy before marking as failed

#### Anti-Detection
- `--disable-anti-detection` - Disable anti-detection measures
- `--disable-user-agent-rotation` - Disable user agent rotation
- `--min-delay F` - Minimum delay between requests in seconds
- `--max-delay F` - Maximum delay between requests in seconds
- `--disable-cookies` - Disable cookie usage
- `--disable-geo-bypass` - Disable geo-bypass

## Configuration Templates

### Development/Testing
```python
RateLimitConfig(
    enabled=True,
    requests_per_minute=5,
    requests_per_hour=100,
    burst_limit=2
)
```

### Production Conservative
```python
RateLimitConfig(
    enabled=True,
    requests_per_minute=15,
    requests_per_hour=500,
    burst_limit=3,
    backoff_factor=2.0,
    max_backoff=600
)
```

### High-Volume with Proxies
```python
RateLimitConfig(
    enabled=True,
    requests_per_minute=25,
    requests_per_hour=1000,
    burst_limit=6,
    backoff_factor=1.3,
    max_backoff=300
)

ProxyConfig(
    enabled=True,
    rotation_strategy="random",
    max_retries_per_proxy=2
)
```

### Stealth Mode
```python
RateLimitConfig(
    enabled=True,
    requests_per_minute=8,
    requests_per_hour=200,
    burst_limit=2,
    jitter=True
)

AntiDetectionConfig(
    enabled=True,
    randomize_user_agents=True,
    randomize_delays=True,
    min_delay=3.0,
    max_delay=10.0,
    use_cookies=True,
    simulate_browser=True
)
```

## Best Practices

### Rate Limiting
1. **Start conservative** - Begin with low limits and increase gradually
2. **Monitor responses** - Watch for 429 errors and adjust accordingly
3. **Use jitter** - Enable jitter to prevent synchronized requests
4. **Respect backoff** - Always respect exponential backoff delays

### Proxy Usage
1. **Test proxies first** - Verify proxy functionality before bulk processing
2. **Use diverse proxies** - Mix different proxy types and locations
3. **Monitor failures** - Track proxy failure rates and replace bad proxies
4. **Rotate regularly** - Use random or round-robin rotation for best results

### Anti-Detection
1. **Enable all measures** - Use user agent rotation, delays, and cookies
2. **Vary delays** - Use realistic delay ranges (1-5 seconds minimum)
3. **Simulate browsers** - Enable browser simulation for authenticity
4. **Monitor blocks** - Watch for IP blocks and adjust strategies

### Production Deployment
1. **Use configuration files** - Store settings in external config files
2. **Monitor metrics** - Track success rates, errors, and performance
3. **Implement logging** - Log all rate limiting and proxy events
4. **Plan for failures** - Have backup proxies and fallback strategies

## Troubleshooting

### Common Issues
- **429 Errors** - Reduce requests_per_minute or increase delays
- **Proxy Failures** - Check proxy health and replace failed proxies
- **Slow Processing** - Increase burst_limit or reduce delays
- **IP Blocks** - Enable more anti-detection measures or use more proxies

### Monitoring
- Check logs for rate limiting events
- Monitor proxy failure rates
- Track processing speeds and success rates
- Watch for pattern detection by YouTube

## Integration

The enhanced YouTube processor integrates seamlessly with:
- **Voice Pipeline** - Full pipeline support with enhanced configurations
- **CLI Interface** - Complete command-line integration
- **Batch Processing** - Support for large-scale playlist processing
- **Quality Assessment** - Works with all existing quality filtering

For complete examples, see `examples/youtube_rate_limiting_example.py`.
