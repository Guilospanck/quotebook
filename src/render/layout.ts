import type { ResolvedConfig } from '../config.js';
import { escapeHtml, html } from './html.js';

export interface SiteContext {
  config: ResolvedConfig;
  /** Public URLs (already prefixed with basePath) of the built assets. */
  assets: { css: string; customCss?: string; slidesJs: string };
}

export interface PageOptions {
  /** Path of the page relative to basePath, e.g. `''` or `meditations/`. */
  path: string;
  title: string;
  description?: string;
  bodyClass?: string;
  body: string;
  scripts?: string[];
}

export function url(ctx: SiteContext, pagePath = ''): string {
  return ctx.config.basePath + pagePath;
}

export function layout(ctx: SiteContext, page: PageOptions): string {
  const { config } = ctx;
  const description = page.description || config.description;
  const canonical = config.url ? config.url + url(ctx, page.path) : undefined;

  return html`<!doctype html>
<html lang="${escapeHtml(config.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(page.title)}</title>
${description && html`<meta name="description" content="${escapeHtml(description)}">`}
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(page.title)}">
${description && html`<meta property="og:description" content="${escapeHtml(description)}">`}
${canonical && html`<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:url" content="${escapeHtml(canonical)}">`}
<meta name="theme-color" content="#f6f4ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141412" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="${ctx.assets.css}">
${ctx.assets.customCss && html`<link rel="stylesheet" href="${ctx.assets.customCss}">`}
</head>
<body${page.bodyClass && html` class="${page.bodyClass}"`}>
${page.body}
${(page.scripts ?? []).map((src) => html`<script src="${src}" defer></script>\n`)}
</body>
</html>
`;
}
