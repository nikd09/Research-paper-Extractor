from dotenv import load_dotenv
import os

load_dotenv()

# ==========================
# API Keys
# ==========================
# Free-tier-first policy: FREE_API_KEYS are tried in order (each ideally its
# own Google Cloud project -- rate limits are per-project, not per-key, so
# keys sharing a project do NOT add capacity). PAID_API_KEY (Tier 1) is the
# true last resort: used only once every free key is exhausted for a stage,
# OR for the dedicated escalation stage below.
#
# Key #3 removed (deactivated) -- only 1 and 2 are free-tier now. Nothing
# else needs to change: FREE_API_KEYS below filters out any unset key
# automatically, so a missing/blank GEMINI_API_KEY_3 just means the pool
# has 2 entries instead of 3.

FREE_API_KEYS = [
    k for k in [
        os.getenv("GEMINI_API_KEY_1"),
        os.getenv("GEMINI_API_KEY_2"),
    ] if k
]

PAID_API_KEY = os.getenv("GEMINI_API_KEY_4")

# Backward compat: if someone still only sets GEMINI_API_KEY, treat it as
# free key #1 so older .env files keep working.
_legacy_key = os.getenv("GEMINI_API_KEY")
if _legacy_key and _legacy_key not in FREE_API_KEYS:
    FREE_API_KEYS.insert(0, _legacy_key)

# ==========================
# Gemini Model Configuration
# ==========================

EXTRACT_MODELS = [
    "models/gemini-3.6-flash",
    "models/gemini-3.5-flash",
]

# Verify tries Flash on free keys #1/#2 FIRST, then Flash on the paid key
# if both free keys are exhausted. Pro does NOT run here by default -- it's
# reserved for the automatic escalation stage below (only the specific
# values still flagged after everything else, near-zero cost on clean
# papers).
#
# MANUAL_PRO_VERIFY: flip to True if you've looked at a paper's results and
# Flash isn't cutting it -- this adds a full-paper Pro verification pass
# (not just flagged residuals) after the two Flash steps, on the paid key.
# Flash on free keys is always tried first regardless of this setting; this
# only controls whether Pro gets a full unconditional pass on top.
MANUAL_PRO_VERIFY = False

VERIFY_CASCADE = [
    {"models": ["models/gemini-3.5-flash", "models/gemini-3.6-flash"], "keys": FREE_API_KEYS},
    {"models": ["models/gemini-3.6-flash", "models/gemini-3.5-flash"], "keys": [PAID_API_KEY] if PAID_API_KEY else []},
]

# Last-resort escalation ONLY -- called for the specific claims still
# flagged [unverified]/[crosscheck] after the free-tier verify + crosscheck
# passes. Real last resort: papers with nothing flagged never reach this,
# so cost stays near zero for well-behaved extractions. Swap this one line
# any time to re-test with a cheaper model instead of Pro.
ESCALATION_MODEL = "models/gemini-3.1-pro-preview"

if MANUAL_PRO_VERIFY:
    VERIFY_CASCADE.append(
        {"models": [ESCALATION_MODEL], "keys": [PAID_API_KEY] if PAID_API_KEY else []}
    )

RAG_MODELS = [
    "models/gemini-3.5-flash",
    "models/gemini-3.6-flash",
]

CROSSCHECK_MODELS = [
    "models/gemini-3.5-flash-lite",
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
# synthesize.py's --model flag picks one of these two keys.
SYNTHESIS_MODEL_OPTIONS = {
    "flash": "models/gemini-3.6-flash",
    "pro": "models/gemini-3.1-pro-preview",
}

STAGE_CONFIG = {
    "extract":         {"models": EXTRACT_MODELS,     "keys": FREE_API_KEYS, "paid_fallback": True},
    "verify":          {"cascade": VERIFY_CASCADE, "warn_on_model_fallback": False},
    # thinking_level="medium" only applies here -- ESCALATION_MODEL is the
    # sole model in this stage's list (gemini-3.1-pro-preview), so this can
    # never reach a Flash-tier call. See GeminiClient._generate().
    "verify_escalate": {"models": [ESCALATION_MODEL], "keys": [], "paid_fallback": True, "force_paid": True, "thinking_level": "medium"},
    "rag":             {"models": RAG_MODELS,         "keys": FREE_API_KEYS, "paid_fallback": True},
    "crosscheck":       {"models": CROSSCHECK_MODELS,  "keys": FREE_API_KEYS, "paid_fallback": True},
    # "synthesis" stage config is built dynamically in synthesize.py from
    # SYNTHESIS_MODEL_OPTIONS + the chosen --model flag, since it needs a
    # single model, not a cascade, and the free/paid key routing depends
    # on which of the two options was picked (flash -> free-first, pro ->
    # force paid, same pattern as every other stage above).
}
# Kept for anything still importing the old flat list (e.g. tests).
PREFERRED_MODELS = EXTRACT_MODELS

MAX_RETRIES = 3
REQUEST_TIMEOUT = 120

# Base delay (seconds) between same-model retry attempts, doubled each
# attempt (2s, 4s, 8s, ...). Without this, a sustained failure (a model
# genuinely at capacity, not a one-off blip) burns through every
# attempt/model/key combination back-to-back in seconds -- each one still
# counts against RPD even though it failed, so a no-backoff retry storm
# wastes daily quota fast instead of giving the underlying condition a
# chance to clear.
RETRY_BACKOFF_BASE_SECONDS = 2

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
