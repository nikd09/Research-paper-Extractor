import time
from typing import List, Optional, Type

import httpx
from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError
from pydantic import BaseModel

from src.providers.base_provider import BaseProvider
from src.providers.key_manager import KeyManager
from src.utils.config import (
    FREE_API_KEYS,
    STAGE_CONFIG,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF_BASE_SECONDS,
)
from src.utils.logger import Logger


def _is_rate_limit_error(e: Exception) -> bool:
    msg = str(e).upper()
    return "429" in msg or "RESOURCE_EXHAUSTED" in msg or "RATE_LIMIT" in msg


class GeminiClient(BaseProvider):
    """
    Stage-aware Gemini client. Each call specifies which pipeline stage it
    belongs to ("extract" / "verify" / "verify_escalate" / "rag" /
    "crosscheck"); STAGE_CONFIG resolves that to a model list (or model
    cascade). Every stage draws from the same unified free-tier key
    cascade (KeyManager) -- there is no separate paid-tier pool.

    Two config shapes are supported per stage:
      - flat:    {"models": [...], "thinking_level"/"thinking_budget": optional}
      - cascade: {"cascade": [{"models": [...]}, ...],
                  "warn_on_model_fallback": bool}
        Cascade steps are tried in order, each against the full key
        cascade; a step only gets skipped if every key is exhausted.

    model_override / on_fallback are kept for GUI compatibility and only
    affect the "extract" stage's model cascade.
    """

    def __init__(self, model_override: Optional[str] = None, on_fallback=None, timeout_seconds: Optional[int] = None):
        self.key_manager = KeyManager(FREE_API_KEYS)
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
        # {"extract": "gemini-3.6-flash", "verify": "gemini-3.6-flash",
        #  "crosscheck": "gemini-3.5-flash-lite", "escalation": "gemini-3.7-flash"}
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

        thinking_level = cfg.get("thinking_level")
        thinking_budget = cfg.get("thinking_budget")

        key_sequence = self.key_manager.sequence()

        expected_model = self.active_model if stage == "extract" else None
        last_error = None

        for api_key in key_sequence:
            client = self._client_for(api_key)

            for model in models:
                for attempt in range(MAX_RETRIES):
                    try:
                        Logger.info(f"[{stage}] Trying {model} (attempt {attempt + 1})")

                        response = self._generate(
                            client, model, prompt, schema, file_path, images,
                            thinking_level=thinking_level,
                            thinking_budget=thinking_budget,
                        )

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

                    except (ServerError, ClientError, httpx.HTTPError) as e:
                        # httpx.HTTPError (ReadTimeout, ConnectTimeout,
                        # ConnectError, etc.) is a raw transport-layer
                        # failure, not a google.genai.errors.ServerError/
                        # ClientError -- confirmed bug: without catching it
                        # here too, a network timeout on attempt 1 escaped
                        # this whole retry/model-cascade/key-rotation loop
                        # entirely and crashed the pipeline run, even though
                        # MAX_RETRIES and the next model/key were right
                        # there unused. Treat it like any other transient
                        # failure: retry, then fall through to the next
                        # model/key.
                        last_error = e
                        if isinstance(e, (ServerError, ClientError)) and _is_rate_limit_error(e):
                            self.key_manager.mark_exhausted(api_key)
                            break  # stop retrying this model on this key, rotate key instead
                        Logger.warning(f"[{stage}] {model} failed: {e}")
                        if attempt < MAX_RETRIES - 1:
                            delay = RETRY_BACKOFF_BASE_SECONDS * (2 ** attempt)
                            Logger.info(f"[{stage}] Backing off {delay}s before retrying {model}...")
                            time.sleep(delay)
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
        Tries cascade steps (model lists) in order. Every step draws from
        the same unified free-tier key cascade (KeyManager.sequence()) --
        there is no separate key pool per step any more. The key cascade
        is re-resolved at the START of each step (not once for the whole
        cascade) so a key exhausted partway through an earlier step is
        correctly excluded from later steps too. If every key is
        exhausted, nothing later in the cascade can succeed either, so the
        whole cascade stops rather than looping through remaining steps.
        """
        last_error = None
        first_model = None
        for step in cascade:
            if step["models"]:
                first_model = step["models"][0]
                break

        for step in cascade:
            try:
                key_seq = self.key_manager.sequence()
            except RuntimeError as e:
                last_error = e
                break

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

                        except (ServerError, ClientError, httpx.HTTPError) as e:
                            # See matching comment in generate() above --
                            # httpx.HTTPError (timeouts, connection resets)
                            # must be caught here too or it escapes the
                            # cascade entirely instead of falling through
                            # to the next model/step.
                            last_error = e
                            if isinstance(e, (ServerError, ClientError)) and _is_rate_limit_error(e):
                                self.key_manager.mark_exhausted(api_key)
                                break  # stop retrying this model on this key
                            Logger.warning(f"[{stage}] {model} failed: {e}")
                            if attempt < MAX_RETRIES - 1:
                                delay = RETRY_BACKOFF_BASE_SECONDS * (2 ** attempt)
                                Logger.info(f"[{stage}] Backing off {delay}s before retrying {model}...")
                                time.sleep(delay)
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
        thinking_level: Optional[str] = None,
        thinking_budget: Optional[int] = None,
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

        # Both None for every stage except whichever ones set them in
        # STAGE_CONFIG (verify_escalate, synthesis "pro") -- those are the
        # only calls asking for deeper chain-of-thought reasoning instead
        # of a stronger model tier. thinking_budget is an explicit token
        # count; thinking_level is a coarser named tier -- a caller sets
        # at most one, but if both were somehow set, ThinkingConfig
        # accepts both kwargs and lets the API resolve precedence.
        thinking_kwargs = {}
        if thinking_level:
            thinking_kwargs["thinking_level"] = thinking_level
        if thinking_budget:
            thinking_kwargs["thinking_budget"] = thinking_budget
        thinking_config = types.ThinkingConfig(**thinking_kwargs) if thinking_kwargs else None

        if schema:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    thinking_config=thinking_config,
                ),
            )
            return response.parsed

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(thinking_config=thinking_config) if thinking_config else None,
        )
        return response.text
