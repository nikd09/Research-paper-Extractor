from typing import List, Optional, Type

from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError
from pydantic import BaseModel

from src.providers.base_provider import BaseProvider
from src.providers.key_manager import KeyManager
from src.utils.config import (
    FREE_API_KEYS,
    PAID_API_KEY,
    STAGE_CONFIG,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
)
from src.utils.logger import Logger


def _is_rate_limit_error(e: Exception) -> bool:
    msg = str(e).upper()
    return "429" in msg or "RESOURCE_EXHAUSTED" in msg or "RATE_LIMIT" in msg


class GeminiClient(BaseProvider):
    """
    Stage-aware Gemini client. Each call specifies which pipeline stage it
    belongs to ("extract" / "verify" / "verify_escalate" / "rag" /
    "crosscheck"); STAGE_CONFIG resolves that to a model cascade and a key
    pool.

    Two config shapes are supported per stage:
      - flat:    {"models": [...], "keys": [...], "paid_fallback": bool}
      - cascade: {"cascade": [{"models": [...], "keys": [...]}, ...],
                  "warn_on_model_fallback": bool}
        Cascade steps are tried in order; a step is skipped entirely if its
        key pool is empty (e.g. free keys all exhausted, or paid key unset).

    model_override / on_fallback are kept for GUI compatibility and only
    affect the "extract" stage's model cascade.
    """

    def __init__(self, model_override: Optional[str] = None, on_fallback=None, timeout_seconds: Optional[int] = None):
        self.key_manager = KeyManager(FREE_API_KEYS, PAID_API_KEY)
        self._clients = {}  # api_key -> genai.Client (cached)
        self.model_override = model_override
        self.on_fallback = on_fallback
        self.active_model = None  # last "extract"-stage working model, for GUI display
        # Per-instance timeout override -- lets a standalone script (like
        # synthesize.py) request a longer budget for a large single call
        # without changing REQUEST_TIMEOUT globally, which would also
        # slow down every stage of the normal per-paper batch pipeline.
        self.timeout_seconds = timeout_seconds or REQUEST_TIMEOUT

        # Confirmed bug fix: processing.model used to be hardcoded to "" and
        # never actually stamped from a real call. This logs the model that
        # actually served EVERY stage (not just "extract"), so
        # processing.models_used can report the full, real call history for
        # traceability and cost auditing -- e.g.
        # {"extract": "gemini-3.6-flash", "verify": "gemini-3.1-pro-preview",
        #  "crosscheck": "gemini-3.5-flash-lite", "escalation": "not_run"}
        self.model_call_log: dict = {}

    def _client_for(self, api_key: str) -> genai.Client:
        if api_key not in self._clients:
            self._clients[api_key] = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(timeout=self.timeout_seconds * 1000),  # ms
            )
        return self._clients[api_key]

    def generate(
        self,
        prompt: str,
        schema: Optional[Type[BaseModel]] = None,
        stage: str = "extract",
        file_path: Optional[str] = None,
        images: Optional[List[bytes]] = None,
    ):
        """
        stage: which STAGE_CONFIG entry to use (models + key pool, or cascade).
        file_path: if set, uploads that file (e.g. the whole source PDF) and
            attaches it as a multimodal part alongside the prompt.
        images: if set, attaches each item (raw PNG/JPEG bytes) as its own
            multimodal image part -- used for targeted figure-page renders
            (Fix #2) instead of the whole PDF, so the model is pointed at
            specific pages rather than searching the entire document.
            Can be combined with file_path; images are listed after it.
        """
        cfg = STAGE_CONFIG.get(stage)
        if not cfg:
            raise ValueError(f"Unknown pipeline stage: {stage}")

        if "cascade" in cfg:
            return self._generate_cascade(
                cfg["cascade"], prompt, schema, file_path, images, stage,
                cfg.get("warn_on_model_fallback", False),
            )

        models = cfg["models"]
        if stage == "extract" and self.model_override:
            models = [self.model_override] + [m for m in models if m != self.model_override]

        key_sequence = self.key_manager.sequence(
            force_paid=cfg.get("force_paid", False),
            paid_fallback=cfg.get("paid_fallback", True),
        )

        expected_model = self.active_model if stage == "extract" else None
        last_error = None

        for api_key in key_sequence:
            client = self._client_for(api_key)

            for model in models:
                for attempt in range(MAX_RETRIES):
                    try:
                        Logger.info(f"[{stage}] Trying {model} (attempt {attempt + 1})")

                        response = self._generate(client, model, prompt, schema, file_path, images)

                        if stage == "extract":
                            self.active_model = model
                        self.model_call_log[stage] = model
                        Logger.success(f"[{stage}] Used model: {model}")

                        if (
                            stage == "extract"
                            and expected_model
                            and model != expected_model
                            and self.on_fallback
                        ):
                            try:
                                self.on_fallback(expected_model, model, "unavailable or over quota")
                            except Exception:
                                pass

                        return response

                    except (ServerError, ClientError) as e:
                        last_error = e
                        if _is_rate_limit_error(e):
                            self.key_manager.mark_exhausted(api_key)
                            break  # stop retrying this model on this key, rotate key instead
                        Logger.warning(f"[{stage}] {model} failed: {e}")
                        continue

        raise RuntimeError(
            f"No Gemini model/key available for stage '{stage}'. Last error: {last_error}"
        )

    def _generate_cascade(
        self,
        cascade,
        prompt: str,
        schema: Optional[Type[BaseModel]],
        file_path: Optional[str],
        images: Optional[List[bytes]],
        stage: str,
        warn_on_fallback: bool,
    ):
        """
        Tries cascade steps in order. Each step pins a set of models to a
        set of keys (e.g. flash-model -> free-keys, escalating to
        pro-model -> paid-key only as a last step). A step is skipped if
        its key pool resolves to empty -- in particular, if a step's keys
        equal the free-key pool and all free keys are currently marked
        exhausted, that step is skipped so the cascade falls through to the
        next step.
        """
        last_error = None
        first_model = None
        for step in cascade:
            if step["models"]:
                first_model = step["models"][0]
                break

        for step in cascade:
            step_keys = [k for k in step["keys"] if k]
            if not step_keys:
                continue  # e.g. paid key not configured

            is_free_pool = step_keys == self.key_manager.free_keys
            if is_free_pool:
                key_seq = self.key_manager.available_free_keys()
                if not key_seq:
                    continue  # all free keys exhausted -> fall through to next step
            else:
                key_seq = step_keys

            for model in step["models"]:
                for api_key in key_seq:
                    client = self._client_for(api_key)
                    for attempt in range(MAX_RETRIES):
                        try:
                            Logger.info(f"[{stage}] Trying {model} (attempt {attempt + 1})")
                            response = self._generate(client, model, prompt, schema, file_path, images)
                            self.model_call_log[stage] = model
                            Logger.success(f"[{stage}] Used model: {model}")

                            if warn_on_fallback and first_model and model != first_model:
                                Logger.warning(
                                    f"[{stage}] Fell back from {first_model} to {model} -- "
                                    "may be lower quality."
                                )

                            return response

                        except (ServerError, ClientError) as e:
                            last_error = e
                            if _is_rate_limit_error(e):
                                if is_free_pool:
                                    self.key_manager.mark_exhausted(api_key)
                                break  # stop retrying this model on this key
                            Logger.warning(f"[{stage}] {model} failed: {e}")
                            continue

        raise RuntimeError(
            f"No Gemini model/key available for stage '{stage}'. Last error: {last_error}"
        )

    def _generate(
        self,
        client: genai.Client,
        model: str,
        prompt: str,
        schema: Optional[Type[BaseModel]],
        file_path: Optional[str],
        images: Optional[List[bytes]] = None,
    ):
        contents = [prompt]

        if file_path:
            uploaded = client.files.upload(file=file_path)
            contents = [uploaded] + contents

        if images:
            image_parts = [
                types.Part.from_bytes(data=img, mime_type="image/png") for img in images
            ]
            contents = image_parts + contents

        if schema:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            return response.parsed

        response = client.models.generate_content(
            model=model,
            contents=contents,
        )
        return response.text
