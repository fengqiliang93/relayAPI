import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Info, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { ApiConfig } from "@/components/ApiConfig";
import { ModelSelector } from "@/components/ModelSelector";
import { ScoreGauge } from "@/components/ScoreGauge";
import { DetectionChecklist, type CheckItem } from "@/components/DetectionChecklist";
import { HistoryLog, type HistoryEntry } from "@/components/HistoryLog";
import { ScanningOverlay } from "@/components/ScanningOverlay";
import { useI18n } from "@/i18n";
import type { I18nMessages } from "@/i18n/types";
import { toast } from "sonner";

interface DetectionResult {
  id: string;
  score: number;
  checks: CheckItem[];
  latency: number;
  tps: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

type CheckStatus = "pass" | "warning" | "fail";
type EndpointMode = "anthropic" | "openai";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      action?: string;
      size?: "normal" | "compact" | "flexible";
    }
  ) => string | number;
  reset: (widgetId?: string | number) => void;
  remove?: (widgetId?: string | number) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface ProbeResult {
  prompt: string;
  responseText: string;
  payload: unknown;
  latencyMs: number;
  firstTokenLatencyMs: number | null;
  tps: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cacheHit: boolean;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  signatureDeltaTotalLength: number;
  signatureDeltaCount: number;
  contentTypes: string[];
  parseOk: boolean;
  mode: EndpointMode;
  protocolHints: {
    hasModel: boolean;
    hasRole: boolean;
    hasContentArray: boolean;
    hasUsage: boolean;
    hasStopReason: boolean;
  };
}

interface PublicErrorInfo {
  title: string;
  detail: string;
  source: "upstream" | "system";
  stage?: "stage1" | "stage2";
  statusCode?: number;
}

class UserVisibleError extends Error {
  info: PublicErrorInfo;

  constructor(info: PublicErrorInfo) {
    super(info.title);
    this.name = "UserVisibleError";
    this.info = info;
  }
}

const SYMBOL_PROMPT = '输出中文的这个符号”"';

const TARIFF_PROMPT =
  "不允许上网查, 2025年3月4日特朗普把关税提到多少. 不知道就回答不知道.";

const UNKNOWN_PATTERNS = [
  /不知道/i,
  /不清楚/i,
  /不确定/i,
  /无法确定/i,
  /无法回答/i,
  /i\s*don'?t\s*know/i,
  /not\s*sure/i,
  /can't\s*tell/i,
];

const REFUSAL_PATTERNS = [
  /cannot\s+discuss/i,
  /can'?t\s+discuss/i,
  /cannot\s+provide/i,
  /can'?t\s+provide/i,
  /cannot\s+help/i,
  /can'?t\s+help/i,
  /cannot\s+comply/i,
  /unable\s+to\s+comply/i,
  /无法讨论/i,
  /不能讨论/i,
  /无法提供/i,
  /拒绝回答/i,
  /cannot\s+answer/i,
  /can'?t\s+answer/i,
];
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const CLAUDE_CODE_USER_ID =
  "user_82a10c807646e5141d2ffcbf5c6d439ee4cfd99d1903617b7b69e3a5c03b1dbf_account__session_74673a26-ea49-47f4-a8ed-27f9248f231f";
const PROBE_MAX_TOKENS = 32000;
const PROBE_THINKING_BUDGET = 31999;
const OFFICIAL_CLAUDE_CODE_SYSTEM_PROMPT = "You are Claude Code, Anthropic's official CLI for Claude.";
const HISTORY_STORAGE_KEY = "api-verifier-history-v1";
const HISTORY_LIMIT = 10;
const SITE_URL = "https://www.hvoy.ai/";
const OG_IMAGE_URL = "https://www.hvoy.ai/og-image.svg";

function resolveEndpoint(rawUrl: string): { endpoint: string; mode: EndpointMode } {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { endpoint: "", mode: "anthropic" };

  const normalized = trimmed.replace(/\/+$/, "");
  const lowered = normalized.toLowerCase();

  const mode: EndpointMode =
    lowered.includes("/v1/chat/completions") ||
    lowered.endsWith("/chat/completions") ||
    lowered.includes("api.openai.com") ||
    lowered.includes("openrouter.ai")
      ? "openai"
      : "anthropic";

  const base = normalized
    .replace(/\/v1\/chat\/completions\/?$/i, "")
    .replace(/\/chat\/completions\/?$/i, "")
    .replace(/\/v1\/messages?\/?$/i, "")
    .replace(/\/v1\/?$/i, "")
    .replace(/\/+$/, "");

  if (!base) return { endpoint: "", mode };

  if (mode === "openai") {
    return { endpoint: `${base}/v1/chat/completions`, mode };
  }
  return { endpoint: `${base}/v1/messages`, mode };
}

