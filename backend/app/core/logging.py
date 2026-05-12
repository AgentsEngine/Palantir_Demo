"""Centralized logging configuration.

Replaces scattered `print(...)` calls and bare `except: pass` patterns.
"""
import logging
import sys
from logging.config import dictConfig


def setup_logging(level: str = "INFO") -> None:
    """Configure root + uvicorn loggers with a unified format."""
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                    "datefmt": "%Y-%m-%d %H:%M:%S",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "stream": sys.stdout,
                    "formatter": "default",
                    "level": level,
                },
            },
            "loggers": {
                "": {"handlers": ["console"], "level": level},
                "uvicorn": {"handlers": ["console"], "level": level, "propagate": False},
                "uvicorn.error": {"handlers": ["console"], "level": level, "propagate": False},
                "uvicorn.access": {"handlers": ["console"], "level": "WARNING", "propagate": False},
                "sqlalchemy.engine": {"handlers": ["console"], "level": "WARNING", "propagate": False},
            },
        }
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
