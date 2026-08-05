"""
Free-tier-first key rotation.

Round-robins within a stage's free-key pool. On 429 / RESOURCE_EXHAUSTED,
marks that key exhausted until the next daily reset (midnight Pacific) and
moves to the next free key. Only once every free key in the pool is marked
exhausted does it fall through to the paid key.

Rate limits are per Google Cloud PROJECT, not per key -- if two "free keys"
share one project, rotating between them buys zero extra capacity. This
class only rotates; it can't fix that upstream setup issue.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from src.utils.logger import Logger

_PACIFIC_OFFSET = timedelta(hours=-8)  # PT (no DST handling -- good enough for a daily reset check)


def _next_pacific_midnight() -> datetime:
    now_pt = datetime.now(timezone.utc) + _PACIFIC_OFFSET
    reset_pt = (now_pt + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return reset_pt - _PACIFIC_OFFSET  # back to UTC for comparison


class KeyManager:

    def __init__(self, free_keys: List[str], paid_key: Optional[str]):
        self.free_keys = free_keys
        self.paid_key = paid_key
        self._exhausted_until = {}  # key -> utc datetime
        self._cursor = 0

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
        label = "paid key" if key == self.paid_key else "free key"
        Logger.warning(f"{label} exhausted (429) -- rotating.")

    def available_free_keys(self) -> List[str]:
        return [k for k in self.free_keys if not self._is_exhausted(k)]

    def sequence(self, force_paid: bool = False, paid_fallback: bool = True) -> List[str]:
        """Ordered list of keys to try for one logical call."""
        if force_paid:
            if not self.paid_key:
                raise RuntimeError("Stage requires the paid key (GEMINI_API_KEY_4) but none is set.")
            return [self.paid_key]

        available = self.available_free_keys()
        # round-robin starting point so load spreads across keys instead of
        # always hammering key #1 first
        if available:
            start = self._cursor % len(available)
            ordered = available[start:] + available[:start]
            self._cursor += 1
        else:
            ordered = []

        if paid_fallback and self.paid_key:
            ordered = ordered + [self.paid_key]

        if not ordered:
            raise RuntimeError("All free keys exhausted and no paid key (GEMINI_API_KEY_4) configured.")

        return ordered
