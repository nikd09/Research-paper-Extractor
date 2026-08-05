"""
Run cross-paper synthesis over everything already in outputs/json/.

Runs ONCE per invocation (not per-paper) -- this is the on-demand
knowledge-synthesis step, separate from the main per-paper pipeline
(main.py). Produces knowledge_base/seat_recliner_synthesis_<model>.md and
.json.

Usage:
    python synthesize.py --model flash
    python synthesize.py --model pro
    python synthesize.py --model flash --envelope "..."

Run both --model flash and --model pro to compare outputs side by side --
that was the whole point of making this selectable rather than hardcoded.
"""

import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from src.knowledge_base.synthesizer import Synthesizer

DEFAULT_ENVELOPE = (
    "Automotive seat recliner pivot/bushing mechanism: low sliding speed "
    "(oscillatory, not continuous rotation), boundary-lubricated or dry "
    "sliding, light-to-moderate contact pressure, indoor cabin temperature "
    "range (roughly -20C to 80C), multi-year maintenance-free service life, "
    "priority on low friction (avoid squeak/stick-slip), low wear, and no "
    "grease contamination of upholstery."
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model", choices=["flash", "pro"], required=True,
        help="Which model tier to use for this synthesis run.",
    )
    parser.add_argument(
        "--envelope", default=DEFAULT_ENVELOPE,
        help="Operating envelope description to rank materials against. "
             "Edit DEFAULT_ENVELOPE in this file to change the default, "
             "or pass --envelope to override for a one-off run.",
    )
    args = parser.parse_args()

    print("=" * 80)
    print(f"CROSS-PAPER SYNTHESIS -- model={args.model}")
    print("=" * 80)

    synthesizer = Synthesizer(model_key=args.model)
    report = synthesizer.run(operating_envelope=args.envelope)

    print("\n" + "=" * 80)
    print(f"SYNTHESIS COMPLETE -- {len(report.ranked_materials)} material(s) ranked, "
          f"{len(report.contradictions)} contradiction(s), {len(report.gaps)} gap(s) noted.")
    print(f"See knowledge_base/seat_recliner_synthesis_{args.model}.md")
    print("=" * 80)


if __name__ == "__main__":
    main()