"""Request-local audit attribution and narrowly scoped signal controls."""

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator


_actor = ContextVar('inventory_audit_actor', default=None)
_tag_audit_suppressed = ContextVar('inventory_tag_audit_suppressed', default=False)


@contextmanager
def audit_actor(user) -> Iterator[None]:
    """Attribute model-level audit events to the current authenticated user."""

    token = _actor.set(user)
    try:
        yield
    finally:
        _actor.reset(token)


def get_audit_actor():
    return _actor.get()


@contextmanager
def suppress_tag_audit() -> Iterator[None]:
    """Allow a caller to emit one coalesced tag-change record."""

    token = _tag_audit_suppressed.set(True)
    try:
        yield
    finally:
        _tag_audit_suppressed.reset(token)


def tag_audit_is_suppressed() -> bool:
    return _tag_audit_suppressed.get()
