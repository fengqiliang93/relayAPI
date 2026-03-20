import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { createApiReviewDocument } from "./api-review-template.mjs";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const serverDir = path.join(distDir, "server");
const serverEntry = path.join(serverDir, "entry-server.js");
const clientIndex = path.join(distDir, "index.html");
const apiReviewDataPath = path.join(rootDir, "scripts/.generated/api-review-content.json");

const routes = [
  {
    url: "/",
    fileName: "index.html",
    meta: {
      title: "API中转站鉴定所 | 检测 Claude / OpenAI API 中转站真假",
      description:
        "免费检测 API 中转站是否存在协议不一致、知识异常、身份错配与签名缺失等问题，帮助你快速识别 Claude、OpenAI 等接口是否可靠。",
      canonical: "https://www.hvoy.ai/",
      ogTitle: "API中转站鉴定所 | 检测 Claude / OpenAI API 中转站真假",
      ogDescription:
        "快速检测 API 中转站是否靠谱，识别协议一致性、知识问答、身份一致性与签名指纹等关键风险。",
      ogUrl: "https://www.hvoy.ai/",
      ogImage: "https://www.hvoy.ai/og-image.svg",
    },
  },
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applyMeta(template, meta) {
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
      `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:title" content="${escapeHtml(meta.ogTitle)}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${escapeHtml(meta.ogDescription)}" />`,
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:url" content="${escapeHtml(meta.ogUrl)}" />`,
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:image" content="${escapeHtml(meta.ogImage)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:title" content="${escapeHtml(meta.ogTitle)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:description" content="${escapeHtml(meta.ogDescription)}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:image" content="${escapeHtml(meta.ogImage)}" />`,
    );
}

function extractStylesheetHrefs(template) {
  return [...template.matchAll(/<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((match) => match[1]);
}

await build();
await build({
  build: {
    ssr: path.join(rootDir, "src/entry-server.tsx"),
    outDir: serverDir,
    emptyOutDir: false,
  },
});

const { render } = await import(pathToFileURL(serverEntry).href);
const template = await fs.readFile(clientIndex, "utf8");

for (const route of routes) {
  const appHtml = render(route.url);
  const prerendered = applyMeta(
    template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`),
    route.meta,
  );

  await fs.writeFile(path.join(distDir, route.fileName), prerendered, "utf8");
}

const apiReviewPayload = JSON.parse(await fs.readFile(apiReviewDataPath, "utf8"));
const stylesheetHrefs = extractStylesheetHrefs(template);
const apiReviewDocument = createApiReviewDocument({
  title: "AI API中转站推荐与评测 | Hvoy",
  description:
    "把 relayAPI 的 README 在构建阶段渲染成静态 HTML，并使用当前网站的头部、字体与配色展示 API 中转站推荐与评测内容。",
  canonical: "https://www.hvoy.ai/APIreview.html",
  ogTitle: "AI API中转站推荐与评测 | Hvoy",
  ogDescription: "静态展示 relayAPI README 的 API 中转站推荐与评测页面，沿用 Hvoy 当前网站风格。",
  ogUrl: "https://www.hvoy.ai/APIreview.html",
  ogImage: "https://www.hvoy.ai/og-image.svg",
  cssHrefs: stylesheetHrefs,
  contentHtml: apiReviewPayload.html,
});

await fs.writeFile(path.join(distDir, "APIreview.html"), apiReviewDocument, "utf8");