function extractResponseText(payload: any, mode: EndpointMode): string {
  if (!payload || typeof payload !== "object") return "";

  if (mode === "openai") {
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      const parts = content
        .map((item: any) => (item && typeof item.text === "string" ? item.text : ""))
        .filter(Boolean);
      return parts.join("\n").trim();
    }
    return "";
  }

  const blocks = Array.isArray(payload.content) ? payload.content : [];
  const textParts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    if (typeof block.text === "string") {
      textParts.push(block.text);
    }
  }
  return textParts.join("\n").trim();
}

function statusToScore(status: CheckStatus, weight: number): number {
  if (status === "pass") return weight;
  if (status === "warning") return Math.round(weight * 0.5);
  return 0;
}

function safeTrace(trace: unknown): string {
  return JSON.stringify(trace, null, 2);
}

function compactErrorText(raw: string, max = 260): string {
  if (!raw) return "";
  const noTags = raw.replace(/<[^>]+>/g, " ");
  const normalized = noTags.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function extractUpstreamErrorDetail(rawText: string, fallbackMessage: string): string {
  if (!rawText) {
    return fallbackMessage;
  }

  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const topMessage = typeof parsed?.message === "string" ? parsed.message : "";
    const topDetail = typeof parsed?.detail === "string" ? parsed.detail : "";
    const topError = parsed?.error;
    const nestedError =
      topError && typeof topError === "object"
        ? (topError as Record<string, unknown>)
        : null;
    const nestedMessage = nestedError && typeof nestedError.message === "string" ? nestedError.message : "";
    const nestedDetail = nestedError && typeof nestedError.detail === "string" ? nestedError.detail : "";
    const nestedCode = nestedError && typeof nestedError.code === "string" ? nestedError.code : "";
    const candidates = [nestedMessage, nestedDetail, topMessage, topDetail, nestedCode];
    const first = candidates.find((x) => typeof x === "string" && x.trim());
    if (first) {
      return compactErrorText(first);
    }
  } catch {
    // fall through to plain text parsing
  }

  const plain = compactErrorText(rawText);
  return plain || fallbackMessage;
}

