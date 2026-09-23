import type { Book } from '../parse.js';
import { escapeHtml, html } from './html.js';
import { layout, url, type SiteContext } from './layout.js';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function renderHome(ctx: SiteContext, books: Book[]): string {
  const { config } = ctx;
  const body = html`<div class="wrap">
<header class="home-intro">
  <h1>${escapeHtml(config.title)}</h1>
  ${config.description && html`<p>${escapeHtml(config.description)}</p>`}
</header>
<main>
${
  books.length
    ? html`<ul class="books">
${books.map(
  (book) => html`  <li><a href="${url(ctx, `${book.slug}/`)}">
    <span class="title">${escapeHtml(book.title)}</span>
    ${book.author && html`<span class="author">${escapeHtml(book.author)}</span>`}
    <span class="count">${plural(book.quotes.length, 'quote')}</span>
  </a></li>
`,
)}</ul>`
    : html`<p class="empty">No books yet. Add a markdown file to <code>${escapeHtml(config.contentDir)}/</code>.</p>`
}
</main>
<footer class="site-footer"><span class="label">${plural(
    books.reduce((n, b) => n + b.quotes.length, 0),
    'quote',
  )} · ${plural(books.length, 'book')}</span></footer>
</div>`;

  return layout(ctx, { path: '', title: config.title, bodyClass: 'home', body });
}

export function renderNotFound(ctx: SiteContext): string {
  const body = html`<div class="wrap">
<header class="home-intro">
  <h1>Not found</h1>
  <p>That page does not exist. <a href="${url(ctx)}">Back to ${escapeHtml(ctx.config.title)}</a>.</p>
</header>
</div>`;
  return layout(ctx, { path: '404.html', title: `Not found · ${ctx.config.title}`, body });
}
