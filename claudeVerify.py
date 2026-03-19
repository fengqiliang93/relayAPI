#!/usr/bin/env python3
"""
Claude 4.6 likelihood detector

This script is extracted from the project's existing request format and stream
parsing logic, then adds a minimal scoring layer for:
1) Knowledge cutoff signal
2) Anthropic SSE event-shape consistency
3) Thinking block consistency
4) Usage field consistency
"""

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx


DEFAULT_CONFIG = {
    "max_tokens": 32000,
    "thinking_budget": 31999,
}

DEFAULT_DETECTION_MESSAGE = "你的知识库截止时间是什么时候? 请一定要诚实回答"
CORE_PROMPT_SYMBOL = '输出中文的这个符号”"'
CORE_PROMPT_TARIFF = "不允许上网查, 2025年3月4日特朗普把关税提到多少. 不知道就回答不知道."

UNKNOWN_PATTERNS = [
    r"不知道",
    r"不清楚",
    r"不确定",
    r"无法确定",
    r"无法回答",
    r"i\s*don'?t\s*know",
    r"not\s*sure",
    r"can't\s*tell",
]

REFUSAL_PATTERNS = [
    r"cannot\s+discuss",
    r"can'?t\s+discuss",
    r"cannot\s+provide",
    r"can'?t\s+provide",
    r"cannot\s+help",
    r"can'?t\s+help",
    r"cannot\s+comply",
    r"unable\s+to\s+comply",
    r"无法讨论",
    r"不能讨论",
    r"无法提供",
    r"拒绝回答",
    r"cannot\s+answer",
    r"can'?t\s+answer",
]


@dataclass
class StreamSignals:
    event_types: List[str] = field(default_factory=list)
    raw_sse_data_lines: List[str] = field(default_factory=list)
    content_block_types: List[str] = field(default_factory=list)
    delta_types: List[str] = field(default_factory=list)
    has_message_start: bool = False
    has_content_block_start: bool = False
    has_content_block_delta: bool = False
    has_message_delta: bool = False
    has_message_stop: bool = False
    has_text_delta: bool = False
    thinking_start_seen: bool = False
    thinking_delta_seen: bool = False
    message_start_model: Optional[str] = None
    input_tokens: Optional[int] = None
    message_delta_input_tokens_samples: List[int] = field(default_factory=list)
    output_tokens_samples: List[int] = field(default_factory=list)
    empty_signature_delta_count: int = 0
    signature_delta_count: int = 0
    signature_delta_total_length: int = 0
    usage_shape_valid: bool = True
    first_char_latency_seconds: Optional[float] = None
    request_duration_seconds: Optional[float] = None


@dataclass
class ScoreBreakdown:
    knowledge_score: int
    sse_score: int
    thinking_score: int
    usage_score: int
    penalty_score: int
    total_score: int
    level: str
    notes: List[str]


@dataclass
class CoreStepResult:
    prompt: str
    response_text: str
    pass_check: bool
    reason: str


