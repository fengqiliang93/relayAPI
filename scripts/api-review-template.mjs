function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const logoSvg = `
<svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z" fill="hsl(var(--primary))" opacity="0.12"></path>
  <path d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z" stroke="hsl(var(--primary))" stroke-width="2.5" stroke-linejoin="round" fill="none"></path>
  <path d="M22 30h6l2-6 4 12 3-8 5 2h6" stroke="hsl(var(--primary))" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
  <circle cx="32" cy="44" r="3" fill="hsl(var(--primary))"></circle>
</svg>`;

const footerLogoSvg = logoSvg.replace('width="36"', 'width="20"').replace('height="36"', 'height="20"');

function buildStylesheetLinks(cssHrefs) {
  return cssHrefs.map((href) => `    <link rel="stylesheet" href="${escapeHtml(href)}" />`).join("\n");
}

export function createApiReviewDocument(options) {
  const {
    title,
    description,
    canonical,
    ogTitle,
    ogDescription,
    ogUrl,
    ogImage,
    cssHrefs,
    contentHtml,
  } = options;

  return `<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="alternate icon" href="/favicon.ico" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="author" content="Sting" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />

    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDescription)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(ogUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
${buildStylesheetLinks(cssHrefs)}
  </head>
  <body>
    <div class="min-h-screen bg-background">
      <div class="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <header class="mb-6 sm:mb-8">
          <a href="/" class="inline-flex items-center gap-3 min-w-0 hover:opacity-90 transition-opacity">
            ${logoSvg}
            <div class="min-w-0">
              <p class="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-primary/80">Hvoy.ai Docs</p>
              <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground">${escapeHtml(title.replace(" | Hvoy.ai", ""))}</h1>
            </div>
          </a>
        </header>

        <section class="rounded-2xl border border-border bg-card/80 shadow-sm">
          <div class="px-4 sm:px-6 py-6 sm:py-8">
            <article class="markdown-body api-doc-content">${contentHtml}</article>
          </div>
        </section>
      </div>

      <footer class="mt-12 border-t border-border">
        <div class="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            ${footerLogoSvg}
            <span class="text-sm text-muted-foreground font-medium">API Verity Lab</span>
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="/APIreview.html" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">API 评测</a>
            <a href="https://github.com/zzsting88/relayAPI" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
            <a href="mailto:info@hvoy.ai" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors break-all sm:break-normal">邮箱: info@hvoy.ai</a>
            <p class="text-xs text-muted-foreground">© 2026 保留所有权利。</p>
          </div>
        </div>
      </footer>
    </div>
  </body>
</html>
`;
}
