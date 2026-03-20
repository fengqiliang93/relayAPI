import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const logDir = "/tmp/apiverify";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(rootDir, ".env"));
loadEnvFile(path.join(rootDir, ".env.local"));

const port = Number(process.env.PORT || 6722);
const host = process.env.HOST || "0.0.0.0";
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || "";
const configuredTurnstileHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const allowedTurnstileHostnames = new Set([
  "localhost",
  "127.0.0.1",
  "hvoy.ai",
  "www.hvoy.ai",
  ...configuredTurnstileHostnames,
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function maskSecretString(raw) {
  const value = raw.trim();
  if (!value) return value;
  if (value.length <= 10) return "***";
  return `${value.slice(0, 6)}***${value.slice(-2)}`;
}

function redactValue(value, keyHint = "") {
  const secretKeyLike = /(authorization|api[-_]?key|secret|token|password)/i.test(keyHint);

  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (/^bearer\s+/i.test(value)) {
      return `Bearer ${maskSecretString(value.replace(/^bearer\s+/i, ""))}`;
    }
    if (secretKeyLike) {
      return maskSecretString(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, keyHint));
  }

  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = redactValue(nested, key);
    }
    return out;
  }

  return value;
}

function appendLog(kind, payload) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const logPath = `${logDir}/${date}.log`;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      kind,
      ...payload,
    });
    fs.appendFileSync(logPath, `${line}\n`, "utf8");
  } catch {
    // ignore logging failures
  }
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

async function handleTurnstileVerify(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  if (!turnstileSecret) {
    sendJson(res, 500, { ok: false, error: "missing_turnstile_secret" });
    return;
  }

  try {
    const raw = await readRequestBody(req);
    const parsed = JSON.parse(raw || "{}");
    const token = typeof parsed.token === "string" ? parsed.token : "";

    appendLog("turnstile_request", {
      route: "/__turnstile/verify",
      request: redactValue(parsed),
    });

    if (!token) {
      const payload = { ok: false, success: false, error: "missing_token" };
      sendJson(res, 400, payload);
      appendLog("turnstile_response", {
        route: "/__turnstile/verify",
        status: 400,
        response: payload,
      });
      return;
    }

    const remoteIpHeader = req.headers["x-forwarded-for"];
    const remoteIp =
      typeof remoteIpHeader === "string"
        ? remoteIpHeader.split(",")[0]?.trim() || ""
        : "";

    const body = new URLSearchParams();
    body.set("secret", turnstileSecret);
    body.set("response", token);
    if (remoteIp) {
      body.set("remoteip", remoteIp);
    }

    const cfResp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const cfData = await cfResp.json();

    const verifiedHostname =
      cfData && typeof cfData.hostname === "string"
        ? String(cfData.hostname).toLowerCase()
        : "";
    const requestHostHeader = typeof req.headers.host === "string" ? req.headers.host : "";
    const requestHostname = requestHostHeader.split(":")[0]?.trim().toLowerCase() || "";
    const hostnameAllowed =
      verifiedHostname !== "" &&
      (allowedTurnstileHostnames.has(verifiedHostname) || verifiedHostname === requestHostname);
    if (cfData && typeof cfData === "object" && cfData.success === true && !hostnameAllowed) {
      cfData.success = false;
      cfData["error-codes"] = [
        ...(Array.isArray(cfData["error-codes"]) ? cfData["error-codes"] : []),
        "invalid-hostname",
      ];
    }

    const payload = { ok: true, ...cfData };
    sendJson(res, 200, payload);
    appendLog("turnstile_response", {
      route: "/__turnstile/verify",
      status: 200,
      response: redactValue(payload),
    });
  } catch (error) {
    const payload = {
      ok: false,
      success: false,
      error: error instanceof Error ? error.message : "verify_failed",
    };
    sendJson(res, 500, payload);
    appendLog("turnstile_response", {
      route: "/__turnstile/verify",
      status: 500,
      response: payload,
    });
  }
}