class RequestErrorWithContext(RuntimeError):
    def __init__(
        self,
        message: str,
        request_input: Optional[Dict[str, object]] = None,
        response_status: Optional[int] = None,
        response_text: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.request_input = request_input
        self.response_status = response_status
        self.response_text = response_text


def get_headers(api_key: str) -> Dict[str, str]:
    """
    Extracted from src/konata_api/conversation_test.py:get_headers
    """
    return {
        "accept": "application/json",
        "anthropic-beta": "claude-code-20250219,interleaved-thinking-2025-05-14",
        "anthropic-dangerous-direct-browser-access": "true",
        "anthropic-version": "2023-06-01",
        "authorization": f"Bearer {api_key}",
        "content-type": "application/json",
        "user-agent": "claude-cli/2.0.76 (external, cli)",
        "x-app": "cli",
        "x-stainless-arch": "x64",
        "x-stainless-helper-method": "stream",
        "x-stainless-lang": "js",
        "x-stainless-os": "Windows",
        "x-stainless-package-version": "0.70.0",
        "x-stainless-retry-count": "0",
        "x-stainless-runtime": "node",
        "x-stainless-runtime-version": "v25.1.0",
        "x-stainless-timeout": "600",
        "accept-encoding": "identity",
    }


def _build_user_content(message: str) -> List[Dict[str, object]]:
    return [
        {"type": "text", "text": "null"},
        {"type": "text", "text": "null"},
        {
            "type": "text",
            "text": message,
            "cache_control": {"type": "ephemeral"},
        },
    ]


def build_body_from_messages(
    messages: List[Dict[str, object]],
    model_id: str,
    with_thinking: bool = True,
    with_system: bool = True,
) -> Dict[str, object]:
    """
    Extracted from src/konata_api/conversation_test.py:build_body
    """
    body: Dict[str, object] = {
        "model": model_id,
        "messages": messages,
        "metadata": {
            "user_id": (
                "user_82a10c807646e5141d2ffcbf5c6d439ee4cfd99d1903617b7b69e3a5c03b1dbf_"
                "account__session_74673a26-ea49-47f4-a8ed-27f9248f231f"
            )
        },
        "max_tokens": DEFAULT_CONFIG["max_tokens"],
        "stream": True,
    }

    if with_system:
        body["system"] = [
            {
                "type": "text",
                "text": "null",
                "cache_control": {"type": "ephemeral"},
            }
        ]

    if with_thinking:
        body["thinking"] = {
            "type": "enabled",
            "budget_tokens": DEFAULT_CONFIG["thinking_budget"],
        }

    return body


def build_body(
    message: str,
    model_id: str,
    with_thinking: bool = True,
    with_system: bool = True,
) -> Dict[str, object]:
    return build_body_from_messages(
        messages=[{"role": "user", "content": _build_user_content(message)}],
        model_id=model_id,
        with_thinking=with_thinking,
        with_system=with_system,
    )


def _int_or_none(value: object) -> Optional[int]:
    if isinstance(value, int):
        return value
    return None


def _mask_headers(headers: Dict[str, str]) -> Dict[str, str]:
    masked = dict(headers)
    for key in list(masked.keys()):
        low = key.lower()
        if low in ("authorization", "x-api-key"):
            val = masked[key]
            if isinstance(val, str) and len(val) > 10:
                masked[key] = val[:8] + "..." + val[-4:]
            else:
                masked[key] = "***"
    return masked


def fingerprint_report(request_input: Dict[str, object]) -> Dict[str, Any]:
    headers = request_input.get("headers", {})
    body = request_input.get("body", {})
    url = str(request_input.get("url", ""))
    if not isinstance(headers, dict):
        headers = {}
    if not isinstance(body, dict):
        body = {}

    normalized_headers = {str(k).lower(): str(v) for k, v in headers.items()}

    def has_header(name: str, pattern: Optional[str] = None) -> bool:
        key = name.lower()
        if key not in normalized_headers:
            return False
        if pattern is None:
            return True
        return re.search(pattern, normalized_headers[key], re.IGNORECASE) is not None

    report = {
        "url_checks": {
            "has_v1_messages_suffix": url.endswith("/v1/messages"),
            "has_beta_query": "beta=true" in url.lower(),
        },
        "header_checks": {
            "user_agent_claude_cli": has_header("user-agent", r"claude-cli"),
            "x_app_cli": has_header("x-app", r"^cli$"),
            "anthropic_version": has_header("anthropic-version", r"2023-06-01"),
            "anthropic_beta_claude_code": has_header("anthropic-beta", r"claude-code-"),
            "anthropic_dangerous_browser_access": has_header(
                "anthropic-dangerous-direct-browser-access", r"true"
            ),
            "x_stainless_helper_stream": has_header("x-stainless-helper-method", r"stream"),
            "x_stainless_runtime_node": has_header("x-stainless-runtime", r"node"),
            "authorization_bearer": has_header("authorization", r"^Bearer\s+"),
            "accept_encoding_identity": has_header("accept-encoding", r"identity"),
        },
        "body_checks": {
            "stream_true": body.get("stream") is True,
            "has_system_field": isinstance(body.get("system"), list),
            "has_thinking_enabled": (
                isinstance(body.get("thinking"), dict)
                and body.get("thinking", {}).get("type") == "enabled"
            ),
            "has_metadata_user_id": (
                isinstance(body.get("metadata"), dict)
                and isinstance(body.get("metadata", {}).get("user_id"), str)
            ),
            "messages_is_list": isinstance(body.get("messages"), list),
        },
    }
    return report


def normalize_messages_url(url: str) -> str:
    normalized = url.strip().rstrip("/")
    normalized = re.sub(r"/v1/messages?$", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"/v1$", "", normalized, flags=re.IGNORECASE)
    return normalized.rstrip("/") + "/v1/messages"


def send_request_and_collect(
    url: str,
    api_key: str,
    message: str,
    model_id: str,
    with_thinking: bool,
    with_system: bool,
    timeout: float,
    messages_override: Optional[List[Dict[str, object]]] = None,
    http2: bool = False,
) -> Tuple[str, StreamSignals, Dict[str, object]]:
    """
    Stream parser is based on existing Anthropic parser logic in:
    - src/konata_api/conversation_test.py:send_request_stream
    - src/konata_api/test_dialog.py:_parse_anthropic_stream
    """
    url = normalize_messages_url(url)

    headers = get_headers(api_key)
    if messages_override is None:
        body = build_body(message, model_id, with_thinking=with_thinking, with_system=with_system)
    else:
        body = build_body_from_messages(
            messages=messages_override,
            model_id=model_id,
            with_thinking=with_thinking,
            with_system=with_system,
        )
    signals = StreamSignals()
    full_response = ""
    request_start_time = time.perf_counter()
    first_char_latency_seconds: Optional[float] = None
    request_input: Dict[str, object] = {
        "url": url,
        "headers": _mask_headers(headers),
        "body": body,
    }

    try:
        client = httpx.Client(timeout=timeout, http2=http2)
    except Exception as exc:
        raise RequestErrorWithContext(
            f"httpx client init failed: {exc}",
            request_input=request_input,
        ) from exc

    with client:
        with client.stream(
            "POST",
            url,
            headers=headers,
            json=body,
            params={"beta": "true"},
        ) as response:
            if response.status_code != 200:
                raw = response.read().decode("utf-8", errors="ignore")
                raise RequestErrorWithContext(
                    f"HTTP {response.status_code}: {raw[:600]}",
                    request_input=request_input,
                    response_status=response.status_code,
                    response_text=raw,
                )

            buffer = ""
            for chunk in response.iter_bytes():
                buffer += chunk.decode("utf-8", errors="ignore")

                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if not line.startswith("data: "):
                        continue

                    data = line[6:]
                    signals.raw_sse_data_lines.append(data)
                    if data == "[DONE]":
                        break

                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    event_type = event.get("type", "")
                    if isinstance(event_type, str) and event_type:
                        signals.event_types.append(event_type)

                    if event_type == "message_start":
                        signals.has_message_start = True
                        model_name = event.get("message", {}).get("model")
                        if isinstance(model_name, str):
                            signals.message_start_model = model_name
                        usage = event.get("message", {}).get("usage", {})
                        input_tokens = _int_or_none(usage.get("input_tokens"))
                        if input_tokens is None and "input_tokens" in usage:
                            signals.usage_shape_valid = False
                        else:
                            signals.input_tokens = input_tokens

                    elif event_type == "content_block_start":
                        signals.has_content_block_start = True
                        block = event.get("content_block", {})
                        block_type = block.get("type", "")
                        if isinstance(block_type, str) and block_type:
                            signals.content_block_types.append(block_type)
                        if block.get("type") == "thinking":
                            signals.thinking_start_seen = True

                    elif event_type == "content_block_delta":
                        signals.has_content_block_delta = True
                        delta = event.get("delta", {})
                        delta_type = delta.get("type")
                        if isinstance(delta_type, str) and delta_type:
                            signals.delta_types.append(delta_type)

                        if delta_type == "text_delta":
                            text = delta.get("text", "")
                            if isinstance(text, str):
                                if text and first_char_latency_seconds is None:
                                    first_char_latency_seconds = time.perf_counter() - request_start_time
                                full_response += text
                                signals.has_text_delta = True
                            else:
                                signals.usage_shape_valid = False
                        elif delta_type == "thinking_delta":
                            thinking_text = delta.get("thinking", "")
                            if isinstance(thinking_text, str):
                                if thinking_text and first_char_latency_seconds is None:
                                    first_char_latency_seconds = time.perf_counter() - request_start_time
                                signals.thinking_delta_seen = True
                            else:
                                signals.usage_shape_valid = False
                        elif delta_type == "signature_delta":
                            signature = delta.get("signature")
                            if isinstance(signature, str):
                                signals.signature_delta_count += 1
                                signals.signature_delta_total_length += len(signature)
                                if not signature.strip():
                                    signals.empty_signature_delta_count += 1

                    elif event_type == "message_delta":
                        signals.has_message_delta = True
                        usage = event.get("usage", {})
                        delta_input_tokens = _int_or_none(usage.get("input_tokens"))
                        if delta_input_tokens is None and "input_tokens" in usage:
                            signals.usage_shape_valid = False
                        elif delta_input_tokens is not None:
                            signals.message_delta_input_tokens_samples.append(delta_input_tokens)
                        output_tokens = _int_or_none(usage.get("output_tokens"))
                        if output_tokens is None and "output_tokens" in usage:
                            signals.usage_shape_valid = False
                        elif output_tokens is not None:
                            signals.output_tokens_samples.append(output_tokens)

                    elif event_type == "message_stop":
                        signals.has_message_stop = True

    signals.first_char_latency_seconds = first_char_latency_seconds
    signals.request_duration_seconds = time.perf_counter() - request_start_time
    return full_response, signals, request_input


MAY_2025_PATTERNS = [
    r"2025\s*年?\s*5\s*月",
    r"2025[-/\.]\s*0?5",
    r"May\s*2025",
]

EARLY_2025_PATTERNS = [
    r"2025\s*年?\s*初",
    r"early\s*2025",
]

JAN_FEB_2025_PATTERNS = [
    r"2025\s*年?\s*1\s*月",
    r"January\s*2025",
    r"2025\s*年?\s*2\s*月",
    r"February\s*2025",
]

OLDER_CUTOFF_PATTERNS = [
    r"2024\s*年?\s*6\s*月",
    r"June\s*2024",
    r"2024\s*年?\s*10\s*月",
    r"October\s*2024",
    r"2024\s*年?\s*4\s*月",
    r"April\s*2024",
    r"2025\s*年?\s*4\s*月",
    r"April\s*2025",
]


def score_knowledge_cutoff(response_text: str, notes: List[str]) -> int:
    if any(re.search(p, response_text, re.IGNORECASE) for p in MAY_2025_PATTERNS):
        notes.append("Knowledge cutoff signal matches May 2025.")
        return 50

    if any(re.search(p, response_text, re.IGNORECASE) for p in EARLY_2025_PATTERNS):
        notes.append("Knowledge cutoff signal is around early 2025 (ambiguous for 4.6).")
        return 25

    if any(re.search(p, response_text, re.IGNORECASE) for p in JAN_FEB_2025_PATTERNS):
        notes.append("Knowledge cutoff signal looks like Jan/Feb 2025 (older than 4.6 target).")
        return 10

    if any(re.search(p, response_text, re.IGNORECASE) for p in OLDER_CUTOFF_PATTERNS):
        notes.append("Knowledge cutoff signal matches older model generations.")
        return 0

    notes.append("Knowledge cutoff signal is unclear.")
    return 0


def score_sse_shape(signals: StreamSignals, notes: List[str]) -> int:
    score = 0
    if signals.has_message_start:
        score += 4
    if signals.has_content_block_start:
        score += 4
    if signals.has_content_block_delta:
        score += 4
    if signals.has_message_delta:
        score += 4
    if signals.has_message_stop:
        score += 2
    if signals.has_text_delta:
        score += 2

    known_event_types = {
        "ping",
        "message_start",
        "content_block_start",
        "content_block_delta",
        "content_block_stop",
        "message_delta",
        "message_stop",
    }
    unknown_types = sorted({t for t in signals.event_types if t not in known_event_types})
    if unknown_types:
        penalty = min(6, 2 * len(unknown_types))
        score = max(score - penalty, 0)
        notes.append(f"SSE has unknown event types: {', '.join(unknown_types)}.")

    if score >= 16:
        notes.append("SSE event-shape is broadly Anthropic-like.")
    elif score >= 9:
        notes.append("SSE event-shape is partially Anthropic-like.")
    else:
        notes.append("SSE event-shape is weak for Anthropic format.")
    return score


def score_thinking_consistency(
    signals: StreamSignals,
    with_thinking: bool,
    notes: List[str],
) -> int:
    if not with_thinking:
        notes.append("Thinking not requested; thinking consistency score skipped.")
        return 0

    score = 0
    has_thinking_block = "thinking" in signals.content_block_types
    has_text_block = "text" in signals.content_block_types
    if has_thinking_block:
        score += 4
    if signals.thinking_delta_seen:
        score += 5
    if has_text_block and signals.has_text_delta:
        score += 4

    if signals.empty_signature_delta_count > 0:
        score = max(score - 4, 0)
        notes.append("Thinking signature_delta is empty, signal quality reduced.")

    if score >= 11:
        notes.append("Thinking block signals are consistent.")
    elif score >= 6:
        notes.append("Thinking block signals are partial.")
    else:
        notes.append("Thinking block signals are weak.")
    return min(score, 15)


def score_usage_consistency(signals: StreamSignals, notes: List[str]) -> int:
    score = 0

    start_input = signals.input_tokens
    delta_inputs = signals.message_delta_input_tokens_samples
    output_any = len(signals.output_tokens_samples) > 0
    output_non_negative = all(v >= 0 for v in signals.output_tokens_samples)
    output_monotonic = (
        signals.output_tokens_samples == sorted(signals.output_tokens_samples)
        if output_any
        else False
    )

    if signals.usage_shape_valid:
        score += 3
    if isinstance(start_input, int) and start_input > 0:
        score += 4
    if output_any and output_non_negative:
        score += 4
    if output_any and output_monotonic:
        score += 2

    input_consistent = True
    if isinstance(start_input, int) and delta_inputs:
        if any(v != start_input for v in delta_inputs):
            input_consistent = False
            score = max(score - 4, 0)
            notes.append("Usage input_tokens mismatch between message_start and message_delta.")
        else:
            score += 2

    if isinstance(start_input, int) and start_input == 0 and delta_inputs and any(v > 0 for v in delta_inputs):
        input_consistent = False
        score = max(score - 2, 0)
        notes.append("Usage input_tokens starts at 0 but later becomes >0.")

    if score >= 11 and input_consistent:
        notes.append("Usage fields are mostly consistent.")
    elif score >= 6:
        notes.append("Usage fields are partially consistent.")
    else:
        notes.append("Usage fields are weak or inconsistent.")
    return min(score, 15)


IDENTITY_NEGATIVE_PATTERNS = [
    (r"glm", "GLM"),
    (r"z\.?ai", "Z.ai"),
    (r"deepseek", "DeepSeek"),
    (r"minimax", "MiniMax"),
    (r"grok", "Grok"),
    (r"qwen", "Qwen"),
    (r"gpt", "GPT"),
    (r"我是.*(glm|deepseek|minimax|qwen|gpt)", "self-declared non-Claude"),
]


def score_penalties(
    response_text: str,
    stream_model: Optional[str],
    notes: List[str],
) -> int:
    penalty = 0

    if stream_model and "claude" not in stream_model.lower():
        penalty -= 10
        notes.append(f"Stream reports non-Claude model: {stream_model}.")

    for pattern, name in IDENTITY_NEGATIVE_PATTERNS:
        if re.search(pattern, response_text, re.IGNORECASE):
            penalty -= 25
            notes.append(f"Response text self-identifies as non-Claude ({name}).")
            break

    has_identity_signal = bool(
        re.search(r"(我是|i am|model|模型|claude|sonnet|opus|haiku|anthropic)", response_text, re.IGNORECASE)
    )
    has_cutoff_signal = bool(
        re.search(r"(知识库|cutoff|截止|20\d{2}\s*年?\s*\d{0,2}\s*月|early\s*20\d{2}|may\s*20\d{2})", response_text, re.IGNORECASE)
    )

    if not has_identity_signal:
        penalty -= 8
        notes.append("Response does not clearly answer the identity part of the prompt.")
    if not has_cutoff_signal:
        penalty -= 8
        notes.append("Response does not clearly answer the knowledge-cutoff part of the prompt.")

    return penalty


def clamp_score(score: int) -> int:
    if score < 0:
        return 0
    if score > 100:
        return 100
    return score


def summarize_level(total: int) -> str:
    if total >= 80:
        return "HIGH"
    if total >= 60:
        return "MEDIUM"
    if total >= 35:
        return "LOW"
    return "VERY_LOW"


def evaluate_signals(
    response_text: str,
    signals: StreamSignals,
    with_thinking: bool,
) -> ScoreBreakdown:
    notes: List[str] = []
    knowledge_score = score_knowledge_cutoff(response_text, notes)
    sse_score = score_sse_shape(signals, notes)
    thinking_score = score_thinking_consistency(signals, with_thinking, notes)
    usage_score = score_usage_consistency(signals, notes)
    penalty_score = score_penalties(
        response_text=response_text,
        stream_model=signals.message_start_model,
        notes=notes,
    )

    total_score = clamp_score(knowledge_score + sse_score + thinking_score + usage_score + penalty_score)
    level = summarize_level(total_score)

    return ScoreBreakdown(
        knowledge_score=knowledge_score,
        sse_score=sse_score,
        thinking_score=thinking_score,
        usage_score=usage_score,
        penalty_score=penalty_score,
        total_score=total_score,
        level=level,
        notes=notes,
    )


def is_unknown_or_refusal(text: str) -> bool:
    normalized = text.strip()
    if not normalized:
        return True
    if len(re.sub(r"\s+", "", normalized)) < 8:
        return True
    if any(re.search(p, normalized, re.IGNORECASE) for p in UNKNOWN_PATTERNS):
        return True
    if any(re.search(p, normalized, re.IGNORECASE) for p in REFUSAL_PATTERNS):
        return True
    return False


def is_tariff_answer_valid(text: str) -> bool:
    if is_unknown_or_refusal(text):
        return False
    return bool(re.search(r"\d+(?:\.\d+)?\s*[%％]?", text))


def run_core_two_step(
    url: str,
    api_key: str,
    model_id: str,
    timeout: float,
    with_thinking: bool,
    with_system: bool,
    http2: bool = False,
) -> Tuple[CoreStepResult, Optional[CoreStepResult], Dict[str, object]]:
    step1_response_text, step1_signals, step1_input = send_request_and_collect(
        url=url,
        api_key=api_key,
        message=CORE_PROMPT_SYMBOL,
        model_id=model_id,
        with_thinking=with_thinking,
        with_system=with_system,
        timeout=timeout,
        http2=http2,
    )
    step1_pass = "”" not in step1_response_text
    step1_reason = "PASS" if step1_pass else "Contains Chinese quote mark: ”"
    step1 = CoreStepResult(
        prompt=CORE_PROMPT_SYMBOL,
        response_text=step1_response_text,
        pass_check=step1_pass,
        reason=step1_reason,
    )

    payload: Dict[str, object] = {
        "step1": {
            "input": step1_input,
            "signals": {
                "event_types_seen": step1_signals.event_types,
                "content_block_types_seen": step1_signals.content_block_types,
                "delta_types_seen": step1_signals.delta_types,
                "signature_delta_count": step1_signals.signature_delta_count,
                "signature_delta_total_length": step1_signals.signature_delta_total_length,
            },
            "timings": {
                "first_char_latency_seconds": step1_signals.first_char_latency_seconds,
                "request_duration_seconds": step1_signals.request_duration_seconds,
            },
        }
    }

    if not step1_pass:
        return step1, None, payload

    step2_messages = [
        {"role": "user", "content": _build_user_content(CORE_PROMPT_SYMBOL)},
        {"role": "assistant", "content": [{"type": "text", "text": step1_response_text or "(empty)"}]},
        {"role": "user", "content": _build_user_content(CORE_PROMPT_TARIFF)},
    ]
    step2_response_text, step2_signals, step2_input = send_request_and_collect(
        url=url,
        api_key=api_key,
        message=CORE_PROMPT_TARIFF,
        model_id=model_id,
        with_thinking=with_thinking,
        with_system=with_system,
        timeout=timeout,
        messages_override=step2_messages,
        http2=http2,
    )
    step2_pass = is_tariff_answer_valid(step2_response_text)
    step2_reason = "PASS" if step2_pass else "Unknown/refusal/no number detected"
    step2 = CoreStepResult(
        prompt=CORE_PROMPT_TARIFF,
        response_text=step2_response_text,
        pass_check=step2_pass,
        reason=step2_reason,
    )
    payload["step2"] = {
        "input": step2_input,
        "signals": {
            "event_types_seen": step2_signals.event_types,
            "content_block_types_seen": step2_signals.content_block_types,
            "delta_types_seen": step2_signals.delta_types,
            "signature_delta_count": step2_signals.signature_delta_count,
            "signature_delta_total_length": step2_signals.signature_delta_total_length,
        },
        "timings": {
            "first_char_latency_seconds": step2_signals.first_char_latency_seconds,
            "request_duration_seconds": step2_signals.request_duration_seconds,
        },
    }
    return step1, step2, payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Estimate likelihood that an endpoint behaves like Claude Sonnet 4.6 / Opus 4.6."
    )
    parser.add_argument("--url", required=True, help="Base URL, e.g. https://api.example.com")
    parser.add_argument("--api-key", required=True, help="API key")
    parser.add_argument("--model", required=True, help="Model ID to request")
    parser.add_argument(
        "--message",
        default=DEFAULT_DETECTION_MESSAGE,
        help="Prompt for identity + knowledge-cutoff probe",
    )
    parser.add_argument("--timeout", type=float, default=120.0, help="Request timeout in seconds")
    parser.add_argument(
        "--no-thinking",
        action="store_true",
        help="Disable thinking in request",
    )
    parser.add_argument(
        "--no-system",
        action="store_true",
        help="Do not send system field",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print result in JSON format",
    )
    parser.add_argument(
        "--core-two-step",
        action="store_true",
        help="Run core two-step verification (symbol prompt + tariff prompt)",
    )
    parser.add_argument(
        "--http2",
        action="store_true",
        help="Use HTTP/2 when sending requests (useful for some gateways)",
    )
    parser.add_argument(
        "--debug-fingerprint",
        action="store_true",
        help="On errors, print masked request fingerprint checks",
    )
    return parser.parse_args()


