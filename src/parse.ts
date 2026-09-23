import path from 'node:path';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { toString } from 'mdast-util-to-string';
import type { Blockquote, Paragraph, PhrasingContent, Root, RootContent } from 'mdast';

export type Layout = 'list' | 'slides';

export interface Quote {
  /** 1-based position within the book. */
  index: number;
  /** Anchor id, `q-<index>` unless overridden with `<!-- id: ... -->`. */
  id: string;
  /** Rendered HTML of the quote body. */
  html: string;
  /** Plain-text version of the quote body. */
  text: string;
  /** Rendered HTML of the citation line (`— Book IV`), if any. */
  cite?: string;
  /** Key/value pairs from `<!-- key: value -->` comments following the quote. */
  meta: Record<string, string>;
  tags: string[];
}

export interface Book {
  slug: string;
  title: string;
  author?: string;
  description?: string;
  order?: number;
  layout?: Layout;
  /** Rendered HTML of any non-quote content (intro text). */
  introHtml: string;
  quotes: Quote[];
  /** Original frontmatter, for custom templates. */
  data: Record<string, unknown>;
}

const CITE_PREFIX = /^\s*(?:—|–|―|--)\s*/;
const CITE_LINE = /\n\s*(?:—|–|―|--)\s*([^\n]*)$/;
const META_COMMENT = /^<!--\s*([\w-]+)\s*:\s*([\s\S]*?)\s*-->$/;

const toHtmlProcessor = unified().use(remarkRehype).use(rehypeStringify);

function renderNodes(children: RootContent[]): string {
  const root: Root = { type: 'root', children };
  const hast = toHtmlProcessor.runSync(root);
  return toHtmlProcessor.stringify(hast).trim();
}

function renderInline(children: PhrasingContent[]): string {
  const html = renderNodes([{ type: 'paragraph', children }]);
  return html.replace(/^<p>/, '').replace(/<\/p>$/, '');
}

/**
 * Pulls a trailing citation (`— Author, Work`) out of a blockquote.
 * The citation may be its own paragraph or the last line of the final paragraph.
 * Mutates the blockquote and returns the citation's inline nodes.
 */
function extractCitation(quote: Blockquote): PhrasingContent[] | undefined {
  const last = quote.children.at(-1);
  if (!last || last.type !== 'paragraph') return undefined;
  const first = last.children[0];

  // Whole paragraph is the citation: `> — Book IV`
  if (first?.type === 'text' && CITE_PREFIX.test(first.value) && quote.children.length > 1) {
    quote.children.pop();
    const rest = first.value.replace(CITE_PREFIX, '');
    return rest ? [{ ...first, value: rest }, ...last.children.slice(1)] : last.children.slice(1);
  }

  // Citation on the last line of the paragraph: `> ...thoughts.\n> — Book IV`
  for (let i = last.children.length - 1; i >= 0; i--) {
    const node = last.children[i]!;
    if (node.type === 'break') continue;
    if (node.type !== 'text') {
      if (i === 0) break;
      continue;
    }
    const match = CITE_LINE.exec(node.value);
    if (!match) {
      if (node.value.includes('\n')) break;
      continue;
    }
    const citeNodes: PhrasingContent[] = [];
    if (match[1]) citeNodes.push({ type: 'text', value: match[1] });
    citeNodes.push(...last.children.slice(i + 1));
    node.value = node.value.slice(0, match.index);
    last.children = last.children.slice(0, i + 1);
    // Drop a trailing hard break left before the citation line.
    while (last.children.at(-1)?.type === 'break') last.children.pop();
    return citeNodes;
  }
  return undefined;
}

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}

/**
 * Parses one markdown file into a Book. Each top-level blockquote is a quote;
 * everything else (except a leading `# Title` and metadata comments) is intro text.
 */
export function parseBook(source: string, filePath = 'untitled.md'): Book {
  const { data, content } = matter(source);
  const tree = unified().use(remarkParse).parse(content);

  let title = optionalString(data.title);
  const introNodes: RootContent[] = [];
  const quotes: Quote[] = [];
  let lastQuote: Quote | undefined;

  for (const node of tree.children) {
    if (node.type === 'blockquote') {
      const citeNodes = extractCitation(node);
      const index = quotes.length + 1;
      lastQuote = {
        index,
        id: `q-${index}`,
        html: renderNodes(node.children),
        text: toString(node.children as Paragraph[]).trim(),
        cite: citeNodes?.length ? renderInline(citeNodes) : undefined,
        meta: {},
        tags: [],
      };
      quotes.push(lastQuote);
      continue;
    }

    if (node.type === 'html') {
      const match = META_COMMENT.exec(node.value.trim());
      if (match && lastQuote) {
        const [, key, value] = match as unknown as [string, string, string];
        if (key === 'tags') lastQuote.tags = value.split(',').map((t) => t.trim()).filter(Boolean);
        else if (key === 'id') lastQuote.id = slugify(value) || lastQuote.id;
        else lastQuote.meta[key] = value;
      }
      // Raw HTML is never passed through; comments are metadata only.
      continue;
    }

    if (node.type === 'thematicBreak') continue;

    if (node.type === 'heading' && node.depth === 1 && !title && quotes.length === 0 && introNodes.length === 0) {
      title = toString(node);
      continue;
    }

    introNodes.push(node);
  }

  const fileSlug = path.basename(filePath, path.extname(filePath));
  const slug = slugify(optionalString(data.slug) ?? fileSlug) || 'book';
  const layout = data.layout === 'slides' || data.layout === 'list' ? data.layout : undefined;
  const order = typeof data.order === 'number' ? data.order : undefined;

  return {
    slug,
    title: title ?? fileSlug,
    author: optionalString(data.author),
    description: optionalString(data.description),
    order,
    layout,
    introHtml: introNodes.length ? renderNodes(introNodes) : '',
    quotes,
    data,
  };
}
