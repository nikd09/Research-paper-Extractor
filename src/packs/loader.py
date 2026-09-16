"""
Reads pack definitions from packs/<id>/pack.json and tracks which one is
"active" (packs/active_pack.json -- same tiny-JSON-state-file pattern
gui/gui_settings.json already uses for remembering the last folder/model).

Deliberately resolved once per process, not hot-swapped mid-run: the
active pack determines the shape of the PerformanceMetrics/Relevance
schema (see schema_builder.py), and rebuilding a Pydantic schema in the
middle of a run that's already using the old one is a much harder, much
riskier problem than "switching packs takes effect on the next run/app
restart." A desktop app that's launched fresh per session pays that cost
once, not per paper.
"""

import json
from pathlib import Path
from typing import List

from src.packs.pack import Pack

PACKS_DIR = Path("packs")
ACTIVE_PACK_FILE = PACKS_DIR / "active_pack.json"

DEFAULT_PACK_ID = "seat-recliner"


class PackLoader:

    _active_cache: Pack = None

    @staticmethod
    def _pack_path(pack_id: str) -> Path:
        return PACKS_DIR / pack_id / "pack.json"

    @classmethod
    def load(cls, pack_id: str) -> Pack:
        path = cls._pack_path(pack_id)
        if not path.exists():
            raise FileNotFoundError(
                f"No pack named '{pack_id}' -- expected {path}. "
                f"Available packs: {[p.id for p in cls.list_available()]}"
            )
        data = json.loads(path.read_text(encoding="utf-8"))
        return Pack(**data)

    @classmethod
    def list_available(cls) -> List[Pack]:
        if not PACKS_DIR.exists():
            return []
        packs = []
        for pack_json in sorted(PACKS_DIR.glob("*/pack.json")):
            try:
                packs.append(Pack(**json.loads(pack_json.read_text(encoding="utf-8"))))
            except Exception:
                continue  # a malformed pack shouldn't take the whole list down
        return packs

    @classmethod
    def get_active_id(cls) -> str:
        if ACTIVE_PACK_FILE.exists():
            try:
                data = json.loads(ACTIVE_PACK_FILE.read_text(encoding="utf-8"))
                pid = data.get("active", "")
                if pid and cls._pack_path(pid).exists():
                    return pid
            except Exception:
                pass
        return DEFAULT_PACK_ID

    @classmethod
    def set_active(cls, pack_id: str):
        if not cls._pack_path(pack_id).exists():
            raise FileNotFoundError(f"Can't activate unknown pack '{pack_id}'.")
        PACKS_DIR.mkdir(parents=True, exist_ok=True)
        ACTIVE_PACK_FILE.write_text(
            json.dumps({"active": pack_id}, indent=2), encoding="utf-8"
        )
        cls._active_cache = None  # takes effect next process start -- see module docstring

    @classmethod
    def get_active(cls) -> Pack:
        if cls._active_cache is None:
            try:
                cls._active_cache = cls.load(cls.get_active_id())
            except FileNotFoundError:
                # No packs directory at all yet (e.g. a fresh checkout before
                # packs/seat-recliner/pack.json is created) -- fall back to
                # the built-in defaults so the pipeline still runs.
                cls._active_cache = Pack(
                    id="seat-recliner",
                    name="Seat recliner sliding layer",
                    metrics=[
                        "friction_coefficients", "wear_rates", "mechanical_properties",
                        "loads", "temperatures", "sliding_speeds",
                    ],
                    relevance_targets=["seat_recliner_relevance", "automotive_relevance"],
                )
        return cls._active_cache