def main() -> int:
    script_start_time = time.perf_counter()
    args = parse_args()
    with_thinking = not args.no_thinking
    with_system = not args.no_system

    if args.core_two_step:
        try:
            step1, step2, core_payload = run_core_two_step(
                url=args.url,
                api_key=args.api_key,
                model_id=args.model,
                timeout=args.timeout,
                with_thinking=with_thinking,
                with_system=with_system,
                http2=args.http2,
            )
        except RequestErrorWithContext as exc:
            print(f"[ERROR] {exc}")
            if args.debug_fingerprint and exc.request_input is not None:
                print("")
                print("=== Fingerprint Debug (masked request) ===")
                print(json.dumps(exc.request_input, ensure_ascii=False, indent=2))
                print("")
                print("=== Fingerprint Checks ===")
                print(json.dumps(fingerprint_report(exc.request_input), ensure_ascii=False, indent=2))
            if args.debug_fingerprint and exc.response_text is not None:
                print("")
                print("=== Upstream Error Body ===")
                print(exc.response_text[:2000])
            return 2
        except Exception as exc:
            print(f"[ERROR] {exc}")
            return 2

        core_result = {
            "target": "claude_core_two_step",
            "stage1": {
                "prompt": step1.prompt,
                "pass": step1.pass_check,
                "reason": step1.reason,
                "response_text": step1.response_text,
            },
            "stage2": (
                None
                if step2 is None
                else {
                    "prompt": step2.prompt,
                    "pass": step2.pass_check,
                    "reason": step2.reason,
                    "response_text": step2.response_text,
                }
            ),
            "verdict": (
                "PASS"
                if step1.pass_check and step2 is not None and step2.pass_check
                else "FAIL"
            ),
            "debug": core_payload,
            "timings": {
                "script_duration_seconds": time.perf_counter() - script_start_time,
            },
        }

        if args.json:
            print(json.dumps(core_result, ensure_ascii=False, indent=2))
            return 0

        print("=== Claude Core Two-Step Verification ===")
        print(f"Stage1 (symbol prompt): {'PASS' if step1.pass_check else 'FAIL'}")
        print(f"- reason: {step1.reason}")
        print(f"- response: {step1.response_text}")
        if step2 is None:
            print("Stage2 (tariff prompt): SKIPPED")
        else:
            print(f"Stage2 (tariff prompt): {'PASS' if step2.pass_check else 'FAIL'}")
            print(f"- reason: {step2.reason}")
            print(f"- response: {step2.response_text}")
        print(f"Verdict: {core_result['verdict']}")
        return 0

    try:
        response_text, signals, request_input = send_request_and_collect(
            url=args.url,
            api_key=args.api_key,
            message=args.message,
            model_id=args.model,
            with_thinking=with_thinking,
            with_system=with_system,
            timeout=args.timeout,
            http2=args.http2,
        )
    except RequestErrorWithContext as exc:
        print(f"[ERROR] {exc}")
        if args.debug_fingerprint and exc.request_input is not None:
            print("")
            print("=== Fingerprint Debug (masked request) ===")
            print(json.dumps(exc.request_input, ensure_ascii=False, indent=2))
            print("")
            print("=== Fingerprint Checks ===")
            print(json.dumps(fingerprint_report(exc.request_input), ensure_ascii=False, indent=2))
        if args.debug_fingerprint and exc.response_text is not None:
            print("")
            print("=== Upstream Error Body ===")
            print(exc.response_text[:2000])
        return 2
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return 2

    result = evaluate_signals(
        response_text=response_text,
        signals=signals,
        with_thinking=with_thinking,
    )

    payload = {
        "target": "claude_sonnet_4_6_or_opus_4_6",
        "score": result.total_score,
        "level": result.level,
        "input": request_input,
        "breakdown": {
            "knowledge_score": result.knowledge_score,
            "sse_score": result.sse_score,
            "thinking_score": result.thinking_score,
            "usage_score": result.usage_score,
            "penalty_score": result.penalty_score,
        },
        "output": {
            "raw_sse_data_lines": signals.raw_sse_data_lines,
            "response_text": response_text,
        },
        "signals": {
            "event_types_seen": signals.event_types,
            "content_block_types_seen": signals.content_block_types,
            "delta_types_seen": signals.delta_types,
            "has_message_start": signals.has_message_start,
            "has_content_block_start": signals.has_content_block_start,
            "has_content_block_delta": signals.has_content_block_delta,
            "has_message_delta": signals.has_message_delta,
            "has_message_stop": signals.has_message_stop,
            "thinking_start_seen": signals.thinking_start_seen,
            "thinking_delta_seen": signals.thinking_delta_seen,
            "message_start_model": signals.message_start_model,
            "input_tokens": signals.input_tokens,
            "message_delta_input_tokens_samples": signals.message_delta_input_tokens_samples,
            "output_tokens_samples": signals.output_tokens_samples,
            "empty_signature_delta_count": signals.empty_signature_delta_count,
            "signature_delta_count": signals.signature_delta_count,
            "signature_delta_total_length": signals.signature_delta_total_length,
            "usage_shape_valid": signals.usage_shape_valid,
        },
        "notes": result.notes,
    }
    payload["timings"] = {
        "first_char_latency_seconds": signals.first_char_latency_seconds,
        "request_duration_seconds": signals.request_duration_seconds,
        "script_duration_seconds": time.perf_counter() - script_start_time,
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    print("=== Claude 4.6 Likelihood ===")
    print(f"Target: {payload['target']}")
    print(f"Score : {result.total_score}/100")
    print(f"Level : {result.level}")
    print("")
    print("Breakdown:")
    print(f"- knowledge : {result.knowledge_score}/50")
    print(f"- sse shape : {result.sse_score}/20")
    print(f"- thinking  : {result.thinking_score}/15")
    print(f"- usage     : {result.usage_score}/15")
    print(f"- penalty   : {result.penalty_score}")
    print("")
    first_char = payload["timings"]["first_char_latency_seconds"]
    request_duration = payload["timings"]["request_duration_seconds"]
    script_duration = payload["timings"]["script_duration_seconds"]
    first_char_str = "N/A" if first_char is None else f"{first_char:.3f}s"
    request_duration_str = "N/A" if request_duration is None else f"{request_duration:.3f}s"
    script_duration_str = f"{script_duration:.3f}s"
    print("Timings:")
    print(f"- first char latency : {first_char_str}")
    print(f"- request duration   : {request_duration_str}")
    print(f"- script duration    : {script_duration_str}")
    print("")

    print("Input request:")
    print(json.dumps(payload["input"], ensure_ascii=False, indent=2))
    print("")

    print("Interface output (raw SSE data lines):")
    for raw_line in signals.raw_sse_data_lines:
        print(raw_line)
    print("Notes:")
    for note in result.notes:
        print(f"- {note}")

    print("")
    print("Interface output (parsed text):")
    print(response_text)

    return 0


if __name__ == "__main__":
    sys.exit(main())
