# quotebook

Turn a folder of markdown files into a quiet, typographic quotes website, and publish it to GitHub Pages.

- **One markdown file per book or topic**, where each blockquote is one quote.
- **Two layouts:** a scrolling `list`, or `slides` with one quote per screen and keyboard navigation.
- **Plain static output:** HTML and one stylesheet, no framework and no web fonts. JavaScript is used only in slides mode.
- **Automatic dark mode**, readable on phones, and every quote has its own link (`/meditations/#q-3`).

**[Live demo](https://guilospanck.github.io/quotebook/)**: quotebook's documentation, written as quotes. Its source in [`examples/basic`](examples/basic/content) doubles as a reference for the markdown format.

## Quick start

```sh
npx quotebook init      # config, an example book and a GitHub Pages workflow
npx quotebook dev       # preview at http://localhost:4321 with live reload
```

Then, **before your first push**, open your repository's **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. After that, every push to `main` rebuilds and redeploys the site.

> If a deploy fails with `Get Pages site failed ... Not Found`, Pages is not enabled yet. Enable it as above and re-run the workflow. The workflow cannot enable Pages itself, because the default Actions token is not allowed to.

## Writing books

Add one `.md` file per book or topic to `content/`:

```md
---
title: Meditations
author: Marcus Aurelius
description: Private notes on how to live.   # optional, used for SEO/social cards
order: 1                                     # optional, sets the order on the home page
slug: meditations                            # optional, defaults to the filename
layout: slides                               # optional, overrides the site layout
---

An optional intro paragraph. Any non-quote content becomes the book's intro.

> You have power over your mind — not outside events.
> Realize this, and you will find strength.

> The happiness of your life depends upon the quality of your thoughts.
>
> — Book V
<!-- tags: mind, happiness -->
```

Rules:

| You write | You get |
| --- | --- |
| A blockquote (`> …`) | One quote. Line breaks are kept, so verse stays verse. |
| A last line starting with `—`, `–` or `--` | The quote's citation. It can be its own paragraph or the final line of the quote. |
| `<!-- tags: a, b -->` right after a quote | Tags shown next to the quote |
| `<!-- id: my-quote -->` right after a quote | A custom anchor (`#my-quote`) instead of `#q-3` |
| `<!-- anything: value -->` | Stored in `quote.meta` for API users |
| A leading `# Heading` with no `title` in frontmatter | The book's title |

Files starting with `_` (for example `_drafts.md`) are ignored. Raw HTML in markdown is never rendered.

## Configuration

`quotebook.config.json` in the project root (all fields optional):

```json
{
  "title": "Commonplace",
  "description": "Passages worth keeping.",
  "contentDir": "content",
  "outDir": "dist",
  "basePath": "/my-repo/",
  "url": "https://you.github.io",
  "layout": "list",
  "lang": "en",
  "customCss": "theme.css"
}
```

- **`basePath`** is the path the site is served from. GitHub serves `<you>.github.io` repositories at `/` and every other repository at `/<repo>/`. `init` fills this in from your git remote.
- **`url`** is the site's origin and is used for canonical and Open Graph links.
- **`customCss`** is loaded after the default theme. Override the CSS variables to restyle the site:

  ```css
  :root { --accent: #2f6f4f; --measure: 38rem; --serif: 'Literata', Georgia, serif; }
  /* Collapse soft line breaks if you hard-wrap your prose: */
  .quote blockquote p { white-space: normal; }
  ```

## CLI

```
quotebook init [dir]  [--title <title>] [--force]      Scaffold config, example and workflow
quotebook build [dir] [--out-dir <dir>] [--base-path <path>]
quotebook dev [dir]   [--port 4321] [--host localhost]
```

## Programmatic API

```ts
import { build, parseBook } from 'quotebook';

const { books } = await build({ root: './my-site', basePath: '/quotes/' });

const book = parseBook(markdownSource, 'meditations.md');
book.quotes[0]; // { index, id, html, text, cite, tags, meta }
```

Also exported: `dev`, `init`, `loadConfig`, `resolveConfig`, `loadBooks`, and all types.

## Other hosts

The build output is a plain static folder, so it works on any static host. Only GitHub Pages has an `init` preset so far. For Netlify or Cloudflare Pages, set the build command to `npx quotebook build` and the output directory to `dist`.

## Development

```sh
npm install
npm test            # vitest
npm run typecheck
npm run example     # build the package and serve examples/basic
```