async function handleProbe(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const raw = await readRequestBody(req);
    const parsed = JSON.parse(raw || "{}");
    const endpoint = typeof parsed.endpoint === "string" ? parsed.endpoint : "";
    const method = typeof parsed.method === "string" ? parsed.method : "POST";
    const headers = parsed.headers && typeof parsed.headers === "object" ? parsed.headers : {};
    const body = parsed.body ?? {};
    const stage = typeof parsed.stage === "string" ? parsed.stage : "unknown";

    appendLog("probe_request", {
      route: "/__probe",
      stage,
      endpoint,
      method,
      request: {
        headers: redactValue(headers),
        body: redactValue(body),
      },
    });

    const mode =
      parsed.mode === "openai" || parsed.mode === "anthropic"
        ? parsed.mode
        : String(endpoint).toLowerCase().includes("/v1/chat/completions")
          ? "openai"
          : "anthropic";
    const anthropicStream =
      mode === "anthropic" &&
      body &&
      typeof body === "object" &&
      body.stream === true;

    const started = Date.now();
    const upstream = await fetch(endpoint, {
      method,
      headers,
      body: JSON.stringify(body),
    });
    const firstChunkStartedAt = Date.now();
    let firstChunkLatencyMs = null;
    let bodyText = "";
    let signatureDeltaTotalLength = 0;
    let signatureDeltaCount = 0;
    let sseEventTypes = [];
    let sseContentTypes = [];
    let parsedSseLines = 0;
    let upstreamUsage = {};

    if (anthropicStream && upstream.body) {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let rawSse = "";
      let aggregatedText = "";
      let modelName = null;
      let stopReason = null;
      const contentTypesSet = new Set();
      const eventTypes = [];
      const usage = {};

      const mergeUsage = (source) => {
        if (!source || typeof source !== "object") return;
        for (const key of [
          "input_tokens",
          "output_tokens",
          "cache_read_input_tokens",
          "cache_creation_input_tokens",
          "total_tokens",
          "prompt_tokens",
          "completion_tokens",
        ]) {
          const value = source[key];
          if (typeof value === "number") {
            usage[key] = value;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (firstChunkLatencyMs === null) {
          firstChunkLatencyMs = Date.now() - firstChunkStartedAt;
        }
        if (!value) continue;

        const chunkText = decoder.decode(value, { stream: true });
        rawSse += chunkText;
        buffer += chunkText;

        while (buffer.includes("\n")) {
          const idx = buffer.indexOf("\n");
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;

          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          parsedSseLines += 1;

          let event = null;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }
          if (!event) continue;

          const eventType = typeof event.type === "string" ? event.type : "";
          if (eventType) {
            eventTypes.push(eventType);
          }

          if (eventType === "message_start") {
            const message = event.message;
            if (message && typeof message.model === "string") {
              modelName = message.model;
            }
            mergeUsage(message?.usage);
          } else if (eventType === "content_block_start") {
            const block = event.content_block;
            if (block && typeof block.type === "string") {
              contentTypesSet.add(block.type);
            }
          } else if (eventType === "content_block_delta") {
            const delta = event.delta;
            const deltaType = delta && typeof delta.type === "string" ? delta.type : "";
            if (deltaType === "text_delta") {
              if (typeof delta?.text === "string") {
                aggregatedText += delta.text;
              }
            } else if (deltaType === "signature_delta") {
              if (typeof delta?.signature === "string") {
                signatureDeltaTotalLength += delta.signature.length;
                signatureDeltaCount += 1;
              }
            } else if (deltaType === "thinking_delta") {
              contentTypesSet.add("thinking");
            }
          } else if (eventType === "message_delta") {
            mergeUsage(event.usage);
            const delta = event.delta;
            if (delta && typeof delta.stop_reason === "string") {
              stopReason = delta.stop_reason;
            }
          }
        }
      }
      buffer += decoder.decode();

      if (parsedSseLines === 0) {
        bodyText = rawSse;
        try {
          const fallback = JSON.parse(bodyText);
          if (fallback?.usage && typeof fallback.usage === "object") {
            upstreamUsage = fallback.usage;
          }
        } catch {
          upstreamUsage = {};
        }
      } else {
        sseEventTypes = eventTypes;
        sseContentTypes = [...contentTypesSet];
        upstreamUsage = usage;
        bodyText = JSON.stringify({
          model: modelName || null,
          role: "assistant",
          content: [{ type: "text", text: aggregatedText }],
          stop_reason: stopReason,
          usage,
          _sse_meta: {
            event_types: eventTypes,
            content_types: [...contentTypesSet],
            signature_delta_total_length: signatureDeltaTotalLength,
            signature_delta_count: signatureDeltaCount,
          },
        });
      }
    } else if (upstream.body) {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (firstChunkLatencyMs === null) {
          firstChunkLatencyMs = Date.now() - firstChunkStartedAt;
        }
        if (value) {
          bodyText += decoder.decode(value, { stream: true });
        }
      }
      bodyText += decoder.decode();
    } else {
      bodyText = await upstream.text();
    }

    const latencyMs = Date.now() - started;
    const respHeaders = Object.fromEntries(upstream.headers.entries());
    let usage = {};

    if (Object.keys(upstreamUsage).length > 0) {
      usage = upstreamUsage;
    } else {
      try {
        const parsedBody = JSON.parse(bodyText);
        if (parsedBody && typeof parsedBody === "object" && parsedBody.usage && typeof parsedBody.usage === "object") {
          usage = parsedBody.usage;
        }
      } catch {
        usage = {};
      }
    }

    const cacheRead =
      typeof usage.cache_read_input_tokens === "number" ? usage.cache_read_input_tokens : 0;
    const cacheCreation =
      typeof usage.cache_creation_input_tokens === "number" ? usage.cache_creation_input_tokens : 0;
    const cacheHit =
      cacheRead > 0 ||
      String(respHeaders["x-cache"] || "").toLowerCase().includes("hit");

    const payload = {
      ok: true,
      latencyMs,
      firstChunkLatencyMs,
      status: upstream.status,
      usage,
      cacheHit,
      cacheReadInputTokens: cacheRead,
      cacheCreationInputTokens: cacheCreation,
      signatureDeltaTotalLength,
      signatureDeltaCount,
      sseEventTypes,
      sseContentTypes,
      bodyText,
    };
    sendJson(res, 200, payload);
    appendLog("probe_response", {
      route: "/__probe",
      stage,
      endpoint,
      status: 200,
      response: redactValue(payload),
    });
  } catch (error) {
    const payload = { ok: false, error: "probe_failed" };
    sendJson(res, 500, payload);
    appendLog("probe_response", {
      route: "/__probe",
      status: 500,
      response: payload,
    });
  }
}

function resolveStaticFile(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const relativePath = normalized === "/" ? "index.html" : normalized.replace(/^\/+/, "");
  return path.join(distDir, relativePath);
}

function shouldServeIndex(urlPath) {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  return !path.extname(pathname);
}

function serveFile(res, filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url || "/";

  if (urlPath.startsWith("/__turnstile/verify")) {
    await handleTurnstileVerify(req, res);
    return;
  }

  if (urlPath.startsWith("/__probe")) {
    await handleProbe(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  let filePath = resolveStaticFile(urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (shouldServeIndex(urlPath)) {
      filePath = path.join(distDir, "index.html");
    } else {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
  }

  serveFile(res, filePath);
});

server.listen(port, host, () => {
  console.log(`API Verifier production server listening on http://${host}:${port}`);
});
