from dotenv import load_dotenv
import os

load_dotenv()

# ==========================
# API Keys
# ==========================
# Unified free-tier-only cascade: GEMINI_API_KEY_1 -> _2 -> _4, tried in
# that fixed order for every stage uniformly (each ideally its own Google
# Cloud project -- rate limits are per-project, not per-key, so keys
# sharing a project do NOT add capacity). There is no separate "paid"
# pool any more -- key #4 used to be held back as a forced-paid last
# resort; it's now just the third key in the same free-tier cascade.
# ESCALATION_MODEL below is a Flash-tier model with a high thinking
# budget instead of a Pro-tier model, so nothing in this pipeline
# deliberately reaches for a paid model any more.
#
# Key #3 removed (deactivated). FREE_API_KEYS below filters out any unset
# key automatically, so a missing/blank key just means a shorter cascade.

FREE_API_KEYS = [
    k for k in [
        os.getenv("GEMINI_API_KEY_1"),
        os.getenv("GEMINI_API_KEY_2"),
        os.getenv("GEMINI_API_KEY_4"),
    ] if k
]

# Backward compat: if someone still only sets GEMINI_API_KEY, treat it as
# free key #1 so older .env files keep working.
_legacy_key = os.getenv("GEMINI_API_KEY")
if _legacy_key and _legacy_key not in FREE_API_KEYS:
    FREE_API_KEYS.insert(0, _legacy_key)

# ==========================
# Gemini Model Configuration
# ==========================
# HOW TO ADD/SWAP A MODEL WHEN GOOGLE SHIPS A NEW ONE:
# Give it its own _FLASH_X_Y constant named after its real version number,
# not a relative label like "latest"/"previous" -- a relative name goes
# stale silently the instant a newer model ships (that's exactly what
# happened here: gemini-3.8-flash shipped and "_FLASH_LATEST" was still
# pointing at 3.6). Then just drop the new constant into whichever
# per-stage list(s) below you want it tried in, in whatever order.
_FLASH_3_8 = "models/gemini-3.8-flash"         # newest (Sept 2026) -- most capable Flash yet
_FLASH_3_7 = "models/gemini-3.7-flash"
_FLASH_3_6 = "models/gemini-3.6-flash"
_FLASH_3_5_LITE = "models/gemini-3.5-flash-lite"  # cheapest/fastest -- crosscheck only

# Extract/verify/rag all try newest-first with two fallbacks behind it
# (3.8 -> 3.7 -> 3.6) instead of just one -- with a tight daily free-tier
# quota, an extra fallback tier means more chances to get through a given
# paper before the whole key/model cascade is exhausted and the paper
# fails outright, and a brand-new model is also less likely to be as
# congested yet as one everyone's already hammering.
EXTRACT_MODELS = [
    _FLASH_3_8,
    _FLASH_3_7,
    _FLASH_3_6,
]

# Verify tries the same 3-model cascade, on whichever key the unified
# cascade hands it (see KeyManager.sequence()). Escalation does NOT run
# here by default -- it's reserved for the automatic escalation stage
# below (only the specific values still flagged after everything else,
# near-zero quota use on clean papers).
#
# MANUAL_PRO_VERIFY: flip to True if you've looked at a paper's results
# and Flash isn't cutting it -- this adds a full-paper high-thinking pass
# (not just flagged residuals) after the three Flash steps. Flash is
# always tried first regardless of this setting; this only controls
# whether the escalation-tier model gets a full unconditional pass on top.
MANUAL_PRO_VERIFY = False

VERIFY_CASCADE = [
    {"models": [_FLASH_3_8, _FLASH_3_7, _FLASH_3_6]},
]

# Last-resort escalation ONLY -- called for the specific claims still
# flagged [unverified]/[crosscheck] after the free-tier verify + crosscheck
# passes. Real last resort: papers with nothing flagged never reach this,
# so quota use stays near zero for well-behaved extractions. Flash-tier
# model with a high thinking budget (see STAGE_CONFIG below) rather than
# a Pro-tier model -- this stage no longer deliberately reaches for a
# paid model. Swap this one line any time to re-test with a different
# model.
ESCALATION_MODEL = _FLASH_3_8