async function sendProbe(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  stage: "stage1" | "stage2";
  previousAssistantText?: string;
  messages: I18nMessages;
}): Promise<ProbeResult> {
  const { endpoint, mode } = resolveEndpoint(options.baseUrl);
  if (!endpoint) {
    throw new Error("API endpoint is empty");
  }

  const buildAnthropicUserContent = (text: string) => [{ type: "text" as const, text }];

  const anthropicMessages: Array<{
    role: "user" | "assistant";
    content: Array<{
      type: "text";
      text: string;
      cache_control?: { type: "ephemeral" };
    }>;
  }> = [];
  const openAIMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (options.previousAssistantText !== undefined) {
    anthropicMessages.push({ role: "user", content: buildAnthropicUserContent(SYMBOL_PROMPT) });
    anthropicMessages.push({ role: "assistant", content: [{ type: "text", text: options.previousAssistantText || "(empty)" }] });
    anthropicMessages.push({ role: "user", content: buildAnthropicUserContent(options.prompt) });

    openAIMessages.push({ role: "user", content: SYMBOL_PROMPT });
    openAIMessages.push({ role: "assistant", content: options.previousAssistantText || "(empty)" });
    openAIMessages.push({ role: "user", content: options.prompt });
  } else {
    anthropicMessages.push({ role: "user", content: buildAnthropicUserContent(options.prompt) });
    openAIMessages.push({ role: "user", content: options.prompt });
  }

  const headers =
    mode === "anthropic"
      ? {
          accept: "application/json",
          "accept-encoding": "identity",
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "oauth-2025-04-20,interleaved-thinking-2025-05-14",
          "anthropic-dangerous-direct-browser-access": "true",
          "user-agent": "claude-cli/2.1.76 (external, cli)",
          "x-app": "cli",
        }
      : {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
        };

  const body =
    mode === "anthropic"
      ? {
          model: options.model,
          messages: anthropicMessages,
          metadata: {
            user_id: CLAUDE_CODE_USER_ID,
          },
          system: [
            {
              type: "text",
              text: OFFICIAL_CLAUDE_CODE_SYSTEM_PROMPT,
            },
          ],
          max_tokens: PROBE_MAX_TOKENS,
          stream: true,
          tools: [],
          thinking: {
            type: "enabled",
            budget_tokens: PROBE_THINKING_BUDGET,
          },
        }
      : {
          model: options.model,
          messages: openAIMessages,
          max_tokens: PROBE_MAX_TOKENS,
          stream: false,
        };

  const relayResponse = await fetch("/__probe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      stage: options.stage,
      mode,
      endpoint,
      method: "POST",
      headers,
      body,
    }),
  });

  const relayPayload = await relayResponse.json().catch(() => ({}));
  const latencyMs = typeof relayPayload?.latencyMs === "number" ? relayPayload.latencyMs : 0;
  const firstTokenLatencyMs =
    typeof relayPayload?.firstChunkLatencyMs === "number" ? relayPayload.firstChunkLatencyMs : null;
  const rawText = typeof relayPayload?.bodyText === "string" ? relayPayload.bodyText : "";
  const relayUsage = relayPayload?.usage && typeof relayPayload.usage === "object" ? relayPayload.usage : {};
  const relayCacheHit = Boolean(relayPayload?.cacheHit);
  const relayCacheReadInputTokens =
    typeof relayPayload?.cacheReadInputTokens === "number" ? relayPayload.cacheReadInputTokens : 0;
  const relayCacheCreationInputTokens =
    typeof relayPayload?.cacheCreationInputTokens === "number" ? relayPayload.cacheCreationInputTokens : 0;
  const signatureDeltaTotalLength =
    typeof relayPayload?.signatureDeltaTotalLength === "number" ? relayPayload.signatureDeltaTotalLength : 0;
  const signatureDeltaCount =
    typeof relayPayload?.signatureDeltaCount === "number" ? relayPayload.signatureDeltaCount : 0;
  const sseContentTypes = Array.isArray(relayPayload?.sseContentTypes)
    ? relayPayload.sseContentTypes.filter((x: unknown): x is string => typeof x === "string")
    : [];

  if (!relayResponse.ok || relayPayload?.ok !== true) {
    throw new UserVisibleError({
      title: options.messages.probeRequestFailedTitle,
      detail: options.messages.probeRequestFailedDetail,
      source: "system",
      stage: options.stage,
    });
  }

  const upstreamStatus = typeof relayPayload?.status === "number" ? relayPayload.status : 0;
  if (upstreamStatus < 200 || upstreamStatus >= 300) {
    throw new UserVisibleError({
      title: `${options.messages.probeRequestFailedTitle} (HTTP ${upstreamStatus})`,
      detail: extractUpstreamErrorDetail(rawText, options.messages.upstreamNoErrorDetail),
      source: "upstream",
      stage: options.stage,
      statusCode: upstreamStatus,
    });
  }

  let payload: any = null;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new UserVisibleError({
      title: options.messages.probeInvalidResponseTitle,
      detail: extractUpstreamErrorDetail(rawText, options.messages.upstreamNoErrorDetail),
      source: "upstream",
      stage: options.stage,
      statusCode: upstreamStatus,
    });
  }

  const responseText = extractResponseText(payload, mode);
  const usage = payload && typeof payload === "object" ? payload.usage : null;
  const inputTokens =
    usage && typeof usage.input_tokens === "number"
      ? usage.input_tokens
      : usage && typeof usage.prompt_tokens === "number"
        ? usage.prompt_tokens
        : typeof relayUsage.input_tokens === "number"
          ? relayUsage.input_tokens
          : typeof relayUsage.prompt_tokens === "number"
            ? relayUsage.prompt_tokens
            : null;
  const outputTokens =
    usage && typeof usage.output_tokens === "number"
      ? usage.output_tokens
      : usage && typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : typeof relayUsage.output_tokens === "number"
          ? relayUsage.output_tokens
          : typeof relayUsage.completion_tokens === "number"
            ? relayUsage.completion_tokens
            : null;
  const totalTokens =
    usage && typeof usage.total_tokens === "number"
      ? usage.total_tokens
      : inputTokens !== null && outputTokens !== null
        ? inputTokens + outputTokens
        : null;
  const tps = outputTokens && latencyMs > 0 ? Number((outputTokens / (latencyMs / 1000)).toFixed(1)) : 0;

  const contentTypes: string[] = [];
  if (mode === "anthropic") {
    const content = Array.isArray(payload?.content) ? payload.content : [];
    for (const item of content) {
      if (item && typeof item.type === "string") {
        contentTypes.push(item.type);
      }
    }
    for (const t of sseContentTypes) {
      if (!contentTypes.includes(t)) {
        contentTypes.push(t);
      }
    }
  } else {
    contentTypes.push("text");
    const toolCalls = payload?.choices?.[0]?.message?.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      contentTypes.push("tool_use");
    }
  }

  return {
    prompt: options.prompt,
    responseText,
    payload,
    latencyMs,
    firstTokenLatencyMs,
    tps,
    inputTokens,
    outputTokens,
    totalTokens,
    cacheHit: relayCacheHit,
    cacheReadInputTokens: relayCacheReadInputTokens,
    cacheCreationInputTokens: relayCacheCreationInputTokens,
    signatureDeltaTotalLength,
    signatureDeltaCount,
    contentTypes,
    parseOk: true,
    mode,
    protocolHints: {
      hasModel: typeof payload?.model === "string",
      hasRole:
        mode === "anthropic"
          ? typeof payload?.role === "string"
          : typeof payload?.choices?.[0]?.message?.role === "string",
      hasContentArray: mode === "anthropic" ? Array.isArray(payload?.content) : Array.isArray(payload?.choices),
      hasUsage: !!(payload?.usage && typeof payload.usage === "object"),
      hasStopReason:
        mode === "anthropic"
          ? typeof payload?.stop_reason === "string" || payload?.stop_reason === null
          : typeof payload?.choices?.[0]?.finish_reason === "string" || payload?.choices?.[0]?.finish_reason === null,
    },
  };
}

