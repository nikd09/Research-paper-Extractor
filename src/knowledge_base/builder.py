"""
Builds knowledge_base/*.md from already-generated outputs/json/*.json.
No API calls -- pure local filtering/reorganization of data the pipeline
already extracted.
"""

import json
from pathlib import Path

NEGATIVE_MARKERS = {
    "", "n/a", "na", "none", "not applicable", "not related",
    "no relevance", "not relevant", "unclear",
}

FILLER_KEYWORDS = [
    "fiber", "fibre", "filler", "glass", "carbon", "talc", "mos2",
    "molybdenum disulfide", "ptfe", "graphite", "nanotube", "mxene",
]


class KnowledgeBaseBuilder:

    def __init__(self, output_dir: str = "outputs", kb_dir: str = "knowledge_base"):
        self.json_dir = Path(output_dir) / "json"
        self.kb_dir = Path(kb_dir)

    @staticmethod
    def _relevance_note(rel_obj) -> str:
        """relevance.*_relevance is now a structured
        {"stated_in_paper": bool, "note": str} record, not a plain string.
        Stay tolerant of the old flat-string shape too, for any JSON files
        still lying around from a pre-restructure pipeline run."""
        if isinstance(rel_obj, dict):
            return (rel_obj.get("note") or "").strip()
        return (rel_obj or "").strip()

    @staticmethod
    def _metric_to_str(mv) -> str:
        """One MetricValue record -> a single readable line. Stays
        tolerant of the old flat-string performance shape too."""
        if isinstance(mv, str):
            return mv
        if not isinstance(mv, dict):
            return str(mv)
        bits = [b for b in [mv.get("material"), mv.get("condition")] if b]
        label = " / ".join(bits)
        value = mv.get("value", "")
        unit = mv.get("unit", "")
        confidence = mv.get("confidence", "")
        hedge = "" if confidence == "confirmed" else f" [{confidence}]" if confidence else ""
        value_str = f"{value} {unit}".strip()
        return f"{label}: {value_str}{hedge}" if label else f"{value_str}{hedge}"

    @staticmethod
    def _mechanism_to_str(entry) -> str:
        """One wear_mechanisms/failure_modes entry -> a single readable
        line. Stays tolerant of the old flat-string shape too, for any
        JSON files still lying around from a pre-restructure pipeline
        run. Never renders the paraphrase in quotes -- that distinction
        belongs to the RAG/Markdown prompt, not this local rebuild step."""
        if isinstance(entry, str):
            return entry
        if not isinstance(entry, dict):
            return str(entry)
        return entry.get("text", "")

    @staticmethod
    def _material_label(entry) -> str:
        """One MaterialEntry -> a readable label with a PFAS/fluoropolymer
        flag when applicable. Stays tolerant of the old flat-string shape
        too, for any JSON files still lying around from a pre-restructure
        pipeline run."""
        if isinstance(entry, str):
            return entry
        if not isinstance(entry, dict):
            return str(entry)
        name = entry.get("name", "")
        if entry.get("contains_fluoropolymer_or_pfas"):
            basis = entry.get("pfas_basis", "")
            basis_note = f" ({basis})" if basis and basis != "not applicable" else ""
            return f"{name} \u26a0\ufe0f PFAS/fluoropolymer{basis_note}"
        return name

    @staticmethod
    def _material_name(entry) -> str:
        """Bare name only, for keyword filtering (fillers.md) -- doesn't
        need the PFAS annotation."""
        if isinstance(entry, str):
            return entry
        if isinstance(entry, dict):
            return entry.get("name", "")
        return str(entry)

    def _is_relevant(self, data: dict) -> bool:
        text = self._relevance_note(data.get("relevance", {}).get("seat_recliner_relevance"))
        return text.lower() not in NEGATIVE_MARKERS

    def _title(self, data: dict, fallback: str) -> str:
        return data.get("metadata", {}).get("title") or fallback

    def _write_section(self, entries, out_path: Path, heading: str, note: str = ""):
        lines = [f"# {heading}", ""]
        if note:
            lines += [f"*{note}*", ""]
        wrote_any = False
        for title, items in entries:
            if not items:
                continue
            wrote_any = True
            lines.append(f"## {title}")
            for it in items:
                lines.append(f"- {it}")
            lines.append("")
        if not wrote_any:
            lines.append("_No entries yet -- no relevant papers processed so far._")
        out_path.write_text("\n".join(lines), encoding="utf-8")

    def build(self):
        self.kb_dir.mkdir(parents=True, exist_ok=True)

        all_json = sorted(self.json_dir.glob("*.json")) if self.json_dir.exists() else []
        papers = []
        for jf in all_json:
            try:
                data = json.loads(jf.read_text(encoding="utf-8"))
            except Exception:
                continue
            if self._is_relevant(data):
                papers.append((jf.stem, data))

        # materials.md
        entries = []
        for stem, d in papers:
            m = d.get("materials", {})
            items = []
            for key in ("materials", "coatings", "lubricants"):
                items += [f"**{key.capitalize()}:** {self._material_label(v)}" for v in m.get(key, [])]
            entries.append((self._title(d, stem), items))
        self._write_section(entries, self.kb_dir / "materials.md", "Materials — Seat Recliner Relevant")

        # wear_mechanisms.md
        entries = []
        for stem, d in papers:
            r = d.get("results", {})
            items = (
                [self._mechanism_to_str(m) for m in r.get("wear_mechanisms", [])]
                + [self._mechanism_to_str(m) for m in r.get("failure_modes", [])]
                + r.get("friction_results", [])
            )
            entries.append((self._title(d, stem), items))
        self._write_section(entries, self.kb_dir / "wear_mechanisms.md", "Wear Mechanisms & Failure Modes")

        # manufacturing.md
        entries = []
        for stem, d in papers:
            ind = d.get("industrial", {})
            items = ind.get("manufacturing_implications", []) + ind.get("design_recommendations", [])
            entries.append((self._title(d, stem), items))
        self._write_section(entries, self.kb_dir / "manufacturing.md", "Manufacturing & Design Recommendations")

        # fillers.md (keyword-filtered, not AI-judged -- transparent about the method)
        entries = []
        for stem, d in papers:
            m = d.get("materials", {})
            candidates = m.get("materials", []) + m.get("coatings", [])
            items = [
                self._material_label(c) for c in candidates
                if any(k in self._material_name(c).lower() for k in FILLER_KEYWORDS)
            ]
            entries.append((self._title(d, stem), items))
        self._write_section(
            entries, self.kb_dir / "fillers.md", "Fillers & Reinforcements",
            note="Keyword-filtered from extracted materials/coatings -- not a separate AI judgment.",
        )

        # seat_recliner.md
        lines = ["# Seat Recliner Relevance — Extracted Findings", ""]
        for stem, d in papers:
            rel = d.get("relevance", {})
            perf = d.get("performance", {})
            lines.append(f"## {self._title(d, stem)}")
            lines.append(f"- **Seat recliner relevance:** {self._relevance_note(rel.get('seat_recliner_relevance'))}")
            auto_note = self._relevance_note(rel.get("automotive_relevance"))
            if auto_note and auto_note.lower() not in NEGATIVE_MARKERS:
                lines.append(f"- **Automotive relevance:** {auto_note}")
            for key in ("friction_coefficients", "loads", "temperatures"):
                if perf.get(key):
                    values_str = "; ".join(self._metric_to_str(mv) for mv in perf[key])
                    lines.append(f"- **{key.replace('_', ' ').title()}:** {values_str}")
            lines.append("")
        if not papers:
            lines.append("_No relevant papers processed yet._")
        (self.kb_dir / "seat_recliner.md").write_text("\n".join(lines), encoding="utf-8")

        # global_summary.md
        lines = ["# Global Summary — Seat Recliner Knowledge Base", "",
                  f"Relevant papers: {len(papers)} / {len(all_json)} processed", ""]
        for stem, d in papers:
            year = d.get("metadata", {}).get("year", "")
            doc_type = d.get("research", {}).get("document_type", "")
            lines.append(
                f"- **{self._title(d, stem)}** ({year}, {doc_type}) — "
                f"full text: `outputs/markdown/{stem}.md`, chunks: `outputs/chunks/{stem}_chunks.json`"
            )
        (self.kb_dir / "global_summary.md").write_text("\n".join(lines), encoding="utf-8")

        return {"scanned": len(all_json), "relevant": len(papers)}
