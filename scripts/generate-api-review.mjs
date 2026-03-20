import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { createApiReviewDocument } from "./api-review-template.mjs";

const projectRoot = process.cwd();
const sourceRoot = path.resolve(projectRoot, "../relayAPI");
const generatedDataPath = path.join(projectRoot, "scripts/.generated/api-review-content.json");
const publicAssetRoot = path.join(projectRoot, "public/api-review-assets");
const publicAssetBase = "/api-review-assets";
const publicHtmlPath = path.join(projectRoot, "public/APIreview.html");
const pageTitle = "AI API中转站推荐与评测";
const pageMeta = {
  title: `${pageTitle} | Hvoy`,
  description:
    "把 relayAPI 的 README 在构建阶段渲染成静态 HTML，并使用当前网站的头部、字体与配色展示 API 中转站推荐与评测内容。",
  canonical: "https://www.hvoy.ai/APIreview.html",
  ogTitle: `${pageTitle} | Hvoy`,
  ogDescription:
    "静态展示 relayAPI README 的 API 中转站推荐与评测页面",
  ogUrl: "https://www.hvoy.ai/APIreview.html",
  ogImage: "https://www.hvoy.ai/og-image.svg",
};

function isExternalUrl(value) {
  return /^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("data:");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function normalizeLocalAsset(href) {
  const cleanHref = href.split("?")[0]?.split("#")[0] ?? href;
  const normalized = path.posix.normalize(cleanHref);

  if (!normalized || normalized.startsWith("../")) {
    throw new Error(`Unsupported local asset path in README: ${href}`);
  }

  return normalized.replace(/^\.?\//, "");
}

function shouldSkipImage(relativeAssetPath) {
  return relativeAssetPath.toLowerCase() === "pic/banner.png";
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function resolveMarkdownPath() {
  const candidates = ["README.md", "readme.md"].map((fileName) => path.join(sourceRoot, fileName));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(`Could not find relayAPI README. Tried: ${candidates.join(", ")}`);
}

async function copyLocalAsset(relativeAssetPath) {
  const sourcePath = path.resolve(sourceRoot, relativeAssetPath);
  const relativeFromSource = path.relative(sourceRoot, sourcePath);

  if (relativeFromSource.startsWith("..") || path.isAbsolute(relativeFromSource)) {
    throw new Error(`Asset path escapes relayAPI directory: ${relativeAssetPath}`);
  }

  const destinationPath = path.join(publicAssetRoot, relativeFromSource);
  await ensureDir(path.dirname(destinationPath));
  await fs.copyFile(sourcePath, destinationPath);

  return `${publicAssetBase}/${toPosixPath(relativeFromSource)}`;
}

async function main() {
  const markdownPath = await resolveMarkdownPath();
  const rawMarkdown = await fs.readFile(markdownPath, "utf8");
  const markdown = rawMarkdown.replace(/^(\d+)\s{2,}(?=\S)/gm, "$1. ");

  await fs.rm(publicAssetRoot, { recursive: true, force: true });
  await ensureDir(publicAssetRoot);

  const copiedAssets = new Map();
  const imageMatches = [...markdown.matchAll(/!\[[^\]]*?\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)];

  for (const match of imageMatches) {
    const rawHref = match[1]?.trim();
    if (!rawHref || isExternalUrl(rawHref)) continue;

    const relativeAssetPath = normalizeLocalAsset(rawHref);
    if (shouldSkipImage(relativeAssetPath)) continue;
    if (!copiedAssets.has(relativeAssetPath)) {
      const publicPath = await copyLocalAsset(relativeAssetPath);
      copiedAssets.set(relativeAssetPath, publicPath);
    }
  }

  const renderer = {
    link(token) {
      const href = typeof token.href === "string" ? token.href.trim() : "";
      const text = typeof token.text === "string" ? token.text : "";
      const titleAttr = token.title ? ` title="${escapeHtml(token.title)}"` : "";

      return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer"${titleAttr}>${text}</a>`;
    },
    image(token) {
      const rawHref = typeof token.href === "string" ? token.href.trim() : "";
      const titleAttr = token.title ? ` title="${escapeHtml(token.title)}"` : "";
      const alt = escapeHtml(token.text || "");

      if (!rawHref) {
        return `<img src="" alt="${alt}"${titleAttr}>`;
      }

      if (isExternalUrl(rawHref)) {
        return `<img src="${escapeHtml(rawHref)}" alt="${alt}"${titleAttr}>`;
      }

      const relativeAssetPath = normalizeLocalAsset(rawHref);
      if (shouldSkipImage(relativeAssetPath)) {
        return "";
      }
      const publicPath = copiedAssets.get(relativeAssetPath);

      if (!publicPath) {
        throw new Error(`Local asset was not prepared before rendering: ${rawHref}`);
      }

      return `<img src="${escapeHtml(publicPath)}" alt="${alt}"${titleAttr}>`;
    },
  };

  marked.use({
    breaks: true,
    gfm: true,
    renderer,
  });

  const html = marked.parse(markdown);
  const payload = { title: pageTitle, html };
  const devDocument = createApiReviewDocument({
    ...pageMeta,
    cssHrefs: ["/src/index.css"],
    contentHtml: html,
  });

  await ensureDir(path.dirname(generatedDataPath));
  await fs.writeFile(generatedDataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(publicHtmlPath, devDocument, "utf8");
}

await main();