function buildChecks(options: {
  stage1: ProbeResult;
  stage2: ProbeResult | null;
  stage1Pass: boolean;
  stage2Pass: boolean;
  messages: I18nMessages;
}): { checks: CheckItem[]; score: number } {
  const { stage1, stage2, stage1Pass, stage2Pass, messages } = options;

  const protocolScoreRaw = [
    stage1.protocolHints.hasModel,
    stage1.protocolHints.hasRole,
    stage1.protocolHints.hasContentArray,
    stage1.protocolHints.hasUsage,
    stage1.protocolHints.hasStopReason,
    stage2?.protocolHints.hasModel ?? false,
    stage2?.protocolHints.hasRole ?? false,
    stage2?.protocolHints.hasContentArray ?? false,
    stage2?.protocolHints.hasUsage ?? false,
    stage2?.protocolHints.hasStopReason ?? false,
  ].filter(Boolean).length;

  const protocolStatus: CheckStatus = protocolScoreRaw >= 8 ? "pass" : protocolScoreRaw >= 5 ? "warning" : "fail";

  const responseStructureStatus: CheckStatus = stage2
    ? (stage1.parseOk && stage2.parseOk ? "pass" : "fail")
    : (stage1.parseOk ? "warning" : "fail");

  const knowledgeCutoffStatus: CheckStatus = !stage1Pass ? "fail" : stage2Pass ? "pass" : "fail";

  const identityStatus: CheckStatus = stage1Pass ? "pass" : "fail";

  const thinkingDetected =
    stage1.contentTypes.includes("thinking") ||
    stage2?.contentTypes.includes("thinking") ||
    /thinking/i.test(stage1.responseText) ||
    (stage2 ? /thinking/i.test(stage2.responseText) : false);
  const thinkingStatus: CheckStatus = thinkingDetected ? "pass" : "warning";

  const signatureLength = stage1.signatureDeltaTotalLength + (stage2?.signatureDeltaTotalLength ?? 0);
  const signatureStatus: CheckStatus = signatureLength >= 100 ? "pass" : signatureLength > 0 ? "warning" : "fail";
  const outputTokenSum = (stage1.outputTokens ?? 0) + (stage2?.outputTokens ?? 0);
  let outputTokenPenalty = 0;
  if (outputTokenSum > 800) {
    outputTokenPenalty = 15;
  } else if (outputTokenSum > 500) {
    outputTokenPenalty = 8;
  }

  const checks: CheckItem[] = [
    {
      name: messages.checkProtocolName,
      status: protocolStatus,
      detail:
        protocolStatus === "pass"
          ? messages.checkProtocolStable
          : protocolStatus === "warning"
            ? messages.checkProtocolPartial
            : messages.checkProtocolWeak,
    },
    {
      name: messages.checkResponseStructureName,
      status: responseStructureStatus,
      detail:
        responseStructureStatus === "pass"
          ? messages.checkResponseJsonValid
          : responseStructureStatus === "warning"
            ? messages.checkResponseSinglePrompt
            : messages.checkResponseInvalid,
      trace: safeTrace({
        stage1_json_parse_ok: stage1.parseOk,
        stage2_json_parse_ok: stage2?.parseOk ?? false,
      }),
    },
    {
      name: messages.checkKnowledgeCutoffName,
      status: knowledgeCutoffStatus,
      detail: knowledgeCutoffStatus === "pass" ? messages.checkPass : messages.checkFail,
    },
    {
      name: messages.checkIdentityName,
      status: identityStatus,
      detail: identityStatus === "pass" ? messages.checkIdentityConsistent : messages.checkIdentityMismatch,
    },
    {
      name: messages.checkThinkingChainName,
      status: thinkingStatus,
      detail: thinkingStatus === "pass" ? messages.checkThinkingPresent : messages.checkThinkingNotFound,
      trace: safeTrace({
        stage1_content_types: stage1.contentTypes,
        stage2_content_types: stage2?.contentTypes ?? [],
      }),
    },
    {
      name: messages.checkSignatureName,
      status: signatureStatus,
      detail:
        signatureStatus === "pass"
          ? messages.checkSignatureLengthOk
          : signatureStatus === "warning"
            ? messages.checkSignatureShort
            : messages.checkSignatureMissing,
      trace: safeTrace({
        signature_length: signatureLength,
        signature_delta_count: stage1.signatureDeltaCount + (stage2?.signatureDeltaCount ?? 0),
        stage1_signature_length: stage1.signatureDeltaTotalLength,
        stage2_signature_length: stage2?.signatureDeltaTotalLength ?? 0,
        threshold: 100,
      }),
    },
  ];

  const weighted =
    statusToScore(identityStatus, 40) +
    statusToScore(knowledgeCutoffStatus, 30) +
    statusToScore(protocolStatus, 10) +
    statusToScore(responseStructureStatus, 8) +
    statusToScore(thinkingStatus, 6) +
    statusToScore(signatureStatus, 6);

  let score = weighted - outputTokenPenalty;
  if (!stage1Pass) {
    score = Math.min(score, 35);
  } else if (!stage2Pass) {
    score = Math.min(score, 68);
  }

  return { checks, score: Math.max(0, Math.min(100, score)) };
}

function formatHistoryTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function isCheckStatus(value: unknown): value is CheckItem["status"] {
  return value === "pass" || value === "fail" || value === "warning";
}

function sanitizeHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== "object") return null;

  const entry = value as Record<string, unknown>;
  const checks = Array.isArray(entry.checks)
    ? entry.checks
        .map((item): CheckItem | null => {
          if (!item || typeof item !== "object") return null;
          const check = item as Record<string, unknown>;
          if (
            typeof check.name !== "string" ||
            !isCheckStatus(check.status) ||
            typeof check.detail !== "string"
          ) {
            return null;
          }

          return {
            name: check.name,
            status: check.status,
            detail: check.detail,
          };
        })
        .filter((item): item is CheckItem => item !== null)
    : undefined;

  if (
    typeof entry.id !== "string" ||
    typeof entry.timestamp !== "string" ||
    typeof entry.model !== "string" ||
    typeof entry.endpoint !== "string" ||
    typeof entry.score !== "number" ||
    (entry.status !== "pass" && entry.status !== "fail")
  ) {
    return null;
  }

  return {
    id: entry.id,
    timestamp: entry.timestamp,
    model: entry.model,
    endpoint: entry.endpoint,
    apiKey: "",
    score: entry.score,
    status: entry.status,
    checks,
    latency: typeof entry.latency === "number" ? entry.latency : undefined,
    tps: typeof entry.tps === "number" ? entry.tps : undefined,
    inputTokens: typeof entry.inputTokens === "number" ? entry.inputTokens : undefined,
    outputTokens: typeof entry.outputTokens === "number" ? entry.outputTokens : undefined,
  };
}

