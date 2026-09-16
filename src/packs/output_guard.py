"""
Phase 4 -- stops two different packs' results from silently ending up in
the same output folder.

Without this, nothing would notice if someone ran the seat-recliner pack
into outputs/, then later ran the pfas-corrosion pack into the SAME
outputs/ folder: the knowledge-base build would happily mix
friction/wear records with corrosion records under one summary, and
nobody would see a warning -- just a knowledge base that quietly makes
less sense than it looks like it does.

The mechanism is deliberately simple: the first time a pack writes into
an output folder, a small marker file records which pack did it. Every
run after that compares the active pack against the marker before doing
anything else, and refuses to continue on a mismatch unless explicitly
overridden.
"""

import json
from pathlib import Path

from src.packs.pack import Pack

MANIFEST_NAME = ".pack_manifest.json"


class PackMismatchError(RuntimeError):
    pass


def _manifest_path(output_dir: str) -> Path:
    return Path(output_dir) / MANIFEST_NAME


def check_output_folder(output_dir: str, pack: Pack, allow_mismatch: bool = False) -> None:
    """Raises PackMismatchError if `output_dir` was already stamped by a
    different pack, unless `allow_mismatch=True`. A folder with no
    manifest yet (new, or pre-existing output from before this system
    existed) passes silently -- there's nothing to compare against."""

    manifest_path = _manifest_path(output_dir)
    if not manifest_path.exists():
        return

    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return  # a corrupt/unreadable manifest shouldn't block a run

    existing_pack_id = data.get("pack_id", "")
    if existing_pack_id and existing_pack_id != pack.id and not allow_mismatch:
        raise PackMismatchError(
            f"'{output_dir}' already holds results from the '{existing_pack_id}' pack, "
            f"but the active pack is '{pack.id}'. Mixing two packs' results in one "
            f"output folder will produce a knowledge base that silently combines two "
            f"different research focuses. Either point this run at a different output "
            f"folder (e.g. the pack's own default: '{pack.output_dir}'), or pass "
            f"allow_mismatch=True if you genuinely intend to combine them."
        )


def stamp_output_folder(output_dir: str, pack: Pack) -> None:
    """Records which pack produced this folder's contents. Safe to call
    every run -- a no-op write if the folder is already stamped with the
    same pack."""

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    manifest_path = _manifest_path(output_dir)
    manifest_path.write_text(
        json.dumps({"pack_id": pack.id, "pack_name": pack.name}, indent=2),
        encoding="utf-8",
    )
