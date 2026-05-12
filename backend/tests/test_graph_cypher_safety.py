"""Tests for graph router's read-only Cypher guard.

These run without fastapi by importing the helper directly.
"""
from __future__ import annotations

import pytest


def _load_guard():
    """Import the guard helper, skipping if fastapi is unavailable."""
    fastapi = pytest.importorskip("fastapi")  # noqa: F841
    from app.api.graph import _assert_readonly_cypher
    return _assert_readonly_cypher


def test_match_return_passes():
    guard = _load_guard()
    # Should NOT raise
    guard("MATCH (n:Equipment) RETURN n LIMIT 10")
    guard("MATCH (a)-[r]-(b) WHERE a.id = $id RETURN a, r, b")
    guard("UNWIND [1,2,3] AS x RETURN x")


@pytest.mark.parametrize("bad", [
    "CREATE (n:Foo)",
    "match (n) detach delete n",                # case-insensitive
    "MATCH (n) SET n.x = 1",
    "MATCH (n) REMOVE n.x",
    "MERGE (n:Foo {id: 1})",
    "DROP INDEX foo",
    "CALL apoc.export.json.all(null,{})",
    "LOAD CSV FROM 'x' AS line RETURN line",
    "MATCH (n) FOREACH (x IN [1] | SET n.x=1)",
])
def test_write_keywords_rejected(bad: str):
    from fastapi import HTTPException
    guard = _load_guard()
    with pytest.raises(HTTPException) as exc:
        guard(bad)
    assert exc.value.status_code == 400


def test_template_whitelist_is_self_consistent():
    pytest.importorskip("fastapi")
    from app.api.graph import _TEMPLATE_WHITELIST, _assert_readonly_cypher
    # Every shipped template must itself pass the read-only guard.
    for name, cypher in _TEMPLATE_WHITELIST.items():
        _assert_readonly_cypher(cypher)
