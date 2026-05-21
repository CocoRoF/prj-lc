import json
import re
from typing import Any

_NEXT_DATA_RE = re.compile(
    r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S
)
_VIEWER_BROADCAST_RE = re.compile(
    r"window\.__viewerConfig\.broadcast\s*=\s*'(.*?)'\s*\n", re.S
)


def parse_next_data(html: str) -> dict[str, Any] | None:
    m = _NEXT_DATA_RE.search(html)
    if not m:
        return None
    return json.loads(m.group(1))


def parse_viewer_broadcast(html: str) -> dict[str, Any] | None:
    """Extract window.__viewerConfig.broadcast JSON from a /lives/{id} or /replays/{id} page."""
    m = _VIEWER_BROADCAST_RE.search(html)
    if not m:
        return None
    raw = m.group(1)
    raw = raw.encode("utf-8").decode("unicode_escape", errors="replace")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        unescaped = raw.replace("\\/", "/")
        return json.loads(unescaped)
