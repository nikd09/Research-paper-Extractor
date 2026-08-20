"""
Free-tier-only sequential key cascade.

Tries GEMINI_API_KEY_1, then _2, then _4, in that fixed order, uniformly
for every pipeline stage -- there is no separate "paid" pool any more; key
#4 used to be held back as a forced-paid last resort, it's now just the
third key in the same cascade. On 429 / RESOURCE_EXHAUSTED, marks that key
exhausted until the next daily reset (midnight Pacific) and moves to the
next key in the list.

Rate limits are per Google Cloud PROJECT, not per key -- if two of these
keys share one project, having both in the cascade buys zero extra
capacity. This class only rotates; it can't fix that upstream setup issue.
"""

from datetime import datetime, timedelta, timezone
from typing import List

from src.utils.logger import Logger

_PACIFIC_OFFSET = timedelta(hours=-8)  # PT (no DST handling -- good enough for a daily reset check)


def _next_pacific_midnight() -> datetime:
    now_pt = datetime.now(timezone.utc) + _PACIFIC_OFFSET
    reset_pt = (now_pt + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return reset_pt - _PACIFIC_OFFSET  # back to UTC for comparison


class KeyManager:

    def __init__(self, keys: List[str]):
        self.keys = [k for k in keys if k]
        self._exhausted_until = {}  # key -> utc datetime

    def _is_exhausted(self, key: str) -> bool:
        until = self._exhausted_until.get(key)
        if until is None:
            return False
        if datetime.now(timezone.utc) >= until:
            del self._exhausted_until[key]
            return False
        return True

    def mark_exhausted(self, key: str):
        self._exhausted_until[key] = _next_pacific_midnight()
        Logger.warning("API key exhausted (429) -- rotating to the next key in the cascade.")

    def sequence(self) -> List[str]:
        """Fixed Key 1 -> Key 2 -> Key 4 cascade, skipping any key
        currently marked exhausted from an earlier 429 today."""
        available = [k for k in self.keys if not self._is_exhausted(k)]
        if not available:
            raise RuntimeError(
                "All free-tier API keys exhausted for today "
                "(GEMINI_API_KEY_1 / GEMINI_API_KEY_2 / GEMINI_API_KEY_4)."
            )
        return available
