import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assetsDir } from './assets.js';
import { loadConfig, type ResolvedConfig, type UserConfig } from './config.js';
import { parseBook, type Book } from './parse.js';
import { renderBook } from './render/book.js';
import { renderHome, renderNotFound } from './render/home.js';
import type { SiteContext } from './render/layout.js';

export interface BuildOptions extends UserConfig {
  /** Project root containing `quotebook.config.json`. Defaults to `process.cwd()`. */
  root?: string;
}

export interface BuildResult {
  config: ResolvedConfig;
  books: Book[];
  /** Output files, relative to `config.outPath`. */
  files: string[];
}

/** Reads and parses every `.md` file in the content directory, sorted for display. */
export async function loadBooks(config: ResolvedConfig): Promise<Book[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(config.contentPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Content folder not found: ${config.contentPath}`);
    }
    throw err;
  }

  const files = entries.filter((f) => /\.(md|markdown)$/i.test(f) && !f.startsWith('_') && !f.startsWith('.'));
  const books = await Promise.all(
    files.map(async (file) => parseBook(await fs.readFile(path.join(config.contentPath, file), 'utf8'), file)),
  );

  const seen = new Map<string, string>();
  books.forEach((book, i) => {
    const other = seen.get(book.slug);
    if (other) throw new Error(`Duplicate slug "${book.slug}" in ${other} and ${files[i]}. Set a unique \`slug\` in frontmatter.`);
    seen.set(book.slug, files[i]!);
  });

  return books.sort(
    (a, b) =>
      (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) || a.title.localeCompare(b.title),
  );
}

function shortHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/** Builds the site into `outDir`, replacing its previous contents. */
export async function build(options: BuildOptions = {}): Promise<BuildResult> {
  const { root = process.cwd(), ...overrides } = options;
  const config = await loadConfig(root, overrides);
  const books = await loadBooks(config);

  const files = new Map<string, string>();

  const css = await fs.readFile(path.join(assetsDir, 'style.css'), 'utf8');
  const slidesJs = await fs.readFile(path.join(assetsDir, 'slides.js'), 'utf8');
  files.set('assets/style.css', css);
  files.set('assets/slides.js', slidesJs);

  const assetUrl = (file: string, content: string) => `${config.basePath}${file}?v=${shortHash(content)}`;
  const ctx: SiteContext = {
    config,
    assets: { css: assetUrl('assets/style.css', css), slidesJs: assetUrl('assets/slides.js', slidesJs) },
  };

  if (config.customCss) {
    const custom = await fs.readFile(path.resolve(config.root, config.customCss), 'utf8');
    files.set('assets/custom.css', custom);
    ctx.assets.customCss = assetUrl('assets/custom.css', custom);
  }

  files.set('index.html', renderHome(ctx, books));
  files.set('404.html', renderNotFound(ctx));
  books.forEach((book, i) => {
    files.set(`${book.slug}/index.html`, renderBook(ctx, book, { prev: books[i - 1], next: books[i + 1] }));
  });
  // Tell GitHub Pages to serve files as-is instead of running Jekyll.
  files.set('.nojekyll', '');

  await fs.rm(config.outPath, { recursive: true, force: true });
  for (const [file, content] of files) {
    const target = path.join(config.outPath, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  }

  return { config, books, files: [...files.keys()] };
}
