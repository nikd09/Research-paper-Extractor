"""
Fills the pack-specific placeholders in prompts/*.md with the active
pack's actual field names/rules, before the prompt text goes to the model.

Deliberately simple string substitution, not a templating engine -- the
handful of tokens below are the only pack-controlled spots in the prompt
files; everything else (the extraction rules, the anti-hallucination
instructions, the confidence-hedging logic) stays fixed prose written by
a human, same as before packs existed. Free-text prose (the compliance
rule, the application description) is owned by the pack file itself
(packs/*/pack.json), not auto-generated here -- see Pack's docstring for
why that stays a human/AI-drafted paragraph rather than assembled from
a flag.
"""

from src.packs.pack import Pack


def _bulleted_field_list(prefix: str, names) -> str:
    return "\n".join(f"- `{prefix}.{n}`" for n in names)


def render(prompt_text: str, pack: Pack) -> str:
    metrics_inline = ", ".join(pack.metrics)
    relevance_bullets = _bulleted_field_list("relevance", pack.relevance_targets)
    relevance_inline = " and ".join(f"`relevance.{n}`" for n in pack.relevance_targets)

    return (
        prompt_text
        .replace("{{PACK_APPLICATION}}", pack.application or pack.name)
        .replace("{{PACK_METRICS_INLINE}}", metrics_inline)
        .replace("{{PACK_RELEVANCE_BULLETS}}", relevance_bullets)
        .replace("{{PACK_RELEVANCE_INLINE}}", relevance_inline)
        .replace("{{PACK_COMPLIANCE_RULE}}", pack.compliance.prompt_text or "(no compliance rule set for this pack)")
    )
