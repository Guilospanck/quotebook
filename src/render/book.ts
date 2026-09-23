import type { Book, Layout, Quote } from '../parse.js';
import { escapeHtml, html } from './html.js';
import { layout, url, type SiteContext } from './layout.js';

interface Neighbors {
  prev?: Book;
  next?: Book;
}

function renderQuote(quote: Quote, className: string): string {
  return html`<article class="${className}" id="${quote.id}">
  <blockquote>${quote.html}</blockquote>
  <footer>
    <a class="num" href="#${quote.id}" aria-label="Link to quote ${quote.index}">${String(quote.index).padStart(2, '0')}</a>
    ${quote.cite && html`<cite>${quote.cite}</cite>`}
    ${quote.tags.length > 0 && html`<span class="tags label">${escapeHtml(quote.tags.join(' · '))}</span>`}
  </footer>
</article>
`;
}

function renderBookHeader(book: Book): string {
  return html`<header class="book-header">
  <h1>${escapeHtml(book.title)}</h1>
  ${book.author && html`<p class="author">${escapeHtml(book.author)}</p>`}
  ${book.introHtml && html`<div class="intro">${book.introHtml}</div>`}
</header>`;
}

function renderPager(ctx: SiteContext, { prev, next }: Neighbors): string {
  if (!prev && !next) return '';
  return html`<nav class="pager" aria-label="Other books">
  ${prev && html`<a class="prev" href="${url(ctx, `${prev.slug}/`)}"><span class="label">← Previous</span><span>${escapeHtml(prev.title)}</span></a>`}
  ${next && html`<a class="next" href="${url(ctx, `${next.slug}/`)}"><span class="label">Next →</span><span>${escapeHtml(next.title)}</span></a>`}
</nav>`;
}

function siteHeader(ctx: SiteContext): string {
  return html`<header class="site-header wrap">
  <a class="label" href="${url(ctx)}">← ${escapeHtml(ctx.config.title)}</a>
</header>`;
}

export function renderBook(ctx: SiteContext, book: Book, neighbors: Neighbors = {}): string {
  const mode: Layout = book.layout ?? ctx.config.layout;
  const title = `${book.title} · ${ctx.config.title}`;
  const description =
    book.description ?? (book.author ? `Quotes from ${book.title} by ${book.author}` : `Quotes from ${book.title}`);

  if (mode === 'slides') {
    const body = html`${siteHeader(ctx)}
<main class="layout-slides">
<section class="slide wrap" id="top">
  <div>
    ${renderBookHeader(book)}
    ${book.quotes.length > 0 && html`<p class="hint label">Scroll or use ↓ ↑ keys</p>`}
  </div>
</section>
${book.quotes.map((q) => html`<section class="slide wrap" id="${q.id}" data-n="${q.index}">${renderQuote(q, 'quote')}</section>\n`)}
${
  (neighbors.prev || neighbors.next) &&
  html`<section class="slide wrap" id="end"><div>${renderPager(ctx, neighbors)}</div></section>`
}
</main>
<div class="counter" aria-live="polite"></div>`;
    return layout(ctx, {
      path: `${book.slug}/`,
      title,
      description,
      bodyClass: 'book is-slides',
      body,
      scripts: [ctx.assets.slidesJs],
    });
  }

  const body = html`${siteHeader(ctx)}
<main class="layout-list wrap">
${renderBookHeader(book)}
${book.quotes.map((q) => renderQuote(q, 'quote'))}
${renderPager(ctx, neighbors)}
</main>
<footer class="site-footer"><a class="label" href="${url(ctx)}">${escapeHtml(ctx.config.title)}</a></footer>`;

  return layout(ctx, { path: `${book.slug}/`, title, description, bodyClass: 'book', body });
}
