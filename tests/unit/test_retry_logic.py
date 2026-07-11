import pytest
from app.worker.worker import retry_delay_ms


def test_retry_delay_increases_exponentially():
    d1 = retry_delay_ms(1)
    d2 = retry_delay_ms(2)
    d3 = retry_delay_ms(3)
    assert d1 < d2 < d3
    assert d2 == d1 * 2
    assert d3 == d1 * 4


def test_retry_delay_first_attempt():
    assert retry_delay_ms(1) == 10_000   # 5s * 2^1


def test_retry_delay_capped_at_1_hour():
    # Very high attempt number should hit the cap
    assert retry_delay_ms(100) == 3_600_000


def test_retry_delay_base():
    assert retry_delay_ms(0) == 5_000   # 5s * 2^0