if MANUAL_PRO_VERIFY:
    VERIFY_CASCADE.append({"models": [ESCALATION_MODEL]})

RAG_MODELS = [
    _FLASH_3_8,
    _FLASH_3_7,
    _FLASH_3_6,
]

CROSSCHECK_MODELS = [
    _FLASH_3_5_LITE,
    _FLASH_3_6,
]

# ==========================
# Synthesis stage (cross-paper, run ONCE on-demand -- not per-paper)
# ==========================
# Cost profile here is fundamentally different from every other stage: it
# runs once over the small set of already-extracted, already-verified
# outputs sitting in outputs/json/, not once per PDF. There's no volume to
# control cost against, so unlike extract/verify/crosscheck (deliberately
# cheap-first), this stage is worth spending a stronger model on -- but
# kept selectable rather than hardcoded, since the whole point of adding
# it was to A/B compare flash vs pro on the same input and decide for
# real rather than assume.
#
# synthesize.py's --model flag picks one of these two keys. Both are
# Flash-tier now -- "pro" gets a high thinking budget (see
# Synthesizer.__init__) for deeper reasoning instead of a stronger model.
SYNTHESIS_MODEL_OPTIONS = {
    "flash": _FLASH_3_6,
    "pro": _FLASH_3_8,
}

STAGE_CONFIG = {
    "extract":         {"models": EXTRACT_MODELS},
    "verify":          {"cascade": VERIFY_CASCADE, "warn_on_model_fallback": False},
    # thinking_budget=2048 gives this stage deep chain-of-thought reasoning
    # over contested MetricValue records without needing a Pro-tier model.
    # See GeminiClient._generate().
    "verify_escalate": {"models": [ESCALATION_MODEL], "thinking_budget": 2048},
    "rag":             {"models": RAG_MODELS},
    "crosscheck":      {"models": CROSSCHECK_MODELS},
    # "synthesis" stage config is built dynamically in synthesizer.py from
    # SYNTHESIS_MODEL_OPTIONS + the chosen --model flag, since it needs a
    # single model, not a cascade, and "pro" additionally sets a high
    # thinking_budget (same idea as verify_escalate above).
}
# Kept for anything still importing the old flat list (e.g. tests).
PREFERRED_MODELS = EXTRACT_MODELS

# Retries on the SAME model, for ordinary transient errors only (e.g. a
# dropped connection). Overload errors (503/504/read timeout) are never
# retried on the same model -- see GeminiClient._try_model.
MAX_RETRIES = 2
REQUEST_TIMEOUT = 120

# Delay (seconds) before a same-model retry, doubled each attempt.
RETRY_BACKOFF_BASE_SECONDS = 2

# Sustained "high demand" (503) waves can run several minutes (observed on
# real runs). Hammering the same overloaded models can't help -- and every
# failed call still counts against the daily free-tier quota -- so on a
# capacity error the client moves to the next model immediately, never
# rotates keys (overload is model-wide, not per-key), and after one full
# pass over every model fails it pauses SPIKE_COOLDOWN_SECONDS before
# trying again, up to MAX_FULL_CYCLES passes total. Worst case per call is
# (number of models x MAX_FULL_CYCLES) requests, e.g. 3 x 3 = 9.
SPIKE_COOLDOWN_SECONDS = 60
MAX_FULL_CYCLES = 3

# Enable/disable optional fixes without touching pipeline code
ENABLE_NUMERIC_VALIDATION = True   # Fix #1
ENABLE_MULTIMODAL_VERIFY = True    # Fix #2 (now figure-targeted, not whole-PDF)
ENABLE_TABLE_PREEXTRACTION = True  # Fix #3
ENABLE_CROSSCHECK = True           # Fix #5
ENABLE_ESCALATION = True           # Pro/paid last-resort pass for residual flagged values

# ==========================
# Project Paths
# ==========================

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

PAPERS_DIR = os.path.join(PROJECT_ROOT, "papers")
PROMPTS_DIR = os.path.join(PROJECT_ROOT, "prompts")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "outputs")
LOG_DIR = os.path.join(PROJECT_ROOT, "logs")
SCHEMA_DIR = os.path.join(PROJECT_ROOT, "schemas")
KNOWLEDGE_BASE_DIR = os.path.join(PROJECT_ROOT, "knowledge_base")
