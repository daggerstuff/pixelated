"""Simple smoke runner for ingest_utils tests.

This avoids pytest's project conftest loading so CI-local dev can validate
the utilities in isolation.
"""
import time
import sys

from ai.dataset_pipeline.ingest_utils import RateLimiter, read_with_retry


def test_read_with_retry_success_after_failures():
    calls = {'n': 0}

    def flaky():
        calls['n'] += 1
        if calls['n'] < 3:
            raise RuntimeError('transient')
        return b'ok'

    data = read_with_retry(flaky, retry_options={'retries': 5, 'backoff_factor': 0.01, 'jitter': 0.0})
    assert data == b'ok'


def test_read_with_retry_exhausts_retries():
    def always_fail():
        raise ValueError('boom')

    try:
        read_with_retry(always_fail, retry_options={'retries': 2, 'backoff_factor': 0.001, 'jitter': 0.0})
        raise AssertionError('expected exception')
    except ValueError as e:
        assert 'boom' in str(e)


def test_rate_limiter_allows_and_blocks():
    rl = RateLimiter(capacity=2, refill_rate=1.0)
    assert rl.acquire(timeout=0.1) is True
    assert rl.acquire(timeout=0.1) is True
    # now tokens exhausted; immediate acquire with tiny timeout should fail
    assert rl.acquire(timeout=0.05) is False
    # wait for refill (~1s for 1 token)
    time.sleep(1.05)
    assert rl.acquire(timeout=0.1) is True


def run_all():
    tests = [
        test_read_with_retry_success_after_failures,
        test_read_with_retry_exhausts_retries,
        test_rate_limiter_allows_and_blocks,
    ]
    for t in tests:
        name = t.__name__
        try:
            t()
            print(f'PASS: {name}')
        except AssertionError as e:
            print(f'FAIL: {name} - {e}')
            return 2
        except Exception as e:
            print(f'ERROR: {name} - {type(e).__name__}: {e}')
            return 3
    return 0


if __name__ == '__main__':
    rc = run_all()
    sys.exit(rc)
