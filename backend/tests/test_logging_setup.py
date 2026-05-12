"""Smoke test for centralized logging setup."""
from __future__ import annotations

import logging


def test_setup_logging_idempotent():
    from app.core.logging import get_logger, setup_logging

    setup_logging("DEBUG")
    setup_logging("WARNING")  # second call should not raise

    log = get_logger("manufoundry.test")
    assert isinstance(log, logging.Logger)


def test_get_logger_returns_distinct_namespace():
    from app.core.logging import get_logger

    a = get_logger("app.foo")
    b = get_logger("app.bar")
    assert a is not b
    assert a.name == "app.foo"