function loadHistoryFromStorage(): HistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => sanitizeHistoryEntry(entry))
      .filter((entry): entry is HistoryEntry => entry !== null)
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveHistoryToStorage(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;

  const sanitized = entries
    .map((entry) => sanitizeHistoryEntry(entry))
    .filter((entry): entry is HistoryEntry => entry !== null)
    .slice(0, HISTORY_LIMIT);

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sanitized));
}

function clearHistoryStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HISTORY_STORAGE_KEY);
}

function upsertMetaTag(selector: string, attributes: Record<string, string>) {
  if (typeof document === "undefined") return;

  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
}

function upsertLinkTag(selector: string, attributes: Record<string, string>) {
  if (typeof document === "undefined") return;

  let element = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
}

function isUnknownResponse(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return true;
  if (normalized.replace(/\s+/g, "").length < 8) return true;
  if (UNKNOWN_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  if (REFUSAL_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  return false;
}

function isTariffAnswerValid(text: string): boolean {
  const normalized = text.trim();
  if (isUnknownResponse(normalized)) return false;
  const hasAnyNumber = /\d+(?:\.\d+)?\s*[%％]?/.test(normalized);
  return hasAnyNumber;
}

const Index = () => {
  const { lang, setLang, messages, t } = useI18n();
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | null>("claude-sonnet-4-6");
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [showTurnstileModal, setShowTurnstileModal] = useState(false);
  const [turnstileVerified, setTurnstileVerified] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [publicError, setPublicError] = useState<PublicErrorInfo | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | number | null>(null);

  const resetTurnstile = useCallback(() => {
    setTurnstileVerified(false);
    setTurnstileToken(null);
    if (window.turnstile && turnstileWidgetIdRef.current !== null) {
      if (typeof window.turnstile.remove === "function") {
        window.turnstile.remove(turnstileWidgetIdRef.current);
      } else {
        window.turnstile.reset(turnstileWidgetIdRef.current);
      }
    }
    turnstileWidgetIdRef.current = null;
    if (turnstileContainerRef.current) {
      turnstileContainerRef.current.innerHTML = "";
    }
  }, []);

  useEffect(() => {
    setHistory(loadHistoryFromStorage());
    setHistoryReady(true);
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    saveHistoryToStorage(history);
  }, [history, historyReady]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.title = messages.seoTitle;
    upsertMetaTag('meta[name="description"]', { name: "description", content: messages.seoDescription });
    upsertMetaTag('meta[property="og:title"]', { property: "og:title", content: messages.seoOgTitle });
    upsertMetaTag('meta[property="og:description"]', { property: "og:description", content: messages.seoOgDescription });
    upsertMetaTag('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMetaTag('meta[property="og:url"]', { property: "og:url", content: SITE_URL });
    upsertMetaTag('meta[property="og:image"]', { property: "og:image", content: OG_IMAGE_URL });
    upsertMetaTag('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMetaTag('meta[name="twitter:title"]', { name: "twitter:title", content: messages.seoOgTitle });
    upsertMetaTag('meta[name="twitter:description"]', { name: "twitter:description", content: messages.seoOgDescription });
    upsertMetaTag('meta[name="twitter:image"]', { name: "twitter:image", content: OG_IMAGE_URL });
    upsertLinkTag('link[rel="canonical"]', { rel: "canonical", href: SITE_URL });
  }, [messages]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (!showTurnstileModal) return;

    const mountWidget = () => {
      if (!window.turnstile || !turnstileContainerRef.current) return;
      if (turnstileWidgetIdRef.current !== null) return;

      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action: "start_detection",
        theme: "auto",
        size: isMobile ? "flexible" : "normal",
        callback: (token: string) => {
          setTurnstileToken(token);
          setTurnstileVerified(true);
        },
        "expired-callback": () => {
          setTurnstileToken(null);
          setTurnstileVerified(false);
        },
        "error-callback": () => {
          setTurnstileToken(null);
          setTurnstileVerified(false);
        },
      });
    };

    mountWidget();
    const timer = window.setInterval(mountWidget, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [showTurnstileModal]);

  const validateInputs = useCallback((): boolean => {
    if (!url) { toast.error(t("validationEndpointRequired")); return false; }
    if (!apiKey) { toast.error(t("validationApiKeyRequired")); return false; }
    if (!selectedModel) { toast.error(t("validationModelRequired")); return false; }
    return true;
  }, [url, apiKey, selectedModel, t]);

  const runDetection = useCallback(async () => {
    if (!TURNSTILE_SITE_KEY) { toast.error(t("turnstileMissingSiteKey")); return; }
    if (!turnstileVerified || !turnstileToken) { toast.error(t("turnstileCompleteFirst")); return; }

    // Close verification modal immediately once user confirms,
    // while keeping detection running in background.
    setShowTurnstileModal(false);
    setIsScanning(true);
    setResult(null);
    setPublicError(null);

    try {
      const verifyResp = await fetch("/__turnstile/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });
      const verifyData = await verifyResp.json();
      if (!verifyResp.ok || !verifyData?.success) {
        resetTurnstile();
        throw new UserVisibleError({
          title: t("humanVerificationFailed"),
          detail: t("humanVerificationFailedDetail"),
          source: "system",
        });
      }

      const stage1 = await sendProbe({
        baseUrl: url,
        apiKey,
        model: selectedModel,
        stage: "stage1",
        prompt: SYMBOL_PROMPT,
        messages,
      });

      const stage1Pass = !stage1.responseText.includes("”");

      let stage2: ProbeResult | null = null;
      let stage2Pass = false;

      if (stage1Pass) {
        stage2 = await sendProbe({
          baseUrl: url,
          apiKey,
          model: selectedModel,
          stage: "stage2",
          prompt: TARIFF_PROMPT,
          previousAssistantText: stage1.responseText,
          messages,
        });
        stage2Pass = isTariffAnswerValid(stage2.responseText);
      }

      const { checks, score } = buildChecks({ stage1, stage2, stage1Pass, stage2Pass, messages });

      const avgLatency = stage2 ? Math.round((stage1.latencyMs + stage2.latencyMs) / 2) : stage1.latencyMs;
      const avgTps = stage2 ? Number(((stage1.tps + stage2.tps) / 2).toFixed(1)) : stage1.tps;
      const inputTokenSum = (stage1.inputTokens ?? 0) + (stage2?.inputTokens ?? 0);
      const outputTokenSum = (stage1.outputTokens ?? 0) + (stage2?.outputTokens ?? 0);
      const totalTokenSum = (stage1.totalTokens ?? 0) + (stage2?.totalTokens ?? 0);

      const id = `#${Math.floor(100000 + Math.random() * 900000)}`;
      const newResult: DetectionResult = {
        id,
        score,
        checks,
        latency: avgLatency,
        tps: avgTps,
        inputTokens: inputTokenSum,
        outputTokens: outputTokenSum,
        totalTokens: totalTokenSum,
      };
      setResult(newResult);

      const modelName = selectedModel === "claude-opus-4-6" ? "Opus 4.6" : "Sonnet 4.6";
      const now = new Date();
      const timestamp = formatHistoryTimestamp(now);

      setHistory((prev) => [
        {
          id,
          timestamp,
          model: modelName,
          endpoint: url,
          apiKey: "",
          score,
          status: score >= 70 ? "pass" : "fail",
          checks,
          latency: avgLatency,
          tps: avgTps,
          inputTokens: inputTokenSum,
          outputTokens: outputTokenSum,
        },
        ...prev,
      ].slice(0, HISTORY_LIMIT));

      setPublicError(null);
      toast.success(t("detectionComplete"));
    } catch (error) {
      if (error instanceof UserVisibleError) {
        setPublicError(error.info);
        toast.error(error.info.title);
      } else {
        const fallbackInfo: PublicErrorInfo = {
          title: t("detectionFailed"),
          detail: t("detectionFailedDetail"),
          source: "system",
        };
        setPublicError(fallbackInfo);
        toast.error(fallbackInfo.title);
      }
    } finally {
      setIsScanning(false);
      setShowTurnstileModal(false);
      resetTurnstile();
    }
  }, [url, apiKey, selectedModel, turnstileVerified, turnstileToken, resetTurnstile, messages, t]);

  const openTurnstileModal = useCallback(() => {
    if (!validateInputs()) return;
    if (!TURNSTILE_SITE_KEY) {
      toast.error(t("turnstileMissingSiteKey"));
      return;
    }
    setPublicError(null);
    resetTurnstile();
    setShowTurnstileModal(true);
  }, [validateInputs, resetTurnstile, t]);

  const closeTurnstileModal = useCallback(() => {
    setShowTurnstileModal(false);
    resetTurnstile();
  }, [resetTurnstile]);

  const clearHistory = useCallback(() => {
    clearHistoryStorage();
    setHistory([]);
    toast.success(t("toastHistoryCleared"));
  }, [t]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Logo size={36} />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {t("appTitle")}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {t("appSubtitle")}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center border border-border rounded-full overflow-hidden text-xs sm:text-sm">
            <button
              onClick={() => setLang("en")}
              className={`px-2.5 sm:px-3 py-1.5 transition-colors ${lang === "en" ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("zh")}
              className={`px-2.5 sm:px-3 py-1.5 transition-colors ${lang === "zh" ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              中文
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3.5 sm:px-4 py-3 mb-4">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {t("securityNotice")}
          </p>
        </div>

        {/* Config Section */}
        <div className="p-1 sm:p-0 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {t("configSectionTitle")}
            </h2>
          </div>

          <ApiConfig url={url} apiKey={apiKey} onUrlChange={setUrl} onApiKeyChange={setApiKey} />
          <ModelSelector selected={selectedModel} onSelect={setSelectedModel} />
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-end gap-3 mb-5 sm:mb-6 flex-wrap">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={openTurnstileModal}
            disabled={isScanning}
            className="w-full sm:w-auto justify-center flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScanning
              ? t("actionScanning")
              : t("actionStartDetection")}
          </motion.button>
        </div>

        {publicError && (
          <div className="rounded-xl border border-error/35 bg-error/5 p-4 mb-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-error mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {publicError.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">
                  {publicError.source === "upstream"
                    ? `${t("upstreamPrefix")} `
                    : `${t("systemPrefix")} `}
                  {publicError.detail}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        <AnimatePresence>
          {(isScanning || result) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
              className="relative p-1 sm:p-0 mb-4"
            >
              <ScanningOverlay isScanning={isScanning} />

              {result && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        {t("resultTitle")}
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{t("reportIdPrefix")}: {result.id}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 sm:gap-6">
                    <ScoreGauge score={result.score} />
                    <DetectionChecklist
                      items={result.checks}
                      latency={result.latency}
                      tps={result.tps}
                      inputTokens={result.inputTokens}
                      outputTokens={result.outputTokens}
                    />
                  </div>
                </>
              )}

              {isScanning && !result && <div className="h-64" />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Section */}
        <HistoryLog
          entries={history}
          onClear={clearHistory}
        />

        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {t("faqSectionTitle")}
          </h2>
          <div className="mt-4 divide-y divide-border">
            {[
              {
                question: t("introSectionTitle"),
                answer: `${t("introSectionBody1")}\n\n${t("introSectionBody2")}`,
              },
              { question: t("faqQuestion1"), answer: t("faqAnswer1") },
              { question: t("faqQuestion2"), answer: t("faqAnswer2") },
              { question: t("faqQuestion3"), answer: t("faqAnswer3") },
              {
                question: t("faqQuestion4"),
                answer: t("faqAnswer4"),
                link: {
                  href: "/APIreview.html",
                  label: t("faqAnswer4LinkLabel"),
                },
              },
            ].map((item) => (
              <div key={item.question} className="py-4 first:pt-0 last:pb-0">
                <h3 className="text-sm font-medium text-foreground">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {item.answer}
                  {item.link && (
                    <>
                      {" "}
                      <a
                        href={item.link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary font-medium underline underline-offset-4 hover:opacity-80 transition-opacity"
                      >
                        {item.link.label}
                      </a>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <AnimatePresence>
        {showTurnstileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/35 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-border bg-card px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:p-5 shadow-xl max-h-[88vh] overflow-y-auto"
            >
              <div className="mx-auto mb-3 mt-1 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
              <h3 className="text-base font-semibold text-foreground mb-1">
                {t("verifyModalTitle")}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {t("verifyModalDescription")}
              </p>
              <div className="rounded-xl border border-border/70 bg-muted/45 p-2.5">
                <div className="mx-auto flex min-h-[72px] w-full items-center justify-center" ref={turnstileContainerRef} />
              </div>
              <div className="mt-4 grid grid-cols-2 sm:flex sm:justify-end gap-2">
                <button
                  onClick={closeTurnstileModal}
                  className="h-10 px-3 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  {t("verifyModalCancel")}
                </button>
                <button
                  onClick={runDetection}
                  disabled={!turnstileVerified || isScanning}
                  className="h-10 px-3 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("verifyModalConfirm")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
};

export default Index;
