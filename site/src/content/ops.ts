export interface StageRoute {
  stage: string
  models: string
  keys: string
  paid: boolean
  note: string
}

/** Straight from STAGE_CONFIG in src/utils/config.py. */
export const STAGE_ROUTING: StageRoute[] = [
  {
    stage: 'extract',
    models: 'gemini-3.6-flash → gemini-3.5-flash',
    keys: 'free pool, round-robin',
    paid: false,
    note: 'paid_fallback: True — the paid key is reachable, not preferred',
  },
  {
    stage: 'verify',
    models: 'cascade: flash on free keys, then flash on the paid key',
    keys: 'cascade',
    paid: false,
    note: 'Pro is deliberately absent from this cascade',
  },
  {
    stage: 'crosscheck',
    models: 'gemini-3.5-flash-lite → gemini-3.6-flash',
    keys: 'free pool',
    paid: false,
    note: 'paid_fallback: True — the cheapest model in the system, doing the second opinion, with a Flash fallback if flash-lite is exhausted',
  },
  {
    stage: 'verify_escalate',
    models: 'gemini-3.1-pro-preview',
    keys: 'paid key only',
    paid: true,
    note: 'force_paid: True, thinking_level: medium — and it only runs when something is flagged',
  },
  {
    stage: 'rag',
    models: 'gemini-3.6-flash → gemini-3.5-flash',
    keys: 'free pool',
    paid: false,
    note: 'markdown and chunks in one call',
  },
  {
    stage: 'synthesis',
    models: 'flash or pro, by flag',
    keys: 'free pool, or forced paid for pro',
    paid: false,
    note: 'built dynamically in synthesize.py — the one stage where the tier is a decision',
  },
]

export const ROTATION_CODE = `def mark_exhausted(self, key: str):
    self._exhausted_until[key] = _next_pacific_midnight()
    label = "paid key" if key == self.paid_key else "free key"
    Logger.warning(f"{label} exhausted (429) -- rotating.")

def sequence(self, force_paid=False, paid_fallback=True):
    """Ordered list of keys to try for one logical call."""
    if force_paid:
        return [self.paid_key]

    available = self.available_free_keys()
    if available:
        # round-robin start so load spreads across keys instead
        # of always hammering key #1 first
        start = self._cursor % len(available)
        ordered = available[start:] + available[:start]
        self._cursor += 1`

export const PER_PROJECT_NOTE = `# Rate limits are per Google Cloud PROJECT,
# not per key -- if two "free keys" share one
# project, rotating between them buys zero extra
# capacity. This class only rotates; it can't fix
# that upstream setup issue.`
