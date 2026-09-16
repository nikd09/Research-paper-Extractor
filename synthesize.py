"""
Run cross-paper synthesis over everything already in outputs/json/.

Runs ONCE per invocation (not per-paper) -- this is the on-demand
knowledge-synthesis step, separate from the main per-paper pipeline
(main.py). Produces knowledge_base/<pack>_synthesis_<model>.md and .json.

Which pack (research focus) this runs under -- which metrics it expects,
what the compliance rule means, the default operating envelope -- comes
from packs/<id>/pack.json (see src/packs/). Unlike the main per-paper
pipeline, synthesis doesn't validate anything into the pack-shaped
PaperAnalysis schema (it reads outputs/json/*.json as plain JSON and
hands it to the model as text), so --pack here can switch which pack's
synthesis config is used for THIS run without needing a process restart.

Usage:
    python synthesize.py --model flash
    python synthesize.py --model pro
    python synthesize.py --model flash --envelope "..."
    python synthesize.py --model flash --pack pfas-corrosion

Run both --model flash and --model pro to compare outputs side by side --
that was the whole point of making this selectable rather than hardcoded.
"""

import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from src.knowledge_base.synthesizer import Synthesizer
from src.packs.loader import PackLoader


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model", choices=["flash", "pro"], required=True,
        help="Which model tier to use for this synthesis run.",
    )
    parser.add_argument(
        "--pack", default=None,
        help="Which pack to run this synthesis under (see packs/*/pack.json). "
             "Defaults to whichever pack is currently active "
             "(packs/active_pack.json). Passing this also makes it the "
             "active pack for future runs, same as PackLoader.set_active().",
    )
    parser.add_argument(
        "--envelope", default=None,
        help="Operating envelope description to rank materials against. "
             "Defaults to the selected pack's own envelope text "
             "(edit packs/<id>/pack.json to change that default).",
    )
    args = parser.parse_args()

    if args.pack:
        PackLoader.set_active(args.pack)

    pack = PackLoader.get_active()
    envelope = args.envelope if args.envelope is not None else pack.envelope

    print("=" * 80)
    print(f"CROSS-PAPER SYNTHESIS -- pack={pack.id} model={args.model}")
    print("=" * 80)

    synthesizer = Synthesizer(model_key=args.model)
    report = synthesizer.run(operating_envelope=envelope)

    print("\n" + "=" * 80)
    print(f"SYNTHESIS COMPLETE -- {len(report.ranked_materials)} material(s) ranked, "
          f"{len(report.contradictions)} contradiction(s), {len(report.gaps)} gap(s) noted.")
    print(f"See knowledge_base/{pack.id}_synthesis_{args.model}.md")
    print("=" * 80)


if __name__ == "__main__":
    main()
