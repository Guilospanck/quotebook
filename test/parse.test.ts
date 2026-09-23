import { describe, expect, it } from 'vitest';
import { parseBook } from '../src/parse.js';

describe('parseBook', () => {
  it('reads frontmatter and turns each blockquote into a quote', () => {
    const book = parseBook(
      `---
title: Meditations
author: Marcus Aurelius
order: 3
layout: slides
---

> First quote.

> Second quote,
> over two lines.
`,
      'content/meditations.md',
    );

    expect(book).toMatchObject({ slug: 'meditations', title: 'Meditations', author: 'Marcus Aurelius', order: 3, layout: 'slides' });
    expect(book.quotes.map((q) => q.text)).toEqual(['First quote.', 'Second quote,\nover two lines.']);
    expect(book.quotes.map((q) => q.id)).toEqual(['q-1', 'q-2']);
  });

  it('extracts a citation from its own paragraph', () => {
    const [quote] = parseBook('> Be one.\n>\n> — *Meditations*, Book X\n').quotes;
    expect(quote!.html).toBe('<p>Be one.</p>');
    expect(quote!.cite).toBe('<em>Meditations</em>, Book X');
  });

  it('extracts a citation from the last line of the quote', () => {
    const [quote] = parseBook('> A journey of a thousand miles\n> begins with a single step.\n> — Chapter 64\n').quotes;
    expect(quote!.html).toBe('<p>A journey of a thousand miles\nbegins with a single step.</p>');
    expect(quote!.cite).toBe('Chapter 64');
  });

  it('extracts a citation that follows inline markup', () => {
    const [quote] = parseBook('> Some *emphasis* here.\n> -- Author, *Work*\n').quotes;
    expect(quote!.html).toBe('<p>Some <em>emphasis</em> here.</p>');
    expect(quote!.cite).toBe('Author, <em>Work</em>');
  });

  it('keeps dashes that are not a trailing citation', () => {
    const [a, b] = parseBook('> You have power over your mind — not outside events.\n\n> — just a dash quote\n').quotes;
    expect(a!.cite).toBeUndefined();
    expect(a!.text).toBe('You have power over your mind — not outside events.');
    expect(b!.cite).toBeUndefined();
    expect(b!.text).toBe('— just a dash quote');
  });

  it('attaches metadata comments to the preceding quote', () => {
    const [quote] = parseBook('> Omit needless words.\n<!-- tags: style, brevity -->\n<!-- id: Omit Words -->\n<!-- source: Strunk -->\n').quotes;
    expect(quote!.tags).toEqual(['style', 'brevity']);
    expect(quote!.id).toBe('omit-words');
    expect(quote!.meta).toEqual({ source: 'Strunk' });
  });

  it('uses a leading h1 as the title and other content as intro', () => {
    const book = parseBook('# On Writing\n\nShort notes.\n\n> Omit needless words.\n', 'on-writing.md');
    expect(book.title).toBe('On Writing');
    expect(book.introHtml).toBe('<p>Short notes.</p>');
    expect(book.quotes).toHaveLength(1);
  });

  it('falls back to the filename and slugifies custom slugs', () => {
    expect(parseBook('', 'Tao Te Ching.md')).toMatchObject({ title: 'Tao Te Ching', slug: 'tao-te-ching', quotes: [] });
    expect(parseBook('---\nslug: Über Café!\n---\n').slug).toBe('uber-cafe');
  });

  it('never passes raw HTML through', () => {
    const book = parseBook('<script>alert(1)</script>\n\n> Hi <img src=x onerror=alert(1)>\n');
    expect(book.introHtml).toBe('');
    expect(book.quotes[0]!.html).toBe('<p>Hi </p>');
  });

  it('ignores invalid layout values', () => {
    expect(parseBook('---\nlayout: grid\n---\n').layout).toBeUndefined();
  });
});
